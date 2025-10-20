// src/hooks/useFixVideoDuration.ts
import { useEffect, useRef, type RefObject } from 'react';

type VideoTarget = HTMLVideoElement | null | RefObject<HTMLVideoElement>;

export function useFixVideoDuration(target: VideoTarget, srcKey?: string) {
  const fixedForSrcRef = useRef<string | null>(null);

  useEffect(() => {
    // target이 ref인지, element인지 판별해서 실제 엘리먼트를 얻는다.
    const el: HTMLVideoElement | null =
      target && typeof target === 'object' && 'current' in (target as any)
        ? (target as RefObject<HTMLVideoElement>).current
        : (target as HTMLVideoElement | null);

    if (!el || !srcKey) return;
    if (fixedForSrcRef.current === srcKey) return; // 같은 파일은 한 번만 보정

    let fixing = false;
    let cancelled = false;

    const onTimeUpdate = () => {
      if (!fixing) return;
      fixing = false;
      fixedForSrcRef.current = srcKey;
      if (!cancelled) {
        try {
          el.currentTime = 0;
        } catch {}
      }
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('seeking', onSeeking);
    };

    const onSeeking = () => {
      // 사용자가 탐색하면 보정 즉시 중단(간섭 방지)
      if (!fixing) return;
      cancelled = true;
      fixing = false;
      el.removeEventListener('timeupdate', onTimeUpdate);
    };

    const startFix = () => {
      if (fixing) return;
      fixing = true;
      cancelled = false;
      el.addEventListener('timeupdate', onTimeUpdate);
      el.addEventListener('seeking', onSeeking);
      try {
        el.currentTime = 1e6; // 내부 스캔 유도
      } catch {
        setTimeout(() => {
          try {
            el.currentTime = 1e6;
          } catch {}
        }, 0);
      }
    };

    const onLoadedMeta = () => {
      const ok = Number.isFinite(el.duration) && el.duration > 0 && (el.seekable?.length ?? 0) > 0;

      if (ok) {
        fixedForSrcRef.current = srcKey; // 이미 정상 → 보정 스킵
        return;
      }
      startFix();
    };

    if (el.readyState >= 1) onLoadedMeta();
    else el.addEventListener('loadedmetadata', onLoadedMeta);

    return () => {
      el.removeEventListener('loadedmetadata', onLoadedMeta);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('seeking', onSeeking);
    };
  }, [target, srcKey]);
}
