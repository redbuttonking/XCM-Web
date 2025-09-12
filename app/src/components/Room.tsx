// import { useEffect, useState } from 'react';
// import Me from './Me';
// import Peers from './Peers';
// import { useRoomStore, type RoomState } from '@/store/useRoomStore';
// import RoomClient from '../core/RoomClient';
// import { v4 as uuidv4 } from 'uuid';
// import { Button } from './ui/button';
// import NotificationsContainer from './NotificationsContainer';
// import InstallForm from './InstallForm';
// import { useShallow } from 'zustand/shallow';
// import AudioPlayForm from './AudioPlayForm';
// import ChatInput from './ChatInput';
// import PeerSelector from './PeerSelector';
// import LaunchAppForm from './LanchAppForm';

// // components/Room.tsx
// const Room = () => {
//   const joined = useRoomStore((state) => state.joined);
//   const roomClient = useRoomStore((state) => state.roomClient);

//   // 메시지 전송 , 오디오 재생 , apk 설치 상태 변수
//   const [activeMode, setActiveMode] = useState<'none' | 'message' | 'audio' | 'install' | 'Launch'>(
//     'none',
//   );
//   // 선택된 peer의 상태를 일관되게 관리 하는 변수
//   const [selectedPeers, setSelectedPeers] = useState<string[]>([]);

//   // 현재 Room에 있는 peer들의 정보
//   const peers = useRoomStore(
//     useShallow((state: RoomState) => state.peers), // peers 전체 배열 (id, displayName 등 포함)
//   );
//   // 현재 Room에 있는 peer id 배열
//   const peerIds = useRoomStore(
//     useShallow((state: RoomState) => state.peers.map((p) => p.id)), // ✅ shallow 방식으로 선택
//   );

//   // 내 비디오 UI 보이기
//   const [isMyVideo, setIsMyVideo] = useState(true);

//   const showMyVideo = () => {
//     if (isMyVideo) {
//       setIsMyVideo(false);
//     } else {
//       setIsMyVideo(true);
//     }
//   };

//   // apk 설치 함수
//   const handleInstallApk = (selectedPeers: string[], apkName: string, apkUrl: string) => {
//     const roomClient = useRoomStore.getState().roomClient;
//     roomClient?.sendInstallApk(selectedPeers, apkName, apkUrl);
//   };

//   // 오디오 재생 함수
//   const handleAudioPlay = (payload: AudioPayload) => {
//     const client = useRoomStore.getState().roomClient;
//     if (!client) return;

//     if (payload.type === 'play_audio') {
//       if (payload.filename) {
//         client.sendAudioPlayByName(payload.targetPeerIds, payload.filename, payload.title);
//       } else if (payload.uri) {
//         client.sendAudioPlayByUri(payload.targetPeerIds, payload.uri, payload.title);
//       } else {
//         console.warn('play_audio payload에 filename 또는 uri가 필요합니다.');
//       }
//     } else if (payload.type === 'stop_audio') {
//       client.sendAudioStop(payload.targetPeerIds);
//     }
//   };

//   // 메시지 전송 함수
//   const handleSendMessage = async (msg: string) => {
//     if (!roomClient) {
//       console.warn('RoomClient가 존재하지 않습니다.');
//       return;
//     }
//     if (selectedPeers.length === 0) {
//       alert('메시지 보낼 대상을 선택하세요.');
//       return;
//     }
//     await roomClient.sendChatMessageToPeers(selectedPeers, msg);
//   };

//   // launch_app 전송 함수
//   const handleLaunchApp = (payload: LaunchAppPayload) => {
//     const client = useRoomStore.getState().roomClient;
//     if (!client) return;

//     client.sendLaunchApp(payload.targetPeerIds, {
//       pkg: payload.pkg, // 패키지명 (알고 있으면 가장 정확)
//       label: payload.label, // 앱 라벨 (아이콘에 보이는 이름)
//       apkName: payload.apkName, // 설치 시의 원본 파일명 (또는 확장자 없는 이름)
//       activity: payload.activity, // 필요시 명시 액티비티
//     });
//   };

//   useEffect(() => {
//     const store = useRoomStore.getState();
//     if (store.roomClient) return;

