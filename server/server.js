#!/usr/bin/env node

process.title = "mediasoup-demo-server";
process.env.DEBUG = process.env.DEBUG || "*INFO* *WARN* *ERROR*";

const config = require("./config");
const dayjs = require("dayjs");

/* eslint-disable no-console */
console.log("process.env.DEBUG:", process.env.DEBUG);
console.log("config.js:\n%s", JSON.stringify(config, null, "  "));
/* eslint-enable no-console */

const fs = require("fs");
const https = require("https");
const http = require("http");
const url = require("url");
const protoo = require("protoo-server");
const mediasoup = require("mediasoup");
const express = require("express");
const bodyParser = require("body-parser");
const { AwaitQueue } = require("awaitqueue");
const Logger = require("./lib/Logger");
const utils = require("./lib/utils");
const Room = require("./lib/Room");
const interactiveServer = require("./lib/interactiveServer");
const interactiveClient = require("./lib/interactiveClient");

const cors = require("cors");
const multer = require("multer");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

// CORS 화이트리스트 (운영 도메인 추가해야함)
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://192.168.0.10:3000",
  "https://192.168.0.10:3000",
];

const logger = new Logger();

// Async queue to manage rooms.
// @type {AwaitQueue}
const queue = new AwaitQueue();

// Map of Room instances indexed by roomId.
// @type {Map<Number, Room>}
const rooms = new Map();

// HTTPS server.
// @type {https.Server}
let httpsServer;

// Express application.
// @type {Function}
let expressApp;

// Protoo WebSocket server.
// @type {protoo.WebSocketServer}
let protooWebSocketServer;

// mediasoup Workers.
// @type {Array<mediasoup.Worker>}
const mediasoupWorkers = [];

// Index of next mediasoup Worker to use.
// @type {Number}
let nextMediasoupWorkerIdx = 0;

run();

async function run() {
  // Open the interactive server.
  await interactiveServer();

  // Open the interactive client.
  if (process.env.INTERACTIVE === "true" || process.env.INTERACTIVE === "1")
    await interactiveClient();

  // Run a mediasoup Worker.
  await runMediasoupWorkers();

  // Create Express app.
  // await createExpressApp();
  expressApp = await createExpressApp();

  // Run HTTPS server.
  await runHttpsServer();

  // Run a protoo WebSocketServer.
  await runProtooWebSocketServer();

  // Log rooms status every X seconds.
  setInterval(() => {
    for (const room of rooms.values()) {
      room.logStatus();
    }
  }, 120000);
}

/**
 * Launch as many mediasoup Workers as given in the configuration file.
 */
async function runMediasoupWorkers() {
  const { numWorkers } = config.mediasoup;

  logger.info("running %d mediasoup Workers...", numWorkers);

  for (let i = 0; i < numWorkers; ++i) {
    const worker = await mediasoup.createWorker({
      dtlsCertificateFile: config.mediasoup.workerSettings.dtlsCertificateFile,
      dtlsPrivateKeyFile: config.mediasoup.workerSettings.dtlsPrivateKeyFile,
      logLevel: config.mediasoup.workerSettings.logLevel,
      logTags: config.mediasoup.workerSettings.logTags,
      rtcMinPort: Number(config.mediasoup.workerSettings.rtcMinPort),
      rtcMaxPort: Number(config.mediasoup.workerSettings.rtcMaxPort),
      disableLiburing: Boolean(config.mediasoup.workerSettings.disableLiburing),
    });

    worker.on("died", () => {
      logger.error(
        "mediasoup Worker died, exiting  in 2 seconds... [pid:%d]",
        worker.pid
      );

      setTimeout(() => process.exit(1), 2000);
    });

    mediasoupWorkers.push(worker);

    // Create a WebRtcServer in this Worker.
    if (process.env.MEDIASOUP_USE_WEBRTC_SERVER !== "false") {
      // Each mediasoup Worker will run its own WebRtcServer, so those cannot
      // share the same listening ports. Hence we increase the value in config.js
      // for each Worker.
      const webRtcServerOptions = utils.clone(
        config.mediasoup.webRtcServerOptions
      );
      const portIncrement = mediasoupWorkers.length - 1;

      for (const listenInfo of webRtcServerOptions.listenInfos) {
        listenInfo.port += portIncrement;
      }

      const webRtcServer = await worker.createWebRtcServer(webRtcServerOptions);

      worker.appData.webRtcServer = webRtcServer;
    }

    // Log worker resource usage every X seconds.
    setInterval(async () => {
      const usage = await worker.getResourceUsage();

      logger.info(
        "mediasoup Worker resource usage [pid:%d]: %o",
        worker.pid,
        usage
      );

      const dump = await worker.dump();

      logger.info("mediasoup Worker dump [pid:%d]: %o", worker.pid, dump);
    }, 120000);
  }
}

