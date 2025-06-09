// components/PeerView.tsx
import { useEffect, useRef } from 'react';

interface Props {
  videoTrack?: MediaStreamTrack;
  micTrack?: MediaStreamTrack;
}

const PeerView = ({ videoTrack, micTrack }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    console.log('[PeerView] videoTrack:', videoTrack);
    if (videoTrack && videoRef.current) {
      const stream = new MediaStream([videoTrack]);
      videoRef.current.srcObject = stream;
    }
  }, [videoTrack]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={false}
      className="h-48 w-full rounded bg-black"
    />
  );
};

export default PeerView;
