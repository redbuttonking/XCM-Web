// lib/StatusHub.js
const Logger = require("./Logger");
const logger = new Logger("StatusHub");

/**
 * StatusHub
 * - 단말이 보낸 DataChannel(label: "status")을 서버가 직접 consume
 * - SSID/BSSID 기반 위치 가공(WifiGeoService.lookup) 후
 * - 서버발 DataProducer(label: "status.enriched")로 관리자에게 브로드캐스트
 *
 * 사용 방법
 * 1) Room.create(...)에서: const statusHub = await StatusHub.create({ mediasoupRouter, wifiGeoService, createDataConsumerFn: args => room._createDataConsumer(args), getJoinedPeersFn: (...)=>(room._getJoinedPeers(...)) })
 * 2) join/transport 생성 시 관리자 Peer에는 statusHub.wireOutToPeer(peer) 호출(가공 스트림 구독 연결)
 * 3) produceData(label==="status")를 받은 순간: statusHub.attachDeviceStatusProducer({ dataProducerFromDevice: dataProducer, fromPeer: peer })
 */
class StatusHub {
  /**
   * @param {Object} deps
   * @param {mediasoup.Router} deps.mediasoupRouter
   * @param {Object} deps.wifiGeoService - WifiGeoService 인스턴스(옵션)
   * @param {Function} deps.createDataConsumerFn - Room._createDataConsumer 바인딩(옵션)
   *   - 시그니처: ({ dataConsumerPeer, dataProducerPeer, dataProducer }) => Promise<void>
   * @param {Function} deps.getJoinedPeersFn - Room._getJoinedPeers 바인딩(옵션)
   */
  static async create({
    mediasoupRouter,
    wifiGeoService,
    createDataConsumerFn,
    getJoinedPeersFn,
  }) {
    // 서버 내부용 DirectTransport 생성
    const direct = await mediasoupRouter.createDirectTransport({});

    // 서버발(DataProducer) - 가공된 상태를 모든 관리자에게 브로드캐스트할 채널
    // DirectTransport에서는 sctpStreamParameters 불필요
    const outDataProducer = await direct.produceData({
      label: "status.enriched",
      protocol: "",
      appData: { from: "status-hub" },
    });

    logger.info(
      'StatusHub ready (out label: "status.enriched", dataProducerId:%s)',
      outDataProducer.id
    );

    return new StatusHub({
      direct,
      outDataProducer,
      wifiGeoService,
      createDataConsumerFn,
      getJoinedPeersFn,
    });
  }

  constructor({
    direct,
    outDataProducer,
    wifiGeoService,
    createDataConsumerFn,
    getJoinedPeersFn,
  }) {
    this._direct = direct;
    this._out = outDataProducer;
    this._geo = wifiGeoService || null;

    // Room의 헬퍼를 주입받으면 브로드캐스트(wireOut) 자동화 가능
    this._createDataConsumer =
      typeof createDataConsumerFn === "function" ? createDataConsumerFn : null;
    this._getJoinedPeers =
      typeof getJoinedPeersFn === "function" ? getJoinedPeersFn : null;

    // 이미 서버가 consume한 단말 status DataProducer를 관리(중복 방지)
    this._attached = new Map(); // key: dataProducerId, val: { dc, fromPeerId }
  }

  /**
   * 관리자 Peer에게 서버발 "status.enriched" 스트림을 연결
   * (Room에서 peer가 join/consuming transport 생성될 때 호출)
   */
  async wireOutToPeer(peer) {
    try {
      if (!peer?.data?.joined) return;
      if (peer?.data?.role !== "admin") return;
      if (!this._createDataConsumer) {
        // 주입이 안 되어 있으면 Room이 따로 붙여주지 않는 이상 skip
        logger.debug("wireOutToPeer: createDataConsumerFn not provided, skip");
        return;
      }

      await this._createDataConsumer({
        dataConsumerPeer: peer,
        dataProducerPeer: null, // 서버발
        dataProducer: this._out,
      });

      logger.debug(
        'wired "status.enriched" to admin peer [peerId:%s]',
        peer.id
      );
    } catch (e) {
      logger.warn("wireOutToPeer failed:", e);
    }
  }

