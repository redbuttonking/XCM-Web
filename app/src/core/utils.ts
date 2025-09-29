//src\core\utils.ts
import type { BatteryObj, DeviceRecord, StorageSnapshot, WifiSnapshot } from '@/types/device';
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

/* =========================
 * IndexedDB (with version)
 * ========================= */
const DB_NAME = 'ControlXRDB';
/** 스키마 바뀔 때만 +1 (새 object store 추가/인덱스 변경 등) */
export const DB_VERSION = 2;
const STORE_FOLDER = 'folderHandles';
const STORE_DEVICES = 'devices';
const FOLDER_HANDLE_KEY = 'controlXRFolderHandle';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = req.result;
      const oldV = e.oldVersion || 0;

      // v1: 기존 폴더 핸들 저장소
      if (oldV < 1) {
        if (!db.objectStoreNames.contains(STORE_FOLDER)) {
          db.createObjectStore(STORE_FOLDER);
        }
      }

      // v2: 디바이스 상태 저장소 추가 (peerId를 keyPath로)
      if (oldV < 2) {
        if (!db.objectStoreNames.contains(STORE_DEVICES)) {
          const s = db.createObjectStore(STORE_DEVICES, { keyPath: 'peerId' });
          // 필요 시 빠른 조회를 위한 인덱스(선택)
          // 마지막 본 시간 기준 정리/조회
          s.createIndex('byLastSeen', 'lastSeen', { unique: false });
          // 장소 라벨 등으로 필터링할 때
          s.createIndex('byPlace', 'placeLabel', { unique: false });
        }
      }

      // v3: 다음 업그레이드시 if (oldV < 3)로 추가
    };

    // 다른 탭이 구버전 DB를 열고 있으면 업그레이드가 block될 수 있음
    req.onblocked = () => {
      console.warn(
        '[IndexedDB] Upgrade blocked. 다른 탭(구버전)이 DB를 점유 중일 수 있어요. 그 탭을 닫아주세요.',
      );
    };

    req.onsuccess = () => {
      const db = req.result;

      // 현재 탭이 구버전이 되었을 때 자동 close → 다음 open에서 새 버전으로 재연결
      db.onversionchange = () => {
        console.warn('[IndexedDB] Version changed, closing old connection.');
        db.close();
      };

      resolve(db);
    };

    req.onerror = () => reject(req.error);
  });
}

/* =========================
 * 폴더 핸들 저장/로드
 * ========================= */
export async function saveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FOLDER, 'readwrite');
    const store = tx.objectStore(STORE_FOLDER);
    const request = store.put(handle, FOLDER_HANDLE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FOLDER, 'readonly');
    const store = tx.objectStore(STORE_FOLDER);
    const request = store.get(FOLDER_HANDLE_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 사용자에게 저장 폴더 선택을 유도하고,
 * 선택된 폴더를 저장(재사용)한다.
 */
export async function selectControlXRFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const rootDirHandle = await window.showDirectoryPicker();
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
    if (permission === 'granted') return folderHandle;

    const requestPerm = await folderHandle.requestPermission({ mode: 'readwrite' });
    if (requestPerm === 'granted') return folderHandle;

    // 권한 없으면 아래로 내려가서 선택 유도
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

/**
 * 녹화본 저장 폴더 생성 유도 함수
 */
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

// ===== 디바이스 스냅샷 헬퍼  =====

function mergeWithoutUndefinedTop<T extends Record<string, any>>(base: T, patch: T): T {
  const out: any = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export async function upsertDeviceSnapshot(rec: DeviceRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DEVICES, 'readwrite');
    const store = tx.objectStore(STORE_DEVICES);

    // ① 먼저 기존 값을 읽고
    const getReq = store.get(rec.peerId);
    getReq.onsuccess = () => {
      const prev = (getReq.result ?? {}) as DeviceRecord;

      // ② undefined는 덮어쓰지 않도록 병합
      const merged: DeviceRecord = mergeWithoutUndefinedTop(prev, rec);

      // ③ 통째로 put (이제 이전 값 보존됨)
      const putReq = store.put(merged);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function loadAllDeviceSnapshots(): Promise<DeviceRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DEVICES, 'readonly');
    const store = tx.objectStore(STORE_DEVICES);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result ?? []) as DeviceRecord[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removeDeviceSnapshot(peerId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DEVICES, 'readwrite');
    const store = tx.objectStore(STORE_DEVICES);
    const req = store.delete(peerId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
