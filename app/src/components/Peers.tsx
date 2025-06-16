// components/Peers.tsx
import { useRoomStore } from '@/store/useRoomStore';
import Peer from './Peer';
import EmptySlot from './EmptySlot';

const Peers = () => {
  // const myPeerId = useRoomStore.getState(); // RoomClient 생성 시 저장된 내 ID
  // const peers = useRoomStore(
  //   (state) => state.peers.filter((peer) => peer.id !== myPeerId.roomClient._peerId), // ✅ 내 peer는 제외
  // );

  // UI 작업 후 주석 제거
  const allPeers = useRoomStore((state) => state.peers);
  const peerId = useRoomStore((state) => state.peerId);
  const peers = allPeers.filter((peer) => peer.id !== peerId);

  // peer 가 없을 때 Ui (text만 나옴)
  // if (peers.length === 0)
  //   return <div className="text-center text-gray-400">다른 참가자가 없습니다</div>;

  // Ui 목데이터
  // const peers = [
  //   {
  //     id: `1`,
  //     displayName: '홍길동1',
  //   },
  //   {
  //     id: `2`,
  //     displayName: '홍길동2',
  //   },
  //   {
  //     id: `3`,
  //     displayName: '홍길동3',
  //   },
  //   {
  //     id: `4`,
  //     displayName: '홍길동4',
  //   },
  //   {
  //     id: `5`,
  //     displayName: '홍길동5',
  //   },
  //   {
  //     id: `6`,
  //     displayName: '홍길동6',
  //   },
  //   {
  //     id: `7`,
  //     displayName: '홍길동7',
  //   },
  //   {
  //     id: `8`,
  //     displayName: '홍길동8',
  //   },
  //   {
  //     id: `9`,
  //     displayName: '홍길동9',
  //   },
  //   {
  //     id: `10`,
  //     displayName: '홍길동10',
  //   },
  //   {
  //     id: `11`,
  //     displayName: '홍길동11',
  //   },
  //   {
  //     id: `12`,
  //     displayName: '홍길동12',
  //   },
  //   {
  //     id: `13`,
  //     displayName: '홍길동13',
  //   },
  //   {
  //     id: `14`,
  //     displayName: '홍길동14',
  //   },
  //   {
  //     id: `15`,
  //     displayName: '홍길동15',
  //   },
  // ];

  const totalSlots = 15;

  // peers의 배열을 15개로 고정
  const fixedPeers = Array.from({ length: totalSlots }).map((_, i) => peers[i] ?? null);

  return (
    // <div className="grid grid-cols-2 gap-4">
    //   {peers.map((peer) => (
    //     <div key={peer.id}>
    //       <div>{peer.id}</div>
    //       <Peer key={peer.id} peer={peer} />
    //     </div>
    //   ))}
    // </div>

    // UI 스타일링 목업 코드
    <div className="grid grid-cols-5 gap-4">
      {/* {peers.map((peer) => (
        <div key={peer.id}>
          <div>{peer.id}</div>
          <Peer key={peer.id} peer={peer} />
        </div>
      ))} */}

      {fixedPeers.map((peer, index) => (
        <div key={index}>
          {peer ? (
            <Peer peer={peer} />
          ) : (
            // 빈 자리일 때의 placeholder UI
            <EmptySlot />
          )}
        </div>
      ))}
    </div>
  );
};

export default Peers;
