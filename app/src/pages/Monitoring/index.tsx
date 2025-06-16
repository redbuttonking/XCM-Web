import React, { useEffect, useRef } from 'react';
import RoomClient from '@/core/RoomClient';
import MediaReconnectButton from '@/components/MediaReconnectButton';
import Peers from '@/components/Peers';
import { useRoomStore } from '@/store/useRoomStore';
import { v4 as uuidv4 } from 'uuid';
const Monitoring = () => {
  const joined = useRoomStore((state) => state.joined);

  // 내 비디오 UI 보이기
  // const [isMyVideo, setIsMyVideo] = useState(true);

  // const showMyVideo = () => {
  //   if (isMyVideo) {
  //     setIsMyVideo(false);
  //   } else {
  //     setIsMyVideo(true);
  //   }
  // };

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
      .then(async () => {
        store.setJoined(true);
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
    <div className="flex h-full w-full flex-col text-white">
      <div className="flex justify-center gap-1">
        <MediaReconnectButton />

        {/* 내 비디오 핸들 버튼 */}
        {/* <Button onClick={showMyVideo} className="flex justify-center p-2">
          {isMyVideo ? '내 영상 닫기' : '내 영상 보이기'}
        </Button> */}
      </div>
      {/* 내 비디오 */}
      {/* {isMyVideo ? <Me /> : ''} */}

      <div className="flex-1 overflow-hidden p-4">
        <Peers />
      </div>
    </div>
  );
};

export default Monitoring;
