import { create } from 'zustand';
import type RoomClient from '../core/RoomClient'; // 실제 경로에 맞게 수정할 것
import type { DeviceTimestamps, StatusSummary } from '@/types/device';
import { resolveGeoIp, invalidateGeoIp } from '@/core/geoIp';

export interface ConsumerInfo {
  id: string;
  peerId: string;
  kind: 'audio' | 'video';
  track?: MediaStreamTrack;
  paused: boolean; // 재생 중지 여부
}

export interface PeerInfo extends StatusSummary, DeviceTimestamps {
  id: string;
  displayName: string;
  isConnected?: boolean;
  battery?: { level?: number; charging?: boolean };

  // 미디어/컨슈머 필드
  videoTrack?: MediaStreamTrack | null;
  audioTrack?: MediaStreamTrack | null;
  audioConsumerId?: string;
  videoConsumerId?: string;

  // 화면용 메타
  appInstallStatus?: 'idle' | 'installing' | 'installed' | 'failed';
  memo?: string;

  // 기기 위치값
  geoLat?: number;
  geoLon?: number;
  geoAccuracyM?: number;

  // 공인IP
  publicIp?: string;
  // 지금 IP로 마지막 조회했는지 확인용
  lastGeoResolvedIp?: string;
}

export interface Notification {
  id: string;
  type: 'chat' | 'error' | 'info';
  title?: string;
  text: string;
}

export type PlaceMap = {
  ssidMap: Record<string, string>;
  bssidMap: Record<string, string>;
};

interface RoomState {
  joined: boolean;
  roomClient: RoomClient | null;
  micTrack: MediaStreamTrack | null;
  webcamTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack | null;
  micEnabled: boolean;
  webcamEnabled: boolean;
  screenShareEnabled: boolean;
  peers: PeerInfo[];
  peerId: string;
  notifications: Notification[];

  consumers: Record<string, ConsumerInfo>;

  placeMap?: PlaceMap;

  // 상태 업데이트 함수들
  setJoined: (joined: boolean) => void;
  setRoomClient: (client: RoomClient) => void;
  setMicTrack: (track: MediaStreamTrack | null) => void;
  setWebcamTrack: (track: MediaStreamTrack | null) => void;
  setScreenTrack: (track: MediaStreamTrack | null) => void;
  setMicEnabled: (enabled: boolean) => void;
  setWebcamEnabled: (enabled: boolean) => void;
  setScreenShareEnabled: (enabled: boolean) => void;
  setPeers: (peers: PeerInfo[]) => void;
  addPeer: (peer: PeerInfo) => void;
  removePeer: (peerId: string) => void;
  updatePeerTrack: (peerId: string, kind: 'audio' | 'video', track: MediaStreamTrack) => void;
  updatePeerConsumerId: (peerId: string, kind: 'audio' | 'video', consumerId: string) => void;

  resetRoom: () => void;
  setPeerId: (peerId: string) => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;

  setConsumerPaused: (consumerId: string) => void;
  setConsumerResumed: (consumerId: string) => void;
  addConsumer: (consumer: ConsumerInfo) => void;
  removeConsumer: (consumerId: string) => void;
  updatePeerFields: (
    peerId: string,
    partial: Partial<PeerInfo & StatusSummary & DeviceTimestamps>,
  ) => void;
  upsertDeviceSummary: (peerId: string, patch: Partial<StatusSummary & DeviceTimestamps>) => void;
  setPlaceMap: (map: PlaceMap) => void;

  refreshPeerGeoIfNeeded: (peerId: string, nextIp?: string) => Promise<void>;
  forceRefreshPeerGeo: (peerId: string) => Promise<void>; // (옵션) 강제 새로고침용

  clearPeerMedia: (peerId: string) => void;
  clearPeerAudio: (peerId: string) => void;
  clearPeerVideo: (peerId: string) => void;
}
export type { RoomState };

