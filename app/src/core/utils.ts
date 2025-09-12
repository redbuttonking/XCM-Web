import type { FileSystemDirectoryHandle } from '@/types/filesystem';

let mediaQueryDetectorElem: HTMLElement | null;

export function initialize(): Promise<void> {
  mediaQueryDetectorElem = document.getElementById('mediasoup-demo-app-media-query-detector');

  return Promise.resolve();
}

export function isDesktop(): boolean {
  return !!(mediaQueryDetectorElem && mediaQueryDetectorElem.offsetParent);
}

export function isMobile(): boolean {
  return !(mediaQueryDetectorElem && mediaQueryDetectorElem.offsetParent);
}

const DB_NAME = 'ControlXRDB';
const STORE_NAME = 'folderHandles';
const FOLDER_HANDLE_KEY = 'controlXRFolderHandle';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(handle, FOLDER_HANDLE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(FOLDER_HANDLE_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 사용자에게 저장 폴더 선택을 유도하고,
 * 선택된 폴더 내 "ControlXR" 폴더 생성 또는 가져오기
 */
export async function selectControlXRFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const rootDirHandle = await window.showDirectoryPicker(); // 바로 사용자가 선택한 폴더를 저장 폴더로!
    await saveFolderHandle(rootDirHandle);
    return rootDirHandle;
  } catch (error) {
    console.error('폴더 선택/지정 실패:', error);
    return null;
  }
}

/**
 * 저장할 폴더 핸들이 이미 존재하면 바로 사용,
 * 없으면 사용자에게 폴더 선택 요청 후 저장, 반환
 */
export async function getOrSelectControlXRFolder(): Promise<FileSystemDirectoryHandle | null> {
  let folderHandle = await loadFolderHandle();
  if (folderHandle) {
    // 권한 확인 (읽기/쓰기 권한 없으면 재요청)
    const permission = await folderHandle.queryPermission({ mode: 'readwrite' });
    if (permission === 'granted') {
      return folderHandle;
    }
    const requestPerm = await folderHandle.requestPermission({ mode: 'readwrite' });
    if (requestPerm === 'granted') {
      return folderHandle;
    }
    // 권한 없으면 선택 강제화
  }
  // 처음 선택하거나 권한 실패 시 선택 유도
  return await selectControlXRFolder();
}

/**
 * 파일 이름과 Blob을 받아 지정 폴더 안에 파일을 저장
 */
export async function saveBlobToControlXRFolder(
  folderHandle: FileSystemDirectoryHandle,
  blob: Blob,
  filename: string,
): Promise<void> {
  try {
    const fileHandle = await folderHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    console.error('파일 저장 실패:', error);
    throw error;
  }
}

// 녹화본 저장 폴더 생성 유도 함수
export async function ensureControlXRFolder(): Promise<FileSystemDirectoryHandle | null> {
  let folderHandle = await loadFolderHandle();
  if (folderHandle) {
    // 권한 체크
    const permission = await folderHandle.queryPermission({ mode: 'readwrite' });
    if (permission === 'granted') return folderHandle;
    const requestPerm = await folderHandle.requestPermission({ mode: 'readwrite' });
    if (requestPerm === 'granted') return folderHandle;
  }
  // 권한 없거나 최초 진입 → 폴더 선택 유도
  alert('아직 녹화/캡처 파일을 저장할 폴더가 지정되어 있지 않습니다.\n폴더 위치를 선택해 주세요!');
  return await selectControlXRFolder();
}
