import type { FolderFile } from '@/types/filesystem';
import FileListItem from './FileListItem';
import { ScrollArea } from '@/components/ui/scroll-area';

type FileListProps = {
  files: FolderFile[];
  selected?: string[];
  onToggle?: (fileName: string) => void;
  onOpen?: (file: FolderFile) => void;
};

const FileList = ({ files, selected = [], onToggle, onOpen }: FileListProps) => {
  return (
    <ScrollArea className="h-[1080px]">
      <div className="grid grid-cols-3 content-start gap-x-4 gap-y-9 p-4 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
        {files.map((file) => (
          <FileListItem
            key={file.name}
            file={file}
            selected={selected.includes(file.name)}
            onToggle={() => onToggle?.(file.name)}
            onOpen={() => onOpen?.(file)}
          />
        ))}
      </div>
    </ScrollArea>
  );
};

export default FileList;