// 헬퍼 함수(사설IP면 api 호출 제한)
const isPrivateIp = (ip?: string) => {
  if (!ip) return false;
  if (ip.includes(':')) {
    const v6 = ip.toLowerCase();
    if (v6 === '::1') return true; // loopback
    if (v6.startsWith('fc') || v6.startsWith('fd')) return true; // ULA
    if (
      v6.startsWith('fe8') ||
      v6.startsWith('fe9') ||
      v6.startsWith('fea') ||
      v6.startsWith('feb')
    )
      return true; // link-local
    return false;
  }
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const o2 = Number(ip.split('.')[1] ?? -1);
    if (o2 >= 16 && o2 <= 31) return true;
  }
  if (ip.startsWith('127.')) return true; // loopback
  if (ip.startsWith('169.254.')) return true; // link-local
  if (ip.startsWith('100.')) {
    // CGNAT 100.64.0.0/10
    const o2 = Number(ip.split('.')[1] ?? -1);
    if (o2 >= 64 && o2 <= 127) return true;
  }
  return false;
};

// 값이 없다면 덮어쓰지 않게 하는 함수
const mergeWithoutUndefined = (base: any, patch: any) => {
  const next: any = { ...base };
  for (const k of Object.keys(patch)) {
    const v = (patch as any)[k];
    if (v !== undefined) next[k] = v;
  }
  return next;
};

// 기기 상테 리렌더 조절 헬퍼
const LAST_SEEN_BUCKET_MS = 60_000; // 추천: 30~60초 중 택1

const PRESERVE_IF_NULL_OR_EMPTY = new Set(['geoCity']);

const bucket = (t?: number) => {
  return typeof t === 'number' ? Math.floor(t / LAST_SEEN_BUCKET_MS) : undefined;
};

const shallowEqual = (a: any, b: any) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
};