//     // const roomId = uuidv4(); // roomId 랜덤 생성
//     // const peerId = uuidv4(); // peerId도 랜덤 생성
//     const roomId = 'monitoringRoom'; // 임시 고정
//     const peerId = 'admin-web'; // 임시로 관리자 id 지정(웹에서만 접근을 할태니) , 나중에 서버에서 로그인 했을때 받는 id값을 여기에 넣어주기

//     // const displayName = '테스트 네임';
//     const displayName = '알림123';

//     const client = new RoomClient({
//       roomId,
//       peerId,
//       displayName,
//       forceTcp: false,
//     });

//     store.setRoomClient(client);

//     client
//       .join()
//       .then(async () => {
//         store.setJoined(true);
//       })
//       .catch((err) => {
//         console.error('[Room.tsx] 방 입장 실패:', err);
//         store.setJoined(false);
//       });

//     return () => {
//       client.close();
//       store.resetRoom();
//     };
//   }, []);

//   // 방에 들어온 peer의 상태 업데이트
//   useEffect(() => {
//     setSelectedPeers((prevSelected) => prevSelected.filter((id) => peerIds.includes(id)));
//   }, [peerIds]);

//   if (!joined) return <div className="text-center text-gray-500">방에 참여 중입니다...</div>;

//   return (
//     <div className="flex h-full w-full flex-col text-white">
//       <div className="flex justify-center gap-1">
//         {/* 내 비디오 핸들 버튼 */}
//         <Button onClick={showMyVideo} className="flex justify-center p-2">
//           {isMyVideo ? '내 영상 닫기' : '내 영상 보이기'}
//         </Button>
//       </div>

//       {/* 내 비디오 */}
//       {isMyVideo ? (
//         <>
//           <Me />

//           <div>
//             <button
//               className="rounded bg-emerald-200 px-4 py-2 text-black"
//               onClick={() => setActiveMode('message')}
//             >
//               메시지 보내기
//             </button>
//             <button
//               className="rounded bg-emerald-200 px-4 py-2 text-black"
//               onClick={() => setActiveMode('audio')}
//             >
//               오디오 재생
//             </button>
//             <button
//               className="rounded bg-emerald-200 px-4 py-2 text-black"
//               onClick={() => setActiveMode('install')}
//             >
//               APK 설치
//             </button>
//             <button
//               className="rounded bg-emerald-200 px-4 py-2 text-black"
//               onClick={() => setActiveMode('Launch')}
//             >
//               APP 실행
//             </button>
//           </div>

//           <div className="text-black">
//             <PeerSelector peers={peers} selectedPeers={selectedPeers} onChange={setSelectedPeers} />
//           </div>

//           <div className="my-[15px] flex items-center">
//             {/* {activeMode === 'install' && (
//               <InstallForm peerIds={selectedPeers} onSubmit={handleInstallApk} />
//             )}
//             {activeMode === 'audio' && (
//               <AudioPlayForm peerIds={selectedPeers} sendJson={handleAudioPlay} />
//             )}
//             {activeMode === 'message' && (
//               <ChatInput
//                 peerIds={selectedPeers}
//                 onSend={handleSendMessage}
//                 disabled={!roomClient}
//               />
//             )}
//             {activeMode === 'Launch' && (
//               <LaunchAppForm peerIds={selectedPeers} sendJson={handleLaunchApp} />
//             )} */}
//           </div>
//         </>
//       ) : (
//         ''
//       )}

//       <div className="flex-1 overflow-hidden">{/* <Peers /> */}</div>

//       {/* 메시지 알림 UI */}
//       {/* <div className="absolute bottom-4 right-4 z-50 text-black">
//         <NotificationsContainer />
//       </div> */}
//     </div>
//   );
// };

// type AudioPayload =
//   | {
//       type: 'play_audio';
//       targetPeerIds: string[];
//       title?: string;
//       filename: string; // 파일명으로 재생
//       uri?: never;
//     }
//   | {
//       type: 'play_audio';
//       targetPeerIds: string[];
//       title?: string;
//       uri: string; // uri 형태로 재생
//       filename?: never;
//     }
//   | {
//       type: 'stop_audio';
//       targetPeerIds: string[];
//     };

// type LaunchAppPayload = {
//   type: 'launch_app';
//   targetPeerIds: string[];
//   pkg?: string;
//   label?: string;
//   apkName?: string;
//   activity?: string;
// };

// export default Room;
