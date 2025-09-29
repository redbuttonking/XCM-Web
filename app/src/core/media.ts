// src/core/media.ts
import webmFix from 'webm-duration-fix';

export async function fixWebmDuration(
  originalBlob: Blob,
  _durationMs?: number, // 호출 호환성 유지용(무시)
): Promise<Blob> {
  if (!/webm/i.test(originalBlob.type || '')) return originalBlob;
  try {
    const fixed = await webmFix(originalBlob);
    return fixed as Blob;
  } catch {
    return originalBlob;
  }
}
