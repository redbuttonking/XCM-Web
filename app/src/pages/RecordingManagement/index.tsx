import type { FileSystemDirectoryHandle, FolderFile } from '@/types/filesystem';
import { useEffect, useState } from 'react';
import FileTypeDropdown from './components/FileTypeDropdown ';
import FileList from './components/FileList';
import { getOrSelectControlXRFolder } from '@/core/utils';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import DetailPane from './components/DetailPane';

const RecordingManagement = () => {
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [files, setFiles] = useState<FolderFile[]>([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<FolderFile | null>(null);
  const q = useDebounced(query, 250); // 타이핑 디바운스

  // ✅ 선택 상태(파일명 기준)
  const [selected, setSelected] = useState<string[]>([]);

  // 파일 수정에 대한 권한 체크 함수
  const ensureReadWritePermission = async (dir: FileSystemDirectoryHandle) => {
    // @ts-ignore → File System Access API 타입 문제 우회
    if ((await dir.queryPermission?.({ mode: 'readwrite' })) === 'granted') return true;
    // @ts-ignore
    const res = await dir.requestPermission?.({ mode: 'readwrite' });
    return res === 'granted';
  };

  // 파일 삭제
  const handleDelete = async () => {
    if (!folderHandle) {
      alert('폴더 핸들이 없습니다.');
      return;
    }
    if (selected.length === 0) {
      alert('삭제할 파일을 선택해주세요.');
      return;
    }

    const ok = confirm(`선택한 ${selected.length}개의 파일을 실제로 삭제하시겠습니까?`);
    if (!ok) return;

    // 쓰기 권한 요청
    const granted = await ensureReadWritePermission(folderHandle);
    if (!granted) {
      alert('폴더에 대한 쓰기 권한이 필요합니다.');
      return;
    }

    // 실제 삭제
    const failed: string[] = [];
    for (const name of selected) {
      try {
        await folderHandle.removeEntry(name);
      } catch (e) {
        console.error('삭제 실패:', name, e);
        failed.push(name);
      }
    }

    // 상태 업데이트
    setFiles((prev) => prev.filter((f) => !selected.includes(f.name)));
    setSelected([]);

    if (failed.length > 0) {
      alert(`일부 파일을 삭제하지 못했습니다:\n${failed.join('\n')}`);
    }
  };

  // 필터에 맞는 파일 목록 추출
  const filteredFiles = useMemo(() => {
    const nq = q.trim(); // 디바운스된 검색어
    return files.filter((f) => {
      // 1) 타입 필터
      const byType = filter === 'all' ? true : f.displayType === filter;
      if (!byType) return false;

      // 2) 검색어 필터(파일명에 포함되면 통과)
      if (!nq) return true; // 검색어 없으면 그대로
      return f.name.includes(nq); // 파일명에서 부분 일치
    });
  }, [files, filter, q]);

  // ✅ 개별 토글
  const toggleSelect = (fileName: string) => {
    setSelected((prev) =>
      prev.includes(fileName) ? prev.filter((n) => n !== fileName) : [...prev, fileName],
    );
  };

  const selectedCount = selected.length;

  // 컴포넌트 마운트 시 저장된 폴더 핸들 불러오기 또는 선택 유도
  useEffect(() => {
    (async () => {
      const handle = await getOrSelectControlXRFolder();
      setFolderHandle(handle);
    })();
  }, []);

  // 폴더 핸들이 바뀌면 파일 목록 갱신
  useEffect(() => {
    if (!folderHandle) return;
    (async () => {
      const result: FolderFile[] = [];
      for await (const entry of folderHandle.values()) {
        if (entry.kind !== 'file') continue;
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!ext || !['webm', 'mp4', 'png'].includes(ext)) continue;

        let displayType: FolderFile['displayType'] = '기타';
        if (ext === 'webm') {
          if (file.name.includes('Full-Recording')) displayType = '전체화면 녹화';
          else if (file.name.includes('record')) displayType = '단일 녹화';
        } else if (ext === 'png') {
          displayType = file.name.includes('Full-Screen-Capture') ? '전체화면 캡쳐' : '단일 캡쳐';
        }

        result.push({
          name: file.name,
          url: URL.createObjectURL(file),
          type: ext as FolderFile['type'],
          displayType,
          date: file.lastModified ? new Date(file.lastModified) : new Date(),
        });
      }
      // 최신순 정렬(선택)
      result.sort((a, b) => b.date.getTime() - a.date.getTime());
      setFiles(result);
    })();
  }, [folderHandle]);

  // 파일 리스트 초기화 : 존재하는 파일만 유지(부분 초기화)
  useEffect(() => {
    setSelected((prev) => prev.filter((name) => files.some((f) => f.name === name)));
  }, [files]);

  // 드롭다운이나 검색어가 바뀌면 기존 선택을 모두 해제
  useEffect(() => {
    setSelected([]);
  }, [filter, q]);

  return (
    <>
      {!folderHandle ? (
        <p>폴더를 선택 중입니다...</p>
      ) : (
        <>
          {/* 상단 제목은 항상 유지 */}
          <h2 className="pb-[40px] text-2xl font-bold text-black">Managing Recordings</h2>

          {/* 🔀 상세 모드 전환 */}
          {detail ? (
            // ✅ 상세 보기
            <DetailPane file={detail} onBack={() => setDetail(null)} />
          ) : (
            // ✅ 기본 전체 보기
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 md:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <SearchBar value={query} onChange={setQuery} onClear={() => setQuery('')} />
                  <FileTypeDropdown options={initialTypes} value={filter} onChange={setFilter} />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className={`h-11 rounded-md border border-gray-300 transition-colors ${
                      selected.length > 0
                        ? 'border-blue bg-blue text-white hover:border-blue hover:bg-blue hover:text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={handleDelete}
                    disabled={selected.length === 0}
                    title={selected.length === 0 ? '선택된 파일이 없습니다' : ''}
                  >
                    파일 삭제{selected.length > 0 ? ` (${selected.length})` : ''}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-md border border-gray-300 text-gray-400"
                    disabled
                    title="준비 중"
                  >
                    파일 공유
                  </Button>
                </div>
              </div>

              <FileList
                files={filteredFiles}
                selected={selected}
                onToggle={toggleSelect}
                onOpen={(file) => setDetail(file)}
              />
            </>
          )}
        </>
      )}
    </>
  );
};

export default RecordingManagement;

const SearchBar = ({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) => {
  return (
    <div className="relative w-full max-w-lg">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="파일명을 검색해주세요"
        className="h-11 rounded-md border border-gray-300 bg-white pl-10 pr-10 text-gray-800 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-gray-400"
      />
      {value && (
        <button
          aria-label="clear"
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

/** 간단 디바운스 훅 */
function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// 필터링용 타입 정의
const initialTypes = [
  { label: '전체 파일', value: 'all' },
  { label: '전체화면 녹화', value: '전체화면 녹화' },
  { label: '전체화면 캡쳐', value: '전체화면 캡쳐' },
  { label: '단일 녹화', value: '단일 녹화' },
  { label: '단일 캡쳐', value: '단일 캡쳐' },
];
