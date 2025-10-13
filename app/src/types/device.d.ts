export type PeerCard = {
  id: string;
  modelName?: string;
  displayName?: string;
  battery?: BatteryObj;
  controllerBattery?: {
    left?: number;
    right?: number;
  };
  isConnected?: boolean;
  ip?: string;
  placeLabel?: string;
  geoCity?: string;
  lastSeen?: number;
  appInstallStatus?: 'idle' | 'installing' | 'installed' | 'failed';
  notes?: string;
  //위치 관련
  geoLat?: number;
  geoLon?: number;
  geoAccuracyM?: number;
  //wifi 관련
  bssid?: string | null;
  ssid?: string;
  wifi?: WifiSnapshot;
  // 저장공간
  storage?: StorageSnapshot;
  // 미디어 소비 상태
  audioConsumerId?: string;
  videoConsumerId?: string;
};

export type AppInfo = {
  pkg: string;
  label?: string;
  versionName?: string;
  versionCode?: number;
};

// 베터리 유니온 타입으로
export type BatteryObj = { level?: number; charging?: boolean };

// wifi
export type WifiSnapshot = {
  ssid?: string;
  bssid?: string;
  rssiDbm?: number;
  linkSpeedMbps?: number;
};

// 저장용량
export type StorageSnapshot = {
  total?: number; // bytes or KB (UI에서 포맷 처리)
  free?: number; // bytes or KB
};

export type StatusSummary = {
  modelName?: string;
  battery?: number | BatteryObj;
  controllerBattery?: {
    left?: number;
    right?: number;
  }; // 0..100 (VR 컨트롤러 등)
  ssid?: string;
  bssid?: string | null;
  ip?: string; // local ip
  geoCity?: string; // 서버에서 역지오 결과(권장)
  placeLabel?: string; // 사내 장소 라벨
  wifi?: WifiSnapshot;
  storage?: StorageSnapshot;
  publicIp?: string;
};

export type StatusDetail = {
  apps?: AppInfo[];
  notes?: string;
  // 필요하면 logs, storage 등 확장
};

// 스토어에서 신선도/상태 체크용 메타(선택)
export type DeviceTimestamps = {
  lastSeen?: number; // heartbeat/summary 수신 시 갱신
  summaryUpdatedAt?: number; // 요약 수신 시
  detailUpdatedAt?: number; // 상세 수신 시
};

export type DeviceRecord = {
  peerId: string;
  displayName?: string;
  modelName?: string;
  battery?: number | BatteryObj;
  controllerBattery?: {
    left?: number;
    right?: number;
  };
  ssid?: string;
  ip?: string;
  geoCity?: string;
  placeLabel?: string;
  lastSeen?: number;
  summaryUpdatedAt?: number;
  detailUpdatedAt?: number;
  isConnected?: boolean;
  geoLat?: number;
  geoLon?: number;
  geoAccuracyM?: number;
  wifi?: WifiSnapshot;
  storage?: StorageSnapshot;
};
