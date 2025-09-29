// src/hooks/useFixVideoDuration.ts
import { useEffect } from 'react';

export function useFixVideoDuration(video: HTMLVideoElement | null, srcKey: string) {
  useEffect(() => {
    if (!video) return;

    const onLoadedMetadata = () => {
      // duration이 비정상(0/Infinity/너무 짧음)하면 재계산 유도
      if (!isFinite(video.duration) || video.duration === 0 || video.duration < 2) {
        const onTimeUpdate = () => {
          video.removeEventListener('timeupdate', onTimeUpdate);
          try {
            video.currentTime = 0;
          } catch {}
        };
        video.addEventListener('timeupdate', onTimeUpdate);

        try {
          // 매우 큰 시간으로 점프 → 내부적으로 끝까지 스캔하며 duration 계산
          video.currentTime = 1e9;
        } catch {
          // 간혹 바로 실패할 수 있어 한 틱 뒤 재시도
          setTimeout(() => {
            try {
              video.currentTime = 1e9;
            } catch {}
          }, 0);
        }
      }
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => video.removeEventListener('loadedmetadata', onLoadedMetadata);
  }, [video, srcKey]);
}