/**
 * Create an Express based API server to manage Broadcaster requests.
 */
async function createExpressApp() {
  logger.info("creating Express app...");

  const expressApp = express();

  // ✅ CORS 설정 (화이트리스트 + credentials)
  const corsOptions = {
    origin(origin, cb) {
      // 서버-서버 호출(curl, 모바일 앱 등)에서 Origin 없을 수 있으니 허용
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Disposition"],
  };

  expressApp.use(cors(corsOptions));

  expressApp.options("*", cors(corsOptions));

  expressApp.use((req, res, next) => {
    res.setHeader("Vary", "Origin");
    next();
  });

  // JSON body 파싱용
  expressApp.use(bodyParser.json());

  // ✅ 업로드/변환 디렉토리 보장
  const uploadDir = path.resolve(__dirname, "uploads");
  const convertedDir = path.resolve(__dirname, "converted");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  if (!fs.existsSync(convertedDir))
    fs.mkdirSync(convertedDir, { recursive: true });

  // 업로드용 multer 설정
  const upload = multer({ dest: uploadDir });

  // 서버 안정을 위해 업로드 한도 / 타입 제한 지정 코드
  //   const upload = multer({
  //   dest: uploadDir,
  //   limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  //   fileFilter: (req, file, cb) => {
  //     // webm만 받는다면:
  //     // if (file.mimetype !== "video/webm") return cb(new Error("Only webm allowed"));
  //     cb(null, true);
  //   }
  // });

  /**
   * For every API request, verify that the roomId in the path matches and
   * existing room.
   */
  expressApp.param("roomId", (req, res, next, roomId) => {
    queue
      .push(async () => {
        req.room = await getOrCreateRoom({ roomId, consumerReplicas: 0 });

        next();
      })
      .catch((error) => {
        logger.error(
          "room creation or room joining via broadcaster failed:%o",
          error
        );

        next(error);
      });
  });

  /**
   * API GET resource that returns the mediasoup Router RTP capabilities of
   * the room.
   */
  expressApp.get("/rooms/:roomId", (req, res) => {
    const data = req.room.getRouterRtpCapabilities();

    res.status(200).json(data);
  });

  /**
   * POST API to create a Broadcaster.
   */
  expressApp.post("/rooms/:roomId/broadcasters", async (req, res, next) => {
    const { id, displayName, device, rtpCapabilities } = req.body;

    try {
      const data = await req.room.createBroadcaster({
        id,
        displayName,
        device,
        rtpCapabilities,
      });

      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE API to delete a Broadcaster.
   */
  expressApp.delete(
    "/rooms/:roomId/broadcasters/:broadcasterId",
    (req, res) => {
      const { broadcasterId } = req.params;

      req.room.deleteBroadcaster({ broadcasterId });

      res.status(200).send("broadcaster deleted");
    }
  );

  /**
   * POST API to create a mediasoup Transport associated to a Broadcaster.
   * It can be a PlainTransport or a WebRtcTransport depending on the
   * type parameters in the body. There are also additional parameters for
   * PlainTransport.
   */
  expressApp.post(
    "/rooms/:roomId/broadcasters/:broadcasterId/transports",
    async (req, res, next) => {
      const { broadcasterId } = req.params;
      const { type, rtcpMux, comedia, sctpCapabilities } = req.body;

      try {
        const data = await req.room.createBroadcasterTransport({
          broadcasterId,
          type,
          rtcpMux,
          comedia,
          sctpCapabilities,
        });

        res.status(200).json(data);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST API to connect a Transport belonging to a Broadcaster. Not needed
   * for PlainTransport if it was created with comedia option set to true.
   */
  expressApp.post(
    "/rooms/:roomId/broadcasters/:broadcasterId/transports/:transportId/connect",
    async (req, res, next) => {
      const { broadcasterId, transportId } = req.params;
      const { dtlsParameters } = req.body;

      try {
        const data = await req.room.connectBroadcasterTransport({
          broadcasterId,
          transportId,
          dtlsParameters,
        });

        res.status(200).json(data);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST API to create a mediasoup Producer associated to a Broadcaster.
   * The exact Transport in which the Producer must be created is signaled in
   * the URL path. Body parameters include kind and rtpParameters of the
   * Producer.
   */
  expressApp.post(
    "/rooms/:roomId/broadcasters/:broadcasterId/transports/:transportId/producers",
    async (req, res, next) => {
      const { broadcasterId, transportId } = req.params;
      const { kind, rtpParameters } = req.body;

      try {
        const data = await req.room.createBroadcasterProducer({
          broadcasterId,
          transportId,
          kind,
          rtpParameters,
        });

        res.status(200).json(data);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST API to create a mediasoup Consumer associated to a Broadcaster.
   * The exact Transport in which the Consumer must be created is signaled in
   * the URL path. Query parameters must include the desired producerId to
   * consume.
   */
  expressApp.post(
    "/rooms/:roomId/broadcasters/:broadcasterId/transports/:transportId/consume",
    async (req, res, next) => {
      const { broadcasterId, transportId } = req.params;
      const { producerId } = req.query;

      try {
        const data = await req.room.createBroadcasterConsumer({
          broadcasterId,
          transportId,
          producerId,
        });

        res.status(200).json(data);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST API to create a mediasoup DataConsumer associated to a Broadcaster.
   * The exact Transport in which the DataConsumer must be created is signaled in
   * the URL path. Query body must include the desired producerId to
   * consume.
   */
  expressApp.post(
    "/rooms/:roomId/broadcasters/:broadcasterId/transports/:transportId/consume/data",
    async (req, res, next) => {
      const { broadcasterId, transportId } = req.params;
      const { dataProducerId } = req.body;

      try {
        const data = await req.room.createBroadcasterDataConsumer({
          broadcasterId,
          transportId,
          dataProducerId,
        });

        res.status(200).json(data);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST API to create a mediasoup DataProducer associated to a Broadcaster.
   * The exact Transport in which the DataProducer must be created is signaled in
   */
  expressApp.post(
    "/rooms/:roomId/broadcasters/:broadcasterId/transports/:transportId/produce/data",
    async (req, res, next) => {
      const { broadcasterId, transportId } = req.params;
      const { label, protocol, sctpStreamParameters, appData } = req.body;

      try {
        const data = await req.room.createBroadcasterDataProducer({
          broadcasterId,
          transportId,
          label,
          protocol,
          sctpStreamParameters,
          appData,
        });

        res.status(200).json(data);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Error handler.
   */
  // expressApp.use((error, req, res, next) => {
  //   if (error) {
  //     logger.warn("Express app %s", String(error));

  //     error.status = error.status || (error.name === "TypeError" ? 400 : 500);

  //     res.statusMessage = error.message;
  //     res.status(error.status).send(String(error));
  //   } else {
  //     next();
  //   }
  // });

  // 녹화된 webm 업로드 -> mp4 변환 엔드포인트
  expressApp.post("/upload-webm", upload.single("video"), (req, res) => {
    try {
      // 업로드된 file 경로 (절대 경로로 변환해도 좋음)
      const webmPath = req.file.path;
      // 날짜 기반 커스텀 파일명 생성
      const dateStr = dayjs().format("YYYY-MM-DD");
      const customFileName = `Full-Screen-Recording_${dateStr}.mp4`;
      const mp4Path = path.join(convertedDir, customFileName);
      console.log("이 값은 뭐지 ?webmPath: ", webmPath);

      // ffmpeg 변환 실행
      ffmpeg(webmPath)
        .output(mp4Path)
        .on("end", () => {
          // 변환 끝나면 임시 웹엠 파일 삭제
          fs.unlink(webmPath, (err) => {
            if (err) logger.warn("임시 webm 삭제 실패:", err);
          });

          // 응답에 변환된 mp4 경로(예: API 통해 다운받을 수 있는 경로) 포함
          res.status(200).json({
            message: "변환 완료",
            mp4Url: `/download/${customFileName}`,
          });
        })
        .on("error", (err) => {
          logger.error("FFmpeg 변환 오류:", err);
          res.status(500).json({ error: "변환 실패" });
        })
        .run();
    } catch (error) {
      logger.error("upload-webm 핸들러 내부 오류:", error);
      res.status(500).json({ error: "서버 오류 발생" });
    }
  });

  // 다운로드용 엔드포인트 추가 (예시)
  expressApp.get("/download/:filename", (req, res) => {
    const safeName = path.basename(req.params.filename);
    const file = path.join(convertedDir, safeName);
    if (fs.existsSync(file)) {
      res.download(file);
    } else {
      res.status(404).send("파일을 찾을 수 없습니다.");
    }
  });

  expressApp.use((req, res) => {
    res.status(404).send("Not Found");
  });

  // 에러 핸들러
  expressApp.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err?.status ?? (err?.name === "TypeError" ? 400 : 500);
    const message = err?.message ?? "서버 오류";
    logger.warn("Express error:", err);
    res.statusMessage = message;
    res.status(status).type("text/plain").send(message);
  });

  return expressApp;
}

/**
 * Create a Node.js HTTPS server. It listens in the IP and port given in the
 * configuration file and reuses the Express application as request listener.
 */
async function runHttpsServer() {
  logger.info("running an HTTPS server...");

  // HTTPS server for the protoo WebSocket server.
  const tls = config.https.tls && {
    cert: fs.readFileSync(config.https.tls.cert),
    key: fs.readFileSync(config.https.tls.key),
  };

  if (!tls) {
    logger.info("no tls provided in config, fallback to HTTP...");
  }

  httpsServer = tls
    ? https.createServer(tls, expressApp)
    : http.createServer(expressApp);

  await new Promise((resolve) => {
    httpsServer.listen(
      Number(config.https.listenPort),
      config.https.listenIp,
      resolve
    );
  });
}

/**
 * Create a protoo WebSocketServer to allow WebSocket connections from browsers.
 */
async function runProtooWebSocketServer() {
  logger.info("running protoo WebSocketServer...");

  // Create the protoo WebSocket server.
  protooWebSocketServer = new protoo.WebSocketServer(httpsServer, {
    maxReceivedFrameSize: 960000, // 960 KBytes.
    maxReceivedMessageSize: 960000,
    fragmentOutgoingMessages: true,
    fragmentationThreshold: 960000,
  });

  // Handle connections from clients.
  protooWebSocketServer.on("connectionrequest", (info, accept, reject) => {
    // The client indicates the roomId and peerId in the URL query.
    const u = url.parse(info.request.url, true);
    const roomId = u.query["roomId"];
    const peerId = u.query["peerId"];

    if (!roomId || !peerId) {
      reject(400, "Connection request without roomId and/or peerId");

      return;
    }

    let consumerReplicas = Number(u.query["consumerReplicas"]);

    if (isNaN(consumerReplicas)) {
      consumerReplicas = 0;
    }

    logger.info(
      "protoo connection request [roomId:%s, peerId:%s, address:%s, origin:%s]",
      roomId,
      peerId,
      info.socket.remoteAddress,
      info.origin
    );

    // Serialize this code into the queue to avoid that two peers connecting at
    // the same time with the same roomId create two separate rooms with same
    // roomId.
    queue
      .push(async () => {
        const room = await getOrCreateRoom({ roomId, consumerReplicas });

        // Accept the protoo WebSocket connection.
        const protooWebSocketTransport = accept();

        room.handleProtooConnection({ peerId, protooWebSocketTransport });
      })
      .catch((error) => {
        logger.error("room creation or room joining failed:%o", error);

        reject(error);
      });
  });
}

/**
 * Get next mediasoup Worker.
 */
function getMediasoupWorker() {
  const worker = mediasoupWorkers[nextMediasoupWorkerIdx];

  if (++nextMediasoupWorkerIdx === mediasoupWorkers.length)
    nextMediasoupWorkerIdx = 0;

  return worker;
}

/**
 * Get a Room instance (or create one if it does not exist).
 */
async function getOrCreateRoom({ roomId, consumerReplicas }) {
  let room = rooms.get(roomId);

  // If the Room does not exist create a new one.
  if (!room) {
    logger.info("creating a new Room [roomId:%s]", roomId);

    const mediasoupWorker = getMediasoupWorker();

    room = await Room.create({ mediasoupWorker, roomId, consumerReplicas });

    rooms.set(roomId, room);
    room.on("close", () => rooms.delete(roomId));
  }

  return room;
}
