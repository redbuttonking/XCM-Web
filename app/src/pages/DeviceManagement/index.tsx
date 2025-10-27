import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useRoomStore } from '@/store/useRoomStore';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from '@/components/ui/select';
import { loadCachedPeerCards } from '@/core/deviceCache';
import type { PeerCard } from '@/types/device';
import DeviceItem from './components/DeviceItem';
import FilterSelect from '@/components/FilterSelect';
import { pruneNullish } from '@/core/sanitize.ts';

const STALE_MS = 30_000;

function resolvePlaceLabel(
  map: { ssidMap: Record<string, string>; bssidMap: Record<string, string> } | undefined,
  ssid?: string | null,
  bssid?: string | null,
) {
  if (!map) return undefined;
  const b = bssid?.toLowerCase();
  if (b && map.bssidMap[b]) return map.bssidMap[b];
  if (ssid && map.ssidMap[ssid]) return map.ssidMap[ssid];
  return undefined;
}

const DeviceManagement = () => {
  const { peers, joined, roomClient, placeMap, setPlaceMap, updatePeerFields } = useRoomStore(
    useShallow((s) => ({
      peers: s.peers,
      joined: s.joined,
      roomClient: s.roomClient,
      placeMap: s.placeMap,
      setPlaceMap: s.setPlaceMap,
      updatePeerFields: s.updatePeerFields,
    })),
  );
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'connected' | 'offline'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cachedPeers, setCachedPeers] = useState<PeerCard[]>([]);

  const onToggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // 1) 온라인 + 오프라인 기기 상태 병합
  const allPeers: PeerCard[] = useMemo(() => {
    const byId = new Map<string, PeerCard>();

    // 1-1) 캐시 먼저: 기본 오프라인 취급
    for (const c of cachedPeers) {
      byId.set(c.id, { ...c, isConnected: false });
    }

    // 1-2) 온라인이 오면 덮어쓰기 (실시간 우선)
    for (const live of peers ?? []) {
      const prev = byId.get(live.id);
      const liveClean = pruneNullish(live);
      byId.set(live.id, {
        ...(prev ?? ({} as PeerCard)),
        ...liveClean,
        // geoCity는 live에 유효 문자열이 있을 때만 교체, 없으면 prev 유지
        geoCity: (typeof live.geoCity === 'string' && live.geoCity.trim()) || prev?.geoCity,
        // 온라인 값 없으면 캐시로 보강(옵션)
        battery: live.battery ?? prev?.battery,
        wifi: live.wifi ?? prev?.wifi,
        storage: live.storage ?? prev?.storage,
        placeLabel: live.placeLabel ?? prev?.placeLabel,
        geoLat: typeof live.geoLat === 'number' ? live.geoLat : prev?.geoLat,
        geoLon: typeof live.geoLon === 'number' ? live.geoLon : prev?.geoLon,
        geoAccuracyM:
          typeof live.geoAccuracyM === 'number' ? live.geoAccuracyM : prev?.geoAccuracyM,
        // 연결 상태는 온라인 기준
        isConnected: !!live.isConnected,
      });
    }

    return Array.from(byId.values());
  }, [cachedPeers, peers]);

  // peer 필터링
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (allPeers ?? [])
      .filter((p) => {
        if (status === 'connected' && !p.isConnected) return false;
        if (status === 'offline' && p.isConnected) return false;
        if (!q) return true;
        const hay =
          `${p.modelName ?? ''} ${p.displayName ?? ''} ${p.ssid ?? ''} ${p.placeLabel ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        // 연결된 기기 우선 정렬
        const ca = a.isConnected ? 0 : 1;
        const cb = b.isConnected ? 0 : 1;
        if (ca !== cb) return ca - cb;
        return (a.displayName ?? '').localeCompare(b.displayName ?? '');
      });
  }, [allPeers, query, status]);

  // 기기 상태 수동 새로고침 (버튼 안 만듦)
  const refreshNow = () => {
    if (!joined || !roomClient) return;
    const ids = (peers ?? []).map((p) => p.id);
    if (ids.length) roomClient.requestStatusSummary(ids);
  };

  // 첫 진입 시 1회 로드 (또는 필요하면 visibility 변화 때 재로드)
  useEffect(() => {
    loadCachedPeerCards()
      .then((rows) =>
        setCachedPeers(
          rows.map((p) => ({
            ...p,
            geoCity:
              typeof p.geoCity === 'string' && p.geoCity.trim() ? p.geoCity.trim() : undefined, // false, '', null 모두 걷어냄
          })),
        ),
      )
      .catch((e) => console.warn('[DeviceManagement] cache load failed:', e));
  }, []);

  // place-map 받아오기 (초기 1회)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/place-map', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setPlaceMap(json);
        console.log('[DeviceManagement] 📥 place-map loaded:', json);
      } catch (e) {
        console.warn('[DeviceManagement] place-map load failed:', e);
      }
    })();
  }, [setPlaceMap]);

  // DC(서버 push) 구독: 콘솔 출력 + 라벨 붙여 store 반영
  useEffect(() => {
    if (!roomClient) return;
    const unSub = roomClient.subscribeDcMessage((msg: any) => {
      // 테스트용 콘솔 출력
      console.log('[DeviceManagement] 🔔 DC message from server:', msg);

      // status.* 계열만 라벨 반영
      const t = msg?.type;
      if (
        t === 'status.summary.push' ||
        t === 'status.summary.res' ||
        t === 'status.detail.res' ||
        t === 'status.heartbeat' ||
        t === 'status.enriched' // 서버에서 StatusHub 쓰는 경우
      ) {
        const peerId: string | undefined = msg?.peerId;
        const wifi = msg?.payload?.wifi || {};

        // ✅ 추가: 좌표/정확도 추출(서버/앱마다 키가 다를 수 있어 유연하게)
        const g = msg?.payload?.geo || msg?.payload?.pos || null;
        const geoAcc =
          msg?.payload?.geoAccuracy ?? msg?.payload?.accuracyM ?? msg?.payload?.accuracy ?? null;

        if (peerId) {
          updatePeerFields(
            peerId,
            pruneNullish({
              ssid: wifi.ssid,
              bssid: wifi.bssid,
              // ✅ city > geoCity > region
              geoCity:
                (typeof msg?.payload?.city === 'string' && msg.payload.city) ||
                (typeof msg?.payload?.geoCity === 'string' && msg.payload.geoCity) ||
                (typeof msg?.payload?.region === 'string' && msg.payload.region) ||
                undefined,
              placeLabel: resolvePlaceLabel(placeMap, wifi.ssid, wifi.bssid),

              geoLat: typeof g?.lat === 'number' ? g.lat : undefined,
              geoLon: typeof g?.lon === 'number' ? g.lon : undefined,
              geoAccuracyM: typeof geoAcc === 'number' ? geoAcc : undefined,

              lastSeen: msg?.ts ?? Date.now(),
            }),
          );
        }
      }
    });
    return unSub;
  }, [roomClient, placeMap, updatePeerFields]);

  // placeMap이 갱신되면 기존 peer들에도 라벨을 역산해 채워 넣기
  useEffect(() => {
    if (!placeMap || !peers?.length) return;
    for (const p of peers) {
      const next = resolvePlaceLabel(placeMap, p.ssid, p.bssid);
      if (next && next !== p.placeLabel) {
        updatePeerFields(p.id, { placeLabel: next });
      }
    }
  }, [placeMap, peers, updatePeerFields]);

  useEffect(() => {
    const unsub = useRoomStore.subscribe((state, prev) => {
      if (state.peers !== prev.peers) {
        console.log(
          '[peers changed]',
          state.peers.map((p) => ({
            id: p.id,
            battery: p.battery,
            ssid: p.ssid,
            placeLabel: p.placeLabel,
          })),
        );
      }
    });
    return unsub;
  }, []);

  // 현재 peer가 나가면 도시값(경기도)이 false로 남음
  useEffect(() => {
    console.log('peer의 상태값', filtered);
  }, [filtered]);

  // // 주기 폴링(신선도)
  // useEffect(() => {
  //   if (!joined || !roomClient) return;
  //   const tick = () => {
  //     const ids = useRoomStore.getState().peers.map((p) => p.id);
  //     if (ids.length) roomClient.requestStatusSummary(ids);
  //   };
  //   tick(); // 바로 한 번
  //   const timer = setInterval(tick, 15_000);
  //   return () => clearInterval(timer);
  // }, [joined, roomClient]);

  useEffect(() => {
    console.log(
      '[check]',
      (peers ?? []).map((p) => ({
        id: p.id,
        ip: (p as any).ip ?? p.publicIp,
        city: p.geoCity,
        lat: p.geoLat,
        lon: p.geoLon,
        lastGeoResolvedIp: p.lastGeoResolvedIp,
      })),
    );
    console.log(peers);
  }, [peers]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="pb-4">
        <h2 className="pb-[40px] text-2xl font-bold text-black">Device Management</h2>

        <div className="rounded-2xl backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="모델명 / 사용자"
                className="h-[44px] w-[320px] border-gray-300 bg-white/90 text-gray-800 backdrop-blur hover:bg-white focus-visible:ring-1 focus-visible:ring-gray-300"
              />
              <FilterSelect
                options={[
                  { label: '전체', value: 'all' },
                  { label: '연결됨', value: 'connected' },
                  { label: '오프라인', value: 'offline' },
                ]}
                value={status}
                onChange={(v) => setStatus(v as typeof status)}
                placeholder="연결 상태"
                triggerWidthClass="w-[160px]"
                className="h-[44px] border-gray-300 bg-white/90 text-gray-800 backdrop-blur hover:bg-white focus-visible:ring-1 focus-visible:ring-gray-300"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 2) 하단 스크롤 영역: 리스트만 스크롤 (스크롤 O) ─────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto p-[16px]">
        <div className="space-y-3 pb-10 pr-1">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border bg-white p-8 text-center text-gray-500">
              조건에 맞는 기기가 없습니다.
            </div>
          ) : (
            filtered.map((p) => (
              <DeviceItem
                key={p.id}
                peer={p}
                expanded={expanded.has(p.id)}
                onToggle={() => onToggle(p.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceManagement;
