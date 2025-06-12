import { useEffect, useRef } from 'react';

interface PeerViewProps {
  videoTrack?: MediaStreamTrack;
  audioTrack?: MediaStreamTrack;
}

const PeerView = ({ videoTrack, audioTrack }: PeerViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    console.log('[PeerView] videoTrack:', videoTrack);
    if (videoTrack && videoRef.current) {
      const stream = new MediaStream([videoTrack]);
      videoRef.current.srcObject = stream;
    }
  }, [videoTrack]);

  useEffect(() => {
    console.log('[PeerView] audioTrack:', audioTrack);
    if (audioTrack && audioRef.current) {
      const stream = new MediaStream([audioTrack]);
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch((err) => {
        console.error('오디오 재생 실패:', err);
      });
    }
  }, [audioTrack]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className="h-48 w-full rounded bg-black"
      />
      <audio ref={audioRef} autoPlay />
    </>
  );
};

export default PeerView;
