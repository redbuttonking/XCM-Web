// node.js의 파일 시스템 모듈 , .pem 파일(인증서, 키)을 읽기 위해 사용
const fs = require('fs');

// node.js에서 HTTPS 서버를 만들기 위한 모듈
const https = require('https');

// node.js에서 서버를 쉽게 만드는 라이브러리
const express = require('express');

// WebSocket 서버를 만드는 라이브러리
// const { WebSocketServer } = require('ws');

// WebSocket 시그널링 서버 라이브러리
const protoo = require('protoo-server');

const { getOrCreateRoom } = require('./roomManager');

const app = express();

app.use((req, res, next) => {
  // CSP 헤더 완화
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' wss://localhost:4000");
  next();
});

app.get('/', (req, res) => {
  res.send('<h1>Mediasoup Signaling Server Running</h1>');
});

// https 서버를 만들기 위해 인증서를 불러옴
// 이걸 통해 서버를 신뢰할 수 있는 보안 연결로 띄움
const httpsOptions = {
  key: fs.readFileSync('../server/config/localhost+2-key.pem'),
  cert: fs.readFileSync('../server/config/localhost+2.pem'),
};

const httpsServer = https.createServer(httpsOptions, app);
const PORT = 4000;

httpsServer.on('request', (req, res) => {
  console.log('📩 HTTP(S) 요청 도착:', req.url);
});

httpsServer.on('upgrade', (req, socket, head) => {
  console.log('🧩 WebSocket 업그레이드 요청 도착:', req.url);
});

// 같은 HTTPS 서버 위에서 실행
// const wsServer = new WebSocketServer({ server });

// ProtooServer는 protoo 라이브러리가 제공하는 webSokect 시그널링 서버
// protoo 시그널링 서버 생성 / HTTP(S) 서버 객체를 직접 넘겨야 함
const protooServer = new protoo.WebSocketServer(httpsServer, {
  maxReceivedFrameSize: 960000,
  maxReceivedMessageSize: 960000,
  fragmentOutgoingMessages: true,
  fragmentationThreshold: 960000,
});

// 디버깅 로그
console.log('🚀 protooServer created:', !!protooServer);
console.log('🧪 protooServer .on available?', typeof protooServer.on);

// .on은 어떤 이벤트가 발생했을 때 실행할 함수를 등록하는 것.
// 여기서는 누군가가 websocket으로 wss://localhost:3001/?roomId=xxx&peerId=yyy 로 접속시도하면
// connectionrequest 이벤트가 자동으로 발생하고 내가 등록한 함수가 실행됨
protooServer.on('connectionrequest', (info, accept, reject) => {
  const url = new URL(info.request.url, `https://${info.request.headers.host}`);
  const roomId = url.searchParams.get('roomId');
  const peerId = url.searchParams.get('peerId');

  // 해당 두 값이 없을때 함수 종료
  if (!roomId || !peerId) {
    reject(400, 'roomId or peerId가 없음');
    return;
  }

  console.log(`새로운 peer request → roomId: ${roomId}, peerId: ${peerId}`);

  const room = getOrCreateRoom(roomId);
  const transport = accept();
  room.addPeer({ peerId, transport });

  console.log('🚦 transport.on 등록됨:', peerId);
  transport.on('request', async (request, accept, reject) => {
    // 왜 아래 콘솔이 안찍힐까나..
    console.log('★★ request 객체:', request);
    const method = request.method;
    const data = request.data;

    console.log('시그널링 요청', method, data);

    if (method === 'join') {
      accept({ joined: true });
      console.log(`✅ ${peerId}가 join 요청 보냄 → 응답 완료`);
    } else {
      reject(400, '알 수 없는 요청');
    }
  });
});

httpsServer.listen(PORT, () => {
  console.log(`https server https://localhost:${PORT} 에서 실행중`);
});
