import { useEffect, useRef, useState } from 'react';

const MicVolumeMeter = () => {
  const [volume, setVolume] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothedVolumeRef = useRef<number>(0);

  useEffect(() => {
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        source.connect(analyser);

        sourceRef.current = source;
        analyserRef.current = analyser;
        dataArrayRef.current = dataArray;

        const animate = () => {
          analyser.getByteFrequencyData(dataArray);

          const avg = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

          const rawVolume = (avg / 256) * 100;

          // 🎯 부드러운 변화 (0.8은 감쇠, 0.2는 반응 비율)
          smoothedVolumeRef.current = smoothedVolumeRef.current * 0.8 + rawVolume * 0.2;

          setVolume(smoothedVolumeRef.current);

          rafRef.current = requestAnimationFrame(animate);
        };

        animate();
      } catch (err) {
        console.error('Mic access error:', err);
      }
    };

    init();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioContextRef.current?.close();
    };
  }, []);

  return (
    <div className="w-full max-w-sm p-4">
      <div className="h-4 w-full overflow-hidden rounded bg-gray-700">
        <div
          className="h-full bg-yellow-400 transition-all duration-75 ease-out"
          style={{
            width: `${Math.max(volume, 2)}%`, // 최소값 2%
          }}
        />
      </div>
    </div>
  );
};

export default MicVolumeMeter;
