import { useEffect, useRef } from 'react';
import { useRoomStore } from '@/store/useRoomStore';

interface PeerViewProps {
  videoTrack?: MediaStreamTrack;
  audioTrack?: MediaStreamTrack;
}

const PeerView = ({ videoTrack, audioTrack }: PeerViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const prevVideoTrackId = useRef<string | null>(null);

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

    const stream = new MediaStream([audioTrack]);
    audioElement.srcObject = stream;

    audioElement
      .play()
      .then(() => {
        console.log('[PeerView] 오디오 자동 재생 성공');
      })
      .catch((err) => {
        console.error('오디오 재생 실패:', err);
      });
  }, [audioTrack]);

  // 비디오 트랙 mute 상태 감지
  useEffect(() => {
    if (!videoTrack || !videoTrack.muted) return;

    console.log('[PeerView] ⚠️ videoTrack is muted (possibly due to no screen update)');

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
    // <>
    //   {videoTrack && videoTrack.muted ? (
    //     <div className="aspect-video w-full rounded-lg bg-black object-cover text-center">
    //       📛 일시 중단
    //     </div>
    //   ) : (
    //     <video
    //       ref={videoRef}
    //       autoPlay
    //       playsInline
    //       // muted={false}
    //       muted
    //       className="aspect-video w-full rounded-lg bg-black object-cover"
    //     />
    //   )}
    //   <audio ref={audioRef} autoPlay />
    // </>
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        // muted={false}
        muted
        className="aspect-video w-full rounded-lg bg-black object-cover"
      />

      <audio ref={audioRef} autoPlay />
    </>
  );
};

export default PeerView;
