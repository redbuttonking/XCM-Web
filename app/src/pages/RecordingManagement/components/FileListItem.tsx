import type { FolderFile } from '@/types/filesystem';

import { Checkbox } from '@/components/ui/checkbox';

import { AspectRatio } from '@/components/ui/aspect-ratio'; // shadcn

type Props = {
  file: FolderFile;
  selected?: boolean;
  onToggle?: () => void;
  onOpen?: () => void;
};

const FileListItem = ({ file, selected, onToggle, onOpen }: Props) => {
  return (
    <div className="relative overflow-hidden rounded-md border bg-white">
      <div className="rounded-md py-2 pl-3">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle?.()}
          onClick={(e) => e.stopPropagation()} // 카드 클릭과 기능을 분리함(체크박스니까)
          className="data-[state=checked]:border-blue data-[state=checked]:bg-blue data-[state=checked]:text-white"
        />
      </div>

      <div onClick={onOpen} className="cursor-pointer">
        {/* 썸네일: 고정 비율(16:9) */}
        <AspectRatio ratio={16 / 9} className="bg-muted">
          {file.type === 'png' ? (
            <img
              src={file.url}
              alt="썸네일"
              className="h-full w-full object-cover" // cover로 채움
              loading="lazy"
            />
          ) : (
            <video
              src={file.url}
              className="h-full w-full object-cover"
              muted
              playsInline
              preload="metadata" // 레이아웃 점프 방지
            />
          )}
        </AspectRatio>

        {/* 정보 : 고정/최소 높이로 균일화 */}
        <div className="space-y-1 px-10 py-4">
          <InfoRow label="파일명">
            <span className="block truncate" title={file.name}>
              {file.name}
            </span>
          </InfoRow>
          <InfoRow label="날짜" value={file.date.toLocaleDateString()} />
          <InfoRow label="시각" value={file.date.toLocaleTimeString()} />
          {/* <div className="text-xs">{file.displayType}</div> */}
        </div>
      </div>
    </div>
  );
};

function InfoRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 text-sm font-medium leading-5">
      <span className="font-bold">{label}</span>
      {value ? (
        <span className="truncate" title={value}>
          {value}
        </span>
      ) : (
        children
      )}
    </div>
  );
}

export default FileListItem;
