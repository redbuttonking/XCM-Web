import { useEffect, useMemo, useState } from 'react';
import {
  Headphones,
  Download,
  Rocket,
  Video,
  CircleStop,
  Mail,
  RotateCcw,
  Binoculars,
  Scan,
} from 'lucide-react';
import { useRecordingMultiStore } from '@/store/useRecordingMultiStore';
import PanelButton from './PanelButton';
import { useRoomStore } from '@/store/useRoomStore';

interface ControlPanelProps {
  selectedPeers: string[];
  focusedPeer?: string;
  onSetActiveMode: (mode: 'message' | 'audio' | 'install' | 'Launch' | 'viewGuide') => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onMediaReconnect: () => void;
  onSinglePeerCapture?: (peerId: string) => Promise<void>;
  showViewGuideButton?: boolean;
}

const ControlPanel = ({
  selectedPeers,
  focusedPeer,
  onSetActiveMode,
  onStartRecording,
  onStopRecording,
  onMediaReconnect,
  onSinglePeerCapture,
  showViewGuideButton = false,
}: ControlPanelProps) => {
  // zustand 프리미티브 selector: sessions만 가져옴
  const recordingSessions = useRecordingMultiStore((state) => state.sessions);

  const isSingleMonitoring = !!focusedPeer;

  // peer 녹화 상태 배열은 useMemo로 관리
  const recordingStates = useMemo(
    () => selectedPeers.map((peerId) => recordingSessions[peerId]?.isRecording ?? false),
    [recordingSessions, selectedPeers],
  );

  const hasSelection = selectedPeers.length > 0;
  const allRecording = hasSelection && recordingStates.every(Boolean);
  const noneRecording = hasSelection && recordingStates.every((v) => !v);
  const mixedRecording = hasSelection && !allRecording && !noneRecording;

  // 버튼 disabled 상태 계산
  const startDisabled = !hasSelection || !noneRecording || mixedRecording;
  const stopDisabled = !hasSelection || !allRecording || mixedRecording;

  return (
    <div className="flex w-full max-w-[600px] flex-col items-center text-center">
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-[#A5A5A5] bg-white px-3 py-3 shadow">
        {/* 오디오 실행하기 */}
        {/* <PanelButton
          icon={<Headphones />}
          label="오디오"
          disabled={!hasSelection}
          onClick={() => onSetActiveMode('audio')}
        /> */}

        {/* 뷰가이드 버튼 */}
        {showViewGuideButton && (
          <PanelButton
            icon={<Binoculars />}
            label="뷰가이드"
            onClick={() => onSetActiveMode('viewGuide')}
          />
        )}

        {isSingleMonitoring && (
          <PanelButton
            icon={<Scan />}
            label={'화면 캡처'}
            onClick={() => onSinglePeerCapture?.(focusedPeer)}
          />
        )}

        {/* APK 설치하기 */}
        <PanelButton
          icon={<Download />}
          label="APK 설치"
          disabled={!hasSelection}
          onClick={() => onSetActiveMode('install')}
        />

        {/* APP 실행하기 */}
        <PanelButton
          icon={<Rocket />}
          label="APP 실행"
          disabled={!hasSelection}
          onClick={() => onSetActiveMode('Launch')}
        />

        {/* peer 비디오 새로고침(Consumer) */}
        {/* <PanelButton icon={<RotateCcw />} label="새로고침" onClick={onMediaReconnect} /> */}

        {/* 녹화 시작 */}
        <PanelButton
          icon={<Video />}
          label="녹화 시작"
          disabled={startDisabled}
          onClick={onStartRecording}
        />

        {/* 녹화 중지 */}
        <PanelButton
          icon={<CircleStop />}
          label="녹화 중지"
          disabled={stopDisabled}
          onClick={onStopRecording}
        />
      </div>
      {/* {!hasSelection ? <div className="text- pt-3 font-bold">기기를 선택해 주세요</div> : ''} */}
    </div>
  );
};

export default ControlPanel;
