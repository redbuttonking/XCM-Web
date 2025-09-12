declare global {
  // 폴더 / 파일 선택 관련
  interface Window {
    showDirectoryPicker(options?: any): Promise<FileSystemDirectoryHandle>;
    showOpenFilePicker(options?: any): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker(options?: any): Promise<FileSystemFileHandle>;
  }
}

//  File System Access API 타입 지정

interface FileSystemFileHandle {
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
  getFile(): Promise<File>;
}

interface FileSystemDirectoryHandle {
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;

  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;

  queryPermission(descriptors?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptors?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;

  values(): AsyncIterable<FileSystemHandle>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
}

// 폴더 파일 정보 데이터 타입
export interface FolderFile {
  name: string;
  url: string;
  type: 'webm' | 'mp4' | 'png';
  displayType: '전체화면 녹화' | '전체화면 캡쳐' | '단일 녹화' | '단일 캡쳐' | '기타';
  date: Date;
}
