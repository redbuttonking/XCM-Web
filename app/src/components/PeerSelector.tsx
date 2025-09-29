import type { PeerInfo } from '@/store/useRoomStore';

const PeerSelector = ({ peers, selectedPeers, onChange }: PeerSelectorProps) => {
  const togglePeer = (peerId: string) => {
    if (selectedPeers.includes(peerId)) {
      onChange(selectedPeers.filter((id) => id !== peerId));
    } else {
      onChange([...selectedPeers, peerId]);
    }
  };

  return (
    <div>
      <div className="flex text-black">대상 Peer 선택:</div>
      {peers.map((peer) => (
        <label key={peer.id} style={{ display: 'block' }}>
          <input
            type="checkbox"
            checked={selectedPeers.includes(peer.id)}
            onChange={() => togglePeer(peer.id)}
          />
          {peer.displayName}
        </label>
      ))}
    </div>
  );
};

export default PeerSelector;

interface PeerSelectorProps {
  peers: PeerInfo[];
  selectedPeers: string[];
  onChange: (selectedPeers: string[]) => void;
}
