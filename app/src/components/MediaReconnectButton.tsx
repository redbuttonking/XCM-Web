// components/MediaReconnectButton.tsx
import { useRoomStore } from '@/store/useRoomStore';
import { Button } from '@/components/ui/button'; // Shadcn 쓰는 경우
import { useState } from 'react';

const MediaReconnectButton = () => {
  const roomClient = useRoomStore((state) => state.roomClient);
  const [loading, setLoading] = useState(false);

  const handleReconnect = async () => {
    if (!roomClient) return;

    try {
      setLoading(true);
      await roomClient.request('resyncMedia'); // 서버에 커스텀 메시지 요청
      console.log('[MediaReconnectButton] 미디어 재연결 요청 완료');
    } catch (err) {
      console.error('[MediaReconnectButton] 미디어 재연결 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleReconnect} disabled={loading}>
      {loading ? '재연결 중...' : '미디어 연결하기'}
    </Button>
  );
};

export default MediaReconnectButton;
