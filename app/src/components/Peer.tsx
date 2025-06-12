// components/Peer.tsx
import { useRoomStore, type PeerInfo } from '@/store/useRoomStore';
import PeerView from './PeerView';

interface PeerProps {
  peer: PeerInfo;
}

const Peer = ({ peer }: PeerProps) => {
  console.log('peer의 값 : ', peer);
  console.log('peer.videoTrack: ', peer.videoTrack);
  console.log('peer.audioTrack: ', peer.audioTrack);

  return (
    <div className="rounded-lg bg-gray-700 p-2">
      <h3 className="mb-1 text-sm">{peer.displayName}</h3>
      <PeerView videoTrack={peer.videoTrack} audioTrack={peer.audioTrack} />
    </div>
  );
};

export default Peer;
