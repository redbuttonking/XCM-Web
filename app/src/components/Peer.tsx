// components/Peer.tsx
import { type PeerInfo } from '@/store/useRoomStore';
import PeerView from './PeerView';
import { ArrowUpRight, UserRound } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import ViewPointers from '../pages/Monitoring/components/ViewPointers';

type ActiveModeType = 'none' | 'message' | 'audio' | 'install' | 'Launch' | 'record' | 'viewGuide';

interface PeerProps {
  peer: PeerInfo;
  variant?: 'multiple' | 'single'; // single = 단일 모니터링 화면용
  selected?: boolean; // 선택 상태 (multiple 전용)
  onToggle?: () => void; // 선택 토글 콜백 (multiple 전용)
  isRecording?: boolean; // 녹화 상태
  activeMode?: ActiveModeType;
  setActiveMode?: (mode: ActiveModeType) => void;
}

// 버튼 클릭시 해당 peer의 단일 모니터링으로 넘어가기

const Peer = ({
  peer,
  variant = 'multiple',
  selected = false,
  onToggle,
  isRecording = false,
  activeMode,
  setActiveMode,
}: PeerProps) => {
  const navigate = useNavigate();
  const isSingle = variant === 'single';

  // 선택된 peer에만 적용할 테두리 스타일
  const borderStyle = selected ? 'border-2 border-blue' : 'border border-[#F0F0F0]';

  console.log('여기다아아아아아아아아아아', peer);

  // 클릭 핸들러 (단일 모니터링 화면에서는 무시)
  const handleClick = () => {
    if (!isSingle && onToggle) {
      onToggle();
    }
  };

  return (
    <div
      className={[
        borderStyle,
        'shadow-md4 rounded-2xl border-2 border-[#F0F0F0] text-[#444444] shadow-xl',
        isSingle
          ? // 단일 모니터링일 경우
            'flex w-full max-w-[1600px] flex-col overflow-hidden p-4'
          : 'p-2',
      ].join(' ')}
      onClick={handleClick}
      role={!isSingle ? 'button' : undefined}
      tabIndex={!isSingle ? 0 : undefined}
      aria-pressed={!isSingle ? selected : undefined}
    >
      <div
        className={[
          'flex justify-between',
          isSingle ? 'pb-3 pt-2' : 'mx-[5px] pb-[10px] pt-[6px]',
        ].join(' ')}
      >
        <div className="flex items-center">
          <UserRound color="#444444" />
          <h3
            className={
              isSingle
                ? 'ml-2 flex items-center text-sm md:text-base'
                : 'ml-[10px] flex items-center text-xs'
            }
          >
            {peer.displayName}
            {isRecording && (
              <span className="ml-2 flex items-center rounded-full bg-black px-2 py-0">
                <span className="mr-2 flex items-center">
                  <span className="relative flex h-3 w-3 items-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-70"></span>
                    <span className="relative inline-flex h-[10px] w-[10px] rounded-full bg-red"></span>
                  </span>
                </span>
                <span className="text-base font-bold tracking-wide text-white">REC</span>
              </span>
            )}
          </h3>
        </div>
        {!isSingle && (
          <Button
            className="h-[20px] w-[20px] p-[8px]"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              navigate({ pathname: '/', search: `?peer=${peer.id}` });
            }}
          >
            <ArrowUpRight className="m-0 p-0" color="#374151" />
          </Button>
        )}
      </div>
      {/* 단일 화면에서는 PeerView 영역을 더 크게 */}
      <div className={isSingle ? 'h-full w-full' : ''}>
        <PeerView
          peerId={peer.id}
          videoTrack={peer.videoTrack}
          audioTrack={peer.audioTrack}
          variant={isSingle ? 'fill' : 'multiple'}
          activeMode={activeMode}
          setActiveMode={setActiveMode}
        />
      </div>
    </div>
  );
};

export default Peer;
