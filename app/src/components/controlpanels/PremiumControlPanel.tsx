import { useMemo } from 'react';
import { Mail, Cog, Move } from 'lucide-react';
import { useRecordingMultiStore } from '@/store/useRecordingMultiStore';
import PanelButton from './PanelButton';

interface PremiumControlPanel {
  selectedPeers: string[];
  onSetActiveMode: (mode: 'message' | 'audio' | 'install' | 'Launch') => void;
}

// 차후 프리미엄기능을 만들어서(Form부터 기능까지) 모니터링 페이지에서(index.tsx) props를 전달해주기.
// 아마 나중에 프리미엄 기능을 추가한다면 로그인시 User의 ID를 받았을때 서버에 ID값을 보내서
// 해당 유저가 프리미엄(구독을 했는지)인지
const PremiumControlPanel = ({ selectedPeers, onSetActiveMode }: PremiumControlPanel) => {
  // zustand 프리미티브 selector: sessions만 가져옴
  const sessions = useRecordingMultiStore((state) => state.sessions);

  const hasSelection = selectedPeers.length > 0;

  // 버튼 disabled 상태 계산
  const startDisabled = !hasSelection;
  const stopDisabled = !hasSelection;
  return (
    <div className="relative flex flex-col text-center">
      <div className="flex items-center gap-2 rounded-2xl border-2 border-[#A5A5A5] bg-white px-3 py-3 shadow">
        {/* 프리미엄 뱃지 */}
        <span className="absolute -top-3 left-3 z-10 inline-flex items-center justify-center rounded-tl-[6px] px-[12px] py-[6px] text-[10px] font-bold leading-none text-black shadow [background:linear-gradient(90deg,#F7E08C_0%,#F2C765_30%,#E7A943_70%,#C9821A_100%)] after:absolute after:-right-[10px] after:top-0 after:h-0 after:w-0 after:border-b-[0px] after:border-l-[10px] after:border-t-[12px] after:border-b-transparent after:border-l-[#A96D1B] after:border-t-transparent after:content-['']">
          PREMIUM
        </span>
        {/* 메시지 보내기 */}

        <PanelButton
          icon={<Mail />}
          label="메시지 전송"
          disabled={!hasSelection}
          onClick={() => onSetActiveMode('message')}
        />

        <PanelButton
          icon={<Cog />}
          label="콘텐츠 제어"
          disabled={!hasSelection}
          onClick={() => console.log('콘텐츠 제어 버튼 클릭!')}
        />
        <PanelButton
          icon={<Move />}
          label="시점 재조정"
          disabled={!hasSelection}
          onClick={() => console.log('시점 재조정 버튼 클릭!')}
        />
      </div>
    </div>
  );
};

export default PremiumControlPanel;
