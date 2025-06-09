// components/Peer.tsx
import { useRoomStore, type PeerInfo } from '@/store/useRoomStore';
import PeerView from './PeerView';

interface PeerProps {
  peer: PeerInfo;
}

const Peer = ({ peer }: PeerProps) => {
  return (
    <div className="rounded-lg bg-gray-700 p-2">
      <h3 className="mb-1 text-sm">{peer.displayName}</h3>
      <PeerView videoTrack={peer.videoTrack} micTrack={peer.micTrack} />
    </div>
  );
};

export default Peer;
