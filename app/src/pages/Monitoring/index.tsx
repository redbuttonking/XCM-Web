// src/pages/Monitoring/index.tsx 초기 버전

// import React, { useEffect, useRef } from 'react';
// import RoomClient from '@/core/RoomClient';

// const wsUrl = 'wss://localhost:4443/?roomId=monitoringRoom&peerId=peer1';

// const joinPayload = {
//   displayName: '현수',
//   device: {
//     flag: 'browser',
//     name: 'Chrome',
//     version: '124.0.0.0',
//     platform: 'desktop',
//   },
//   // 최소 구조: mediasoup Device 없이 테스트하려면 빈 배열들!
//   rtpCapabilities: {
//     codecs: [],
//     headerExtensions: [],
//     fecMechanisms: [],
//   },
//   // (필요하면 sctpCapabilities 등 추가)
// };

// const Monitoring = () => {
//   // peer 객체를 ref로 보관(추후 종료/추가 통신용)
//   const peerRef = useRef(null);

//   useEffect(() => {
//     // 연결 및 join 요청!
//     peerRef.current = connectAndJoinProtoo({
//       wsUrl,
//       payload: joinPayload,
//       onOpen: (resp) => {
//         // join 성공 시 (resp에는 서버에서 내려주는 peers 등 있음)
//         console.log('방에 입장 완료!', resp);
//       },
//       onClose: () => {
//         // 연결 종료 시
//         console.log('연결이 닫힘');
//         console.log('확실히 연결이 닫힌거 맞나?');
//       },
//       onNotification: (notification) => {
//         // 서버가 notification을 보낼 때
//         console.log('서버 알림:', notification);
//       },
//     });
//     console.log(peerRef.current._transport);

//     // unmount 시 연결 닫기
//     return () => {
//       if (peerRef.current) peerRef.current.close();
//     };
//   }, []);

//   return (
//     <div>
//       <h2>모니터링 페이지</h2>
//       <h2>mediasoup signaling 테스트</h2>
//     </div>
//   );
// };

// export default Monitoring;

import React, { useEffect, useRef } from 'react';
import RoomClient from '@/core/RoomClient';

const Monitoring = () => {
  const roomClientRef = useRef<RoomClient | null>(null);

  useEffect(() => {
    const roomId = 'monitoringRoom';
    const peerId = 'peer1';
    const displayName = '현수';

    const client = new RoomClient({ roomId, peerId, displayName });
    roomClientRef.current = client;

    client.join();

    return () => {
      client.close();
    };
  }, []);

  return (
    <div>
      <h2>모니터링 페이지</h2>
      <h2>mediasoup signaling 테스트</h2>
    </div>
  );
};

export default Monitoring;