export const useRoomStore = create<RoomState>((set, get) => ({
  joined: false,
  roomClient: null,
  micEnabled: false,
  webcamEnabled: false,
  screenShareEnabled: false,
  micTrack: null,
  webcamTrack: null,
  screenTrack: null,
  peers: [],
  peerId: '',
  notifications: [],
  consumers: {},
  placeMap: undefined,

  setJoined: (joined) => set({ joined }),
  setMicEnabled: (enabled) => set({ micEnabled: enabled }),
  setWebcamEnabled: (enabled) => set({ webcamEnabled: enabled }),
  setScreenShareEnabled: (enabled) => set({ screenShareEnabled: enabled }),

  setMicTrack: (track) => set({ micTrack: track }),
  setWebcamTrack: (track) => set({ webcamTrack: track }),
  setScreenTrack: (track) => set({ screenTrack: track }),

  setRoomClient: (client) => set({ roomClient: client }),

  setPeerId: (peerId) => set({ peerId }),
  setPeers: (peers) => set({ peers: [...(peers ?? [])] }),

  addPeer: (peer) =>
    set((state) => {
      const idx = state.peers.findIndex((p) => p.id === peer.id);
      if (idx === -1) {
        return { peers: [...state.peers, peer] };
      }
      const next = [...state.peers];
      next[idx] = { ...next[idx], ...peer };
      return { peers: next };
    }),

  removePeer: (peerId) => set((state) => ({ peers: state.peers.filter((p) => p.id !== peerId) })),

  updatePeerTrack: (peerId, kind, track) =>
    set((state) => ({
      peers: state.peers.map((peer) =>
        peer.id === peerId ? { ...peer, [`${kind}Track`]: track } : peer,
      ),
    })),

  updatePeerConsumerId: (peerId, kind, consumerId) => {
    if (!consumerId) {
      console.warn(`updatePeerConsumerId called with invalid consumerId for peer: ${peerId}`);
      return;
    }
    set((state) => ({
      peers: state.peers.map((peer) =>
        peer.id === peerId ? { ...peer, [`${kind}ConsumerId`]: consumerId } : peer,
      ),
    }));
  },
  resetRoom: () =>
    set({
      joined: false,
      roomClient: null,
      micEnabled: false,
      webcamEnabled: false,
      screenShareEnabled: false,
      micTrack: null,
      webcamTrack: null,
      screenTrack: null,
      peers: [],
      peerId: '',
    }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [...state.notifications, notification],
    })),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  // consumer 추가
  addConsumer: (consumer) =>
    set((state) => ({
      consumers: {
        ...state.consumers,
        [consumer.id]: consumer,
      },
    })),
  // consumer 제거
  removeConsumer: (consumerId) =>
    set((state) => {
      const newConsumers = { ...state.consumers };
      delete newConsumers[consumerId];
      return { consumers: newConsumers };
    }),

  // consumer 구독(전송) 취소
  setConsumerPaused: (consumerId) =>
    set((state) => {
      const consumer = state.consumers[consumerId];
      if (!consumer) return {};
      return {
        consumers: {
          ...state.consumers,
          [consumerId]: { ...consumer, paused: true },
        },
      };
    }),
  // consumer 구독(전송) 재개
  setConsumerResumed: (consumerId) =>
    set((state) => {
      const consumer = state.consumers[consumerId];
      if (!consumer) return {};
      return {
        consumers: {
          ...state.consumers,
          [consumerId]: { ...consumer, paused: false },
        },
      };
    }),

  updatePeerFields: (peerId, partial) =>
    set((state) => {
      const idx = state.peers.findIndex((p) => p.id === peerId);
      if (idx === -1) return {};

      const cur = state.peers[idx];

      // 1) 덮어쓰면 안 되는 값들 정리
      const safePatch: any = { ...partial };

      // null/'' 보호 (geoCity 등)
      for (const k of Object.keys(safePatch)) {
        if (!PRESERVE_IF_NULL_OR_EMPTY.has(k)) continue;
        const v = safePatch[k];
        if (v === null || (typeof v === 'string' && v.trim() === '')) {
          delete safePatch[k];
        }
      }

      // 숫자 필드 방어 (NaN 같은 비정상 값 제거)
      if ('geoLat' in safePatch && !Number.isFinite(Number(safePatch.geoLat))) {
        delete safePatch.geoLat;
      }
      if ('geoLon' in safePatch && !Number.isFinite(Number(safePatch.geoLon))) {
        delete safePatch.geoLon;
      }

      // 2) 마지막에 undefined만 무시하는 머지 적용 (유지!)
      const next = mergeWithoutUndefined(cur, safePatch);

      if (shallowEqual(cur, next)) return {};
      const peers = state.peers.slice();
      peers[idx] = next;
      return { peers };
    }),

  upsertDeviceSummary: (peerId, patch) =>
    set((state) => {
      const idx = state.peers.findIndex((p) => p.id === peerId);

      const base =
        idx === -1
          ? {
              id: peerId,
              displayName: peerId,
              isConnected: true,
              lastSeen: patch.lastSeen ?? Date.now(),
            }
          : state.peers[idx];

      const merged = mergeWithoutUndefined(base, patch as any);

      // lastSeen 버킷 비교
      const sameLastSeenBucket = bucket(base.lastSeen) === bucket(merged.lastSeen);

      // 중첩 객체 shallow 비교 (값 동일 시 변경 취소)
      const sameWifi = shallowEqual((base as any).wifi ?? {}, (merged as any).wifi ?? {});
      const sameStorage = shallowEqual((base as any).storage ?? {}, (merged as any).storage ?? {});

      // top-level 비교 시 lastSeen / wifi / storage 제외
      const prevOmit: any = { ...base };
      const nextOmit: any = { ...merged };
      delete prevOmit.lastSeen;
      delete nextOmit.lastSeen;
      delete prevOmit.wifi;
      delete nextOmit.wifi;
      delete prevOmit.storage;
      delete nextOmit.storage;

      if (shallowEqual(prevOmit, nextOmit) && sameWifi && sameStorage && sameLastSeenBucket) {
        // 의미 있는 변화 없음 → 갱신 생략
        return {};
      }

      if (idx === -1) {
        return { peers: [...state.peers, merged] };
      } else {
        const peers = state.peers.slice();
        peers[idx] = merged;
        return { peers };
      }
    }),

  setPlaceMap: (map) => set({ placeMap: map }),

  refreshPeerGeoIfNeeded: async (peerId, nextIp) => {
    const state = get();
    const peer = state.peers.find((p) => p.id === peerId);
    if (!peer) return;

    const ip = nextIp ?? (peer as any).ip ?? peer.publicIp; // ip가 없으면 publicIp로 보완
    if (!ip || isPrivateIp(ip)) return;

    // 지금 좌표/도시가 “정상적으로 채워져 있는지”
    const hasGeo = Number.isFinite(peer.geoLat) && Number.isFinite(peer.geoLon) && !!peer.geoCity;

    // ⚠️ 좌표가 비어 있으면 같은 IP라도 반드시 다시 시도
    if (peer.lastGeoResolvedIp === ip && hasGeo) {
      return; // 이미 이 IP로 성공한 적 있고, 값도 있음 → 스킵
    }

    try {
      const r = await resolveGeoIp(ip); // 내부에서 ipapi / 서버 프록시 등 호출

      // 문자열/undefined 케이스 대비 숫자 변환
      const lat = Number(r.latitude ?? r.lat);
      const lon = Number(r.longitude ?? r.lon);
      const region = r.region ?? null;
      const city = r.city ?? null;
      const country = r.country_name ?? null;
      const displayPlace = region ?? city ?? country ?? null;

      const ok = Number.isFinite(lat) && Number.isFinite(lon);

      set((s) => ({
        peers: s.peers.map((p) =>
          p.id === peerId
            ? {
                ...p,
                geoLat: ok ? lat : p.geoLat,
                geoLon: ok ? lon : p.geoLon,
                ...(displayPlace ? { geoCity: displayPlace } : {}),
                // 성공일 때만 lastGeoResolvedIp 갱신! (실패 시 갱신 금지 → 다음에 재시도 가능)
                lastGeoResolvedIp: ok ? ip : p.lastGeoResolvedIp,
                // (선택) ok가 아닐 땐 geoAccuracyM 건드리지 않음
              }
            : p,
        ),
      }));
    } catch (e) {
      console.warn('[geoip] resolve failed:', ip, e);
      // 실패 시 lastGeoResolvedIp를 건드리지 않음 → 이후 재시도 가능
    }
  },

  forceRefreshPeerGeo: async (peerId) => {
    const state = get();
    const peer = state.peers.find((p) => p.id === peerId);
    const ip = (peer as any)?.ip ?? peer?.publicIp;
    if (!ip || isPrivateIp(ip)) return;

    invalidateGeoIp(ip); // 캐시 무효화
    await state.refreshPeerGeoIfNeeded(peerId, ip);
  },

  // 오디오 / 비디오 비움
  clearPeerMedia: (peerId: string) =>
    set((s) => ({
      peers: s.peers.map((p) =>
        p.id === peerId
          ? {
              ...p,
              audioTrack: null,
              videoTrack: null,
              audioConsumerId: undefined,
              videoConsumerId: undefined,
            }
          : p,
      ),
    })),
  // 오디오 consumer 비움
  clearPeerAudio: (peerId: string) =>
    set((s) => ({
      peers: s.peers.map((p) =>
        p.id === peerId ? { ...p, audioTrack: undefined, audioConsumerId: undefined } : p,
      ),
    })),

  // 비디오 consumer 비움
  clearPeerVideo: (peerId: string) =>
    set((s) => ({
      peers: s.peers.map((p) =>
        p.id === peerId ? { ...p, videoTrack: undefined, videoConsumerId: undefined } : p,
      ),
    })),
}));
