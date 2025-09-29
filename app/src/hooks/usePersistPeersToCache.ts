// src/core/usePersistPeersToCache.ts
import { useEffect, useRef } from 'react';
import { useRoomStore, type PeerInfo } from '@/store/useRoomStore';
import { upsertDeviceSnapshot } from '../core/utils';
import type { StorageSnapshot, WifiSnapshot } from '@/types/device';

const usePersistPeersToCache = () => {
  // ✅ “초기 flush만 한번”을 위한 플래그
  const didInitialFlushRef = useRef(false);
  const lastSavedHashRef = useRef<Map<string, string>>(new Map());

  const toWifiSnapshot = (p: PeerInfo): WifiSnapshot | undefined => {
    if (p.wifi) return p.wifi;
    if (p.ssid || (p as any).bssid) {
      const maybeRssi = (p as any).wifi?.rssiDbm;
      const maybeLink = (p as any).wifi?.linkSpeedMbps;
      return {
        ssid: p.ssid ?? undefined,
        bssid: (p as any).bssid ?? undefined,
        rssiDbm: typeof maybeRssi === 'number' ? maybeRssi : undefined,
        linkSpeedMbps: typeof maybeLink === 'number' ? maybeLink : undefined,
      };
    }
    return undefined;
  };

  const toStorageSnapshot = (p: PeerInfo): StorageSnapshot | undefined => {
    if (!p.storage) return undefined;
    const total =
      typeof p.storage.total === 'number' ? p.storage.total : Number(p.storage.total ?? NaN);
    const free =
      typeof p.storage.free === 'number' ? p.storage.free : Number(p.storage.free ?? NaN);
    return {
      total: Number.isFinite(total) ? total : undefined,
      free: Number.isFinite(free) ? free : undefined,
    };
  };

  useEffect(() => {
    const hashPeer = (p: PeerInfo) => {
      const pick = {
        id: p.id,
        displayName: p.displayName,
        modelName: p.modelName,
        battery: p.battery,
        controllerBattery: p.controllerBattery,
        ssid: p.ssid,
        ip: p.ip ?? p.publicIp,
        geoCity: p.geoCity,
        placeLabel: p.placeLabel,
        lastSeen: p.lastSeen,
        summaryUpdatedAt: p.summaryUpdatedAt,
        detailUpdatedAt: p.detailUpdatedAt,
        isConnected: p.isConnected,
        geoLat: p.geoLat,
        geoLon: p.geoLon,
        geoAccuracyM: p.geoAccuracyM,
        wifi: toWifiSnapshot(p),
        storage: toStorageSnapshot(p),
      };
      return JSON.stringify(pick);
    };

    const saveOne = async (p: PeerInfo) => {
      if (!p?.id) return;

      const hash = hashPeer(p);
      const prev = lastSavedHashRef.current.get(p.id);
      if (prev === hash) return;
      lastSavedHashRef.current.set(p.id, hash);

      const payload = {
        peerId: p.id,
        displayName: p.displayName,
        modelName: p.modelName,
        battery: p.battery,
        controllerBattery: p.controllerBattery,
        ssid: p.ssid,
        ip: p.ip ?? p.publicIp,
        geoCity: p.geoCity,
        placeLabel: p.placeLabel,
        lastSeen: p.lastSeen,
        summaryUpdatedAt: p.summaryUpdatedAt,
        detailUpdatedAt: p.detailUpdatedAt,
        isConnected: p.isConnected,
        geoLat: p.geoLat,
        geoLon: p.geoLon,
        geoAccuracyM: p.geoAccuracyM,
        wifi: toWifiSnapshot(p),
        storage: toStorageSnapshot(p),
      };

      try {
        await upsertDeviceSnapshot(JSON.parse(JSON.stringify(payload)));
      } catch (e) {
        console.error('[cache] upsert failed', e);
      }
    };

    const flush = (peers?: PeerInfo[] | null) => {
      const list = peers ?? [];
      for (const p of list) saveOne(p).catch((e) => console.warn('[cache] saveOne error', e));
    };

    // ✅ 초기 flush는 “딱 한 번만”
    if (!didInitialFlushRef.current) {
      const initialPeers = useRoomStore.getState().peers;
      flush(initialPeers);
      didInitialFlushRef.current = true;
    }

    // ✅ 항상 구독을 설정한다 (StrictMode 2회 실행에도 최종적으로 구독이 살아있게)
    const unsub = useRoomStore.subscribe((state, prev) => {
      if (state.peers === prev.peers) return; // ref 동일 시 스킵
      flush(state.peers);
    });

    // 🧹 매번 클린업에서 해제
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, []); // ← 의도적으로 빈 deps
};

export default usePersistPeersToCache;
