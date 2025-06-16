// components/Peer.tsx
import { useRoomStore, type PeerInfo } from '@/store/useRoomStore';
import PeerView from './PeerView';

interface PeerProps {
  peer: PeerInfo;
}

const Peer = ({ peer }: PeerProps) => {
  return (
    <div className="rounded-xl bg-gray-800 p-2 shadow-md">
      <h3 className="mb-1 truncate text-center text-xs">{peer.displayName}</h3>
      <PeerView videoTrack={peer.videoTrack} audioTrack={peer.audioTrack} />
    </div>
  );
};

export default Peer;
