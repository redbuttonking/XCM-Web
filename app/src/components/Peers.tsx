// components/Peers.tsx
import { useRoomStore } from '@/store/useRoomStore';
import Peer from './Peer';
import EmptySlot from './EmptySlot';
import { useEffect, useMemo } from 'react';

const Peers = () => {
  // peers의 배열을 15개로 고정
  const totalSlots = 15;

  // UI 작업 후 주석 제거
  const allPeers = useRoomStore((state) => state.peers);
  const myPeerId = useRoomStore((state) => state.peerId);

  // 내 자신 제외한 peers 계산을 메모이즈
  const peers = useMemo(() => {
    return allPeers.filter((peer) => peer.id !== myPeerId);
  }, [allPeers, myPeerId]);

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

  const fixedPeers = useMemo(() => {
    return Array.from({ length: totalSlots }, (_, i) => peers[i] ?? null);
  }, [peers]);

  useEffect(() => {
    console.log('fixedPeers:', fixedPeers);
  }, [fixedPeers]);

  return (
    <div className="grid grid-cols-5 gap-4">
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
