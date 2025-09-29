import { useEffect, useRef } from 'react';
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

  // ✅ 반응형 비디오 클래스 적용
  const wrapCls = variant === 'fill' ? 'relative w-full max-w-full' : ' w-full';
  const videoCls =
    variant === 'fill'
      ? // ✅ 단일 모니터링일 경우
        'block w-full h-auto max-h-full object-contain bg-black rounded-xl'
      : // 다중 모니터링일 경우
        'block w-full aspect-video object-cover bg-black rounded-xl';

  // zustand에서 해당 peer consumer 상태 조회: 'paused' | 'resumed' 등
  // const peers = useRoomStore((state) => state.peers);

  // const peerInfo = peers.find((p) => p.id === peerId);
  // console.log('peerInfo: ', peerInfo);

  // const consumerState = peerInfo?.audioConsumerState ?? 'resumed'; // 상태 키 이름은 실제에 맞게 조정

  // 비디오 트랙 처리
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoTrack || !videoElement) return;

    const currentStream = videoElement.srcObject as MediaStream | null;
    const currentTrack = currentStream?.getVideoTracks()?.[0];

    if (currentTrack?.id === videoTrack.id && !videoTrack.muted) {
      console.log('[PeerView] 동일한 videoTrack && unmuted, 재설정 생략');
      return;
    }

    console.log('[PeerView] 🔄 새로운 videoTrack 감지:', videoTrack.id);
    console.log('videoTrack: ', videoTrack);

    console.log('audioTrack: ', audioTrack);

    // 기존 트랙 정리
    videoElement.pause();
    const tracks = (videoElement.srcObject as MediaStream)?.getTracks();
    tracks?.forEach((t) => t.stop());
    videoElement.srcObject = null;

    // 안정화를 위한 딜레이
    setTimeout(() => {
      const stream = new MediaStream([videoTrack]);
      videoElement.srcObject = stream;
      // videoElement.load();

      const tryPlay = async () => {
        try {
          await videoElement.play();
          console.log('[PeerView] ✅ 비디오 자동 재생 성공');
        } catch (err) {
          console.warn('[PeerView] ❌ 비디오 재생 실패, 재시도 예정:', err);
          setTimeout(() => {
            tryPlay();
          }, 500); // 0.5초 후 재시도
        }
      };

      setTimeout(() => {
        tryPlay();
      }, 50); // 50~100ms가 안전
    }, 50); // 최소 30~50ms 딜레이가 안정적

    // 상태 추적용 이벤트 리스너 등록
    const onEnded = () => console.warn('[PeerView] 🔕 videoTrack ended');
    const onMute = () => {
      console.warn('[PeerView] 🔇 videoTrack muted');
      console.log('비디오 트랙 값 : ', videoTrack?.muted);
    };
    const onUnmute = () => {
      console.warn('[PeerView] 🔊 videoTrack unmuted');
      console.log('비디오 트랙 값 : ', videoTrack?.muted);
    };

    // 콘솔 로그 찍기 위함
    videoTrack.addEventListener('ended', onEnded);
    videoTrack.addEventListener('mute', onMute);
    videoTrack.addEventListener('unmute', onUnmute);
    console.log('videoTrack: ', videoTrack);

    // 정리
    return () => {
      videoTrack.removeEventListener('ended', onEnded);
      videoTrack.removeEventListener('mute', onMute);
      videoTrack.removeEventListener('unmute', onUnmute);
    };
  }, [videoTrack]);

  // 오디오 트랙 처리
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioTrack || !audioElement) return;

    console.log('[PeerView] 🔄 새로운 audioTrack 감지:', audioTrack.id);
    console.log('audioTrack: ', audioTrack);

    const stream = new MediaStream([audioTrack]);
    audioElement.srcObject = stream;

    // audioElement
    //   .play()
    //   .then(() => {
    //     console.log('[PeerView] 오디오 자동 재생 성공');
    //   })
    //   .catch((err) => {
    //     console.error('오디오 재생 실패:', err);
    //   });
  }, [audioTrack]);

  // 비디오 트랙 mute 상태 감지
  useEffect(() => {
    if (!videoTrack || !videoTrack.muted) return;

    console.log('[PeerView] ⚠️ videoTrack is muted');

    const roomClient = useRoomStore.getState().roomClient;
    if (!roomClient) return;

    // 중복 호출 방지
    let hasRequested = false;

    // 1초 후 resyncMedia 요청 (서버에 미디어 재동기화)
    const timer = setTimeout(() => {
      if (!hasRequested) {
        console.log('[PeerView] 🔄 요청: resyncMedia()');
        roomClient.request('resyncMedia');
        hasRequested = true;
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [videoTrack?.id, videoTrack?.muted]);

  return (
    <div className={wrapCls}>
      <video ref={videoRef} autoPlay playsInline muted className={videoCls} />
      <audio ref={audioRef} autoPlay />

      {variant === 'fill' && setActiveMode && activeMode && (
        <>
          {activeMode === 'viewGuide' && (
            <ViewPointers peerId={peerId} onCancel={() => setActiveMode('none')} />
          )}
        </>
      )}
    </div>
  );
};

export default PeerView;
