// components/Room.tsx
import { useEffect } from 'react';
import Me from './Me';
import Peers from './Peers';
import { useRoomStore } from '@/store/useRoomStore';
import RoomClient from '../core/RoomClient';
import { v4 as uuidv4 } from 'uuid';
import MediaReconnectButton from './MediaReconnectButton';

const Room = () => {
  const joined = useRoomStore((state) => state.joined);

  useEffect(() => {
    const store = useRoomStore.getState();
    if (store.roomClient) return;

    // const roomId = uuidv4(); // roomId도 랜덤 생성
    const roomId = 'monitoringRoom'; // 임시 고정
    const peerId = uuidv4();
    const displayName = '테스트 네임';

    const client = new RoomClient({
      roomId,
      peerId,
      displayName,
      forceTcp: false,
    });

    store.setRoomClient(client);

    client
      .join()
      .then(() => {
        store.setJoined(true);
        console.log(
          `[Room.tsx] 방 입장 성공! roomId: ${roomId}, peerId: ${peerId}, name: ${displayName}`,
        );
      })
      .catch((err) => {
        console.error('[Room.tsx] 방 입장 실패:', err);
        store.setJoined(false);
      });

    return () => {
      client.close();
      store.resetRoom();
    };
  }, []);

  if (!joined) return <div className="text-center text-gray-500">방에 참여 중입니다...</div>;

  return (
    <div className="flex h-screen w-full flex-col bg-black text-white">
      <MediaReconnectButton />
      <div className="grid flex-1 grid-cols-2 gap-4 p-4">
        <Me />
        <Peers />
      </div>
    </div>
  );
};

export default Room;
