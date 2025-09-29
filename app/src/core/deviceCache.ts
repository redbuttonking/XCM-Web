// src/core/deviceCache.ts
import type {
  BatteryObj,
  WifiSnapshot,
  StorageSnapshot,
  PeerCard,
  DeviceRecord,
} from '@/types/device';
import { loadAllDeviceSnapshots, upsertDeviceSnapshot } from './utils';

export function normalizeToPeerCard(row: DeviceRecord): PeerCard {
  const battery: BatteryObj | undefined =
    row?.battery && typeof row.battery === 'object'
      ? (row.battery as BatteryObj)
      : typeof row?.battery === 'number'
        ? { level: row.battery }
        : undefined;

  const wifi: WifiSnapshot | undefined = row.wifi;
  const storage: StorageSnapshot | undefined = row.storage;

  return {
    id: row.peerId,
    displayName: row.displayName,
    modelName: row.modelName,
    battery,
    controllerBattery: row.controllerBattery,
    ssid: row.ssid,
    ip: row.ip,
    geoCity: row.geoCity,
    placeLabel: row.placeLabel,
    lastSeen: row.lastSeen,
    isConnected: false, // 캐시는 기본 오프라인 취급
    geoLat: row.geoLat,
    geoLon: row.geoLon,
    geoAccuracyM: row.geoAccuracyM,
    wifi,
    storage,
  };
}

export async function loadCachedPeerCards(): Promise<PeerCard[]> {
  const rows = await loadAllDeviceSnapshots();
  return rows.map(normalizeToPeerCard);
}

export { upsertDeviceSnapshot };