  /**
   * 현재 조인된 모든 관리자에게 서버발 "status.enriched" 브로드캐스트 연결
   * (옵션) 특정 타이밍에 일괄 보장하고 싶을 때 호출
   */
  async wireOutToAllAdmins() {
    if (!this._getJoinedPeers || !this._createDataConsumer) return;
    const peers = this._getJoinedPeers() || [];
    for (const p of peers) {
      if (p?.data?.role === "admin") {
        await this.wireOutToPeer(p);
      }
    }
  }

  /**
   * 단말이 보낸 status DataProducer(웹RTC)를 서버 DirectTransport로 consume
   * @param {Object} args
   * @param {mediasoup.DataProducer} args.dataProducerFromDevice
   * @param {protoo.Peer} args.fromPeer
   */
  async attachDeviceStatusProducer({ dataProducerFromDevice, fromPeer }) {
    const pid = dataProducerFromDevice?.id;
    if (!pid) return;
    if (this._attached.has(pid)) return; // 이미 연결됨

    try {
      const dc = await this._direct.consumeData({
        dataProducerId: pid,
      });

      this._attached.set(pid, { dc, fromPeerId: fromPeer?.id });

      dc.on("dataproducerclose", () => {
        this._attached.delete(pid);
        try {
          dc.close();
        } catch {}
        logger.debug(
          "status device producer closed -> hub detached [producerId:%s]",
          pid
        );
      });

      dc.on("transportclose", () => {
        this._attached.delete(pid);
        try {
          dc.close();
        } catch {}
        logger.debug(
          "status device transport closed -> hub detached [producerId:%s]",
          pid
        );
      });

      dc.on("message", (msg) => {
        // 메시지는 Buffer일 수 있음
        (async () => {
          try {
            const text =
              Buffer.isBuffer(msg) || msg instanceof Uint8Array
                ? Buffer.from(msg).toString("utf8")
                : String(msg);
            const obj = JSON.parse(text);

            const wifi = obj?.wifi || {};
            const ssid = wifi?.ssid ?? obj?.ssid ?? null;
            const bssid = wifi?.bssid ?? obj?.bssid ?? null;

            if (typeof bssid === "string") {
              const lower = bssid.toLowerCase();
              bssid = lower.replace(/[^0-9a-f]/g, ""); // 콜론/하이픈 제거
            }

            const rssiDbm =
              typeof wifi?.rssiDbm === "number"
                ? wifi.rssiDbm
                : typeof obj?.rssiDbm === "number"
                ? obj.rssiDbm
                : null;

            // 위치 가공(있으면)
            let enrich = null;
            if (this._geo) {
              try {
                enrich = await this._geo.lookup({ ssid, bssid, rssiDbm });
              } catch (ge) {
                logger.warn("geo lookup error:", ge?.message || ge);
              }
            }

            const enriched = {
              type: "status.summary.push",
              peerId: fromPeer?.id ?? null,
              ts: obj?.ts ?? Date.now(),
              payload: {
                ...obj,
                placeLabel: enrich?.placeLabel ?? null,
                geoCity: enrich?.geoCity ?? null,
                geo: enrich?.geo ?? null,
                wifi: {
                  ssid,
                  bssid,
                  rssiDbm,
                  linkSpeedMbps:
                    wifi?.linkSpeedMbps ?? obj?.linkSpeedMbps ?? null,
                },
                geoSource: enrich?.source ?? null,
                geoAccuracy: enrich?.accuracy ?? null,
              },
            };

            // 서버발 DataProducer로 브로드캐스트
            try {
              this._out.send(JSON.stringify(enriched));
            } catch (se) {
              logger.warn("send enriched failed:", se?.message || se);
            }
          } catch (e) {
            logger.warn("status message parse/enrich failed:", e?.message || e);
          }
        })();
      });

      logger.info(
        "attached device status → hub [fromPeer:%s, dataProducerId:%s]",
        fromPeer?.id,
        pid
      );
    } catch (e) {
      logger.warn("attachDeviceStatusProducer failed:", e?.message || e);
    }
  }

  get dataProducer() {
    return this._out;
  }

  close() {
    for (const { dc } of this._attached.values()) {
      try {
        dc.close();
      } catch {}
    }
    this._attached.clear();

    try {
      this._out?.close();
    } catch {}
    try {
      this._direct?.close();
    } catch {}

    logger.info("StatusHub closed");
  }
}

module.exports = StatusHub;
