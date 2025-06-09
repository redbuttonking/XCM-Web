// components/Peers.tsx
import { useRoomStore } from '@/store/useRoomStore';
import Peer from './Peer';

const Peers = () => {
  // const myPeerId = useRoomStore.getState(); // RoomClient 생성 시 저장된 내 ID
  // const peers = useRoomStore(
  //   (state) => state.peers.filter((peer) => peer.id !== myPeerId.roomClient._peerId), // ✅ 내 peer는 제외
  // );
  const allPeers = useRoomStore((state) => state.peers);
  const peerId = useRoomStore((state) => state.peerId);

  const peers = allPeers.filter((peer) => peer.id !== peerId);

  console.log('참가자 인원수 : ', peers);
  console.log('나의 peer Id 정보 : ', peerId);

  if (peers.length === 0)
    return <div className="text-center text-gray-400">다른 참가자가 없습니다</div>;

  return (
    <div className="grid grid-cols-2 gap-4">
      {peers.map((peer) => (
        <div key={peer.id}>
          <div>{peer.id}</div>
          <Peer key={peer.id} peer={peer} />
        </div>
      ))}
    </div>
  );
};

export default Peers;
