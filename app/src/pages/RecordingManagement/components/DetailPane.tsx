import type { FolderFile } from '@/types/filesystem';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRef } from 'react';
import { useFixVideoDuration } from '@/hooks/useFixVideoDuration';

export default function DetailPane({ file, onBack }: { file: FolderFile; onBack: () => void }) {
  const isImage = /^(png|jpg|jpeg|gif|webp|avif)$/i.test(file.type);
  const isVideo = /^(webm|mp4|mov)$/i.test(file.type);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  useFixVideoDuration(videoRef.current, file.url);

  const v = document.querySelector('video');
  console.log('duration:', v?.duration); // 실제보다 짧게 나오는지
  console.log('seekable:', v?.seekable.length ? v?.seekable.end(0) : 0); // 시킹 가능한 구간

  return (
    <div className="flex flex-col gap-3">
      {/* 상단 제목 + 뒤로가기 */}
      <div className="flex items-center gap-4">
        <Button variant="outline" className="gap-2" onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={16} />
          뒤로
        </Button>
      </div>

      {/* 미디어 영역 */}
      <div className="flex h-[calc(100vh-200px)] items-center justify-center overflow-hidden rounded-md border bg-black p-4">
        {isImage && (
          <img
            src={file.url}
            alt={file.name}
            className="h-full w-full object-contain"
            draggable={false}
          />
        )}
        {isVideo && (
          <video
            key={file.url}
            ref={videoRef}
            src={file.url}
            className="h-full w-full object-contain"
            controls
            playsInline
            preload="metadata"
            autoPlay
            muted
          />
        )}
        {!isImage && !isVideo && (
          <div className="text-sm text-gray-600">이 형식은 미리보기를 지원하지 않습니다.</div>
        )}
      </div>
    </div>
  );
}
