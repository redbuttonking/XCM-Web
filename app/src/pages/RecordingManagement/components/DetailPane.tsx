import type { FolderFile } from '@/types/filesystem';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function DetailPane({ file, onBack }: { file: FolderFile; onBack: () => void }) {
  const isImage = /^(png|jpg|jpeg|gif|webp|avif)$/i.test(file.type);
  const isVideo = /^(webm|mp4|mov)$/i.test(file.type);

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
            src={file.url}
            className="h-full w-full object-contain"
            controls
            autoPlay
            playsInline
          />
        )}
        {!isImage && !isVideo && (
          <div className="text-sm text-gray-600">이 형식은 미리보기를 지원하지 않습니다.</div>
        )}
      </div>
    </div>
  );
}
