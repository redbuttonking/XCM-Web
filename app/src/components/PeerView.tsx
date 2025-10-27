import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '@/store/useRoomStore';
import ViewPointers from '../pages/Monitoring/components/ViewPointers';

interface PeerViewProps {
  peerId?: string;
  videoTrack?: MediaStreamTrack | null;
  audioTrack?: MediaStreamTrack | null;
  variant?: 'multiple' | 'fill';

  activeMode?: 'none' | 'message' | 'audio' | 'install' | 'Launch' | 'record' | 'viewGuide';
  setActiveMode?: (
    mode: 'none' | 'message' | 'audio' | 'install' | 'Launch' | 'record' | 'viewGuide',
  ) => void;
}

const PeerView = ({
  peerId,
  videoTrack,
  audioTrack,
  variant = 'multiple',
  activeMode,
  setActiveMode,
}: PeerViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [ready, setReady] = useState(false); // 트랙 붙고 플레이 시작되면 true

  // ✅ 컨테이너에 비율을 미리 잡고(검은 배경 포함), 비디오는 절대 배치
  // - fill: 세로 화면(폰) 기본, 넓은 화면에선 16:9 로 자동 전환
  // - multiple: 16:9 고정
  const wrapCls =
    variant === 'fill'
      ? 'relative w-full rounded-xl overflow-hidden bg-black aspect-[9/16] md:aspect-video'
      : 'relative w-full rounded-xl overflow-hidden bg-black aspect-video';

  const videoCls =
    'absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ' +
    (ready ? 'opacity-100' : 'opacity-0'); // 로딩 전엔 부드럽게 숨김

  // 비디오 트랙 처리
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoTrack || !videoEl) {
      setReady(false);
      return;
    }

    // 이전 스트림 정리
    try {
      videoEl.pause();
    } catch {}
    const prev = videoEl.srcObject as MediaStream | null;
    prev?.getTracks().forEach((t) => t.stop());
    videoEl.srcObject = null;

    // 약간의 안정화 딜레이 후 붙이기
    const t = setTimeout(() => {
      const stream = new MediaStream([videoTrack]);
      videoEl.srcObject = stream;

      const tryPlay = async () => {
        try {
          await videoEl.play();
          setReady(true);
        } catch {
          setTimeout(tryPlay, 300);
        }
      };
      tryPlay();
    }, 50);

    const onEnded = () => setReady(false);
    videoTrack.addEventListener('ended', onEnded);

    return () => {
      clearTimeout(t);
      videoTrack.removeEventListener('ended', onEnded);
    };
  }, [videoTrack]);

  // 오디오 트랙 처리
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioTrack || !audioEl) return;
    audioEl.srcObject = new MediaStream([audioTrack]);
  }, [audioTrack]);

  // (선택) 트랙이 mute면 서버에 재동기화 요청
  useEffect(() => {
    if (!videoTrack || !videoTrack.muted) return;
    const roomClient = useRoomStore.getState().roomClient;
    const id = setTimeout(() => roomClient?.request('resyncMedia'), 1000);
    return () => clearTimeout(id);
  }, [videoTrack?.id, videoTrack?.muted]);

  return (
    <div className={wrapCls}>
      {/* 컨테이너가 항상 aspect와 bg-black을 유지 → 트랙 없을 때도 검은 화면 유지 */}
      <video ref={videoRef} autoPlay playsInline muted className={videoCls} />
      <audio ref={audioRef} autoPlay />
      {variant === 'fill' && setActiveMode && activeMode === 'viewGuide' && (
        <ViewPointers peerId={peerId} onCancel={() => setActiveMode('none')} />
      )}
    </div>
  );
};

export default PeerView;
