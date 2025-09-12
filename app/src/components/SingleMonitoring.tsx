// pages/SingleMonitoring.tsx
import { useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useRoomStore } from '@/store/useRoomStore';
import Peer from '@/components/Peer';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SingleMonitoring = () => {
  const { peerId } = useParams<{ peerId: string }>();
  const navigate = useNavigate();
  const peers = useRoomStore((s) => s.peers);

  const peer = useMemo(() => peers.find((p) => p.id === peerId), [peers, peerId]);

  console.log(peer);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
        >
          <ArrowLeft size={16} />
          뒤로
        </Button>

        {/* 히스토리가 없을 때를 대비한 목록 바로가기 */}
        <Link
          to="/"
          className="text-sm text-gray-500 underline decoration-dotted underline-offset-4"
        >
          전체 모니터링으로
        </Link>
      </div>

      {!peer ? (
        <div className="flex h-full flex-col items-center justify-center rounded-xl border bg-white p-8 text-center">
          <p className="text-gray-700">
            선택한 기기가 현재 방에 없어요.
            <br />
            잠시 후 새로고침하거나 전체 모니터링으로 돌아가 주세요.
          </p>
          <Link to="/">
            <Button className="mt-4">전체 모니터링 보기</Button>
          </Link>
        </div>
      ) : (
        <div className="flex-1">
          <Peer peer={peer} variant="single" />
        </div>
      )}
    </div>
  );
};

export default SingleMonitoring;
