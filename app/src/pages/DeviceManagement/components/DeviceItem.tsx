import { memo } from 'react';
import clsx from 'clsx';
import {
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  ChevronDown,
  MapPin,
  User,
  Smartphone,
  Wifi,
  StickyNote,
  Package,
  RefreshCw,
  HardDrive,
  Mic,
  Video,
  RectangleGoggles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PeerCard } from '@/types/device';
import { MapContainer, TileLayer, Marker, Circle as LeafletCircle, Popup } from 'react-leaflet';

import KakaoMiniMap from './KakaoMiniMap';

type Props = {
  peer: PeerCard;
  expanded: boolean;
  onToggle: () => void;
};

const batteryBarClass = (level?: number) => {
  if (level == null) return 'bg-gray-300';
  if (level <= 30) return 'bg-red-500'; // 빨강
  if (level <= 60) return 'bg-amber-500'; // 주황
  return 'bg-emerald-500'; // 초록 (61~100)
};

const formatGB = (n?: number, digits = 1) =>
  typeof n === 'number' ? `${n.toFixed(digits)} GB` : '-';

// const rssiBadge = (rssi?: number) => {
//   if (typeof rssi !== 'number') return { text: '-', cls: 'bg-gray-200 text-gray-700' };
//   // 대략적인 품질 구간
//   if (rssi >= -55) return { text: `${rssi} dBm (강함)`, cls: 'bg-emerald-100 text-emerald-700' };
//   if (rssi >= -67) return { text: `${rssi} dBm (양호)`, cls: 'bg-lime-100 text-lime-700' };
//   if (rssi >= -75) return { text: `${rssi} dBm (보통)`, cls: 'bg-amber-100 text-amber-700' };
//   return { text: `${rssi} dBm (약함)`, cls: 'bg-rose-100 text-rose-700' };
// };

const DeviceItem = memo(({ peer, expanded, onToggle }: Props) => {
  const level: number | undefined = peer.battery?.level;
  const wifi = (peer as any).wifi || {};
  const isHMD = ['quest', 'meta', 'oculus'].some((k) =>
    (peer.modelName ?? '').toLowerCase().includes(k),
  );

  // const rssiInfo = rssiBadge(wifi.rssiDbm);

  // 저장공간 계산 (bytes 단위 가정: total/free가 KB면 적절히 바꿔줘)
  const total = (peer as any).storage?.total;
  const free = (peer as any).storage?.free;

  const used =
    typeof total === 'number' && typeof free === 'number' ? Math.max(total - free, 0) : undefined;

  const usedPct =
    typeof total === 'number' && typeof used === 'number' && total > 0
      ? Math.round((used / total) * 100)
      : undefined;

  // 미디어 상태 (있으면 true)
  // const hasMicTx = !!(peer as any).audioTrack;
  // const hasVidTx = !!(peer as any).videoTrack;
  // const hasMicRx = !!(peer as any).audioConsumerId;
  // const hasVidRx = !!(peer as any).videoConsumerId;

  return (
    <div
      className={clsx(
        'rounded-2xl border bg-white shadow-sm transition-all',
        expanded ? 'ring-1 ring-black/5' : 'hover:shadow-md',
      )}
    >
      {/* 헤더(요약) */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <div
          className={clsx(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl border',
            peer.isConnected ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50',
          )}
        >
          {isHMD ? (
            <RectangleGoggles
              className={clsx('size-5', peer.isConnected ? 'text-emerald-600' : 'text-gray-500')}
            />
          ) : (
            <Smartphone
              className={clsx('size-5', peer.isConnected ? 'text-emerald-600' : 'text-gray-500')}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-lg font-semibold">{peer.displayName}</span>
            <span
              className={clsx(
                'inline-flex items-center rounded-md px-2 py-0.5 text-sm',
                peer.isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 opacity-70',
              )}
            >
              {peer.isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-sm font-bold text-gray-600">
            <span className="inline-flex items-center gap-1">
              모델명 : {peer.modelName ?? 'Unknown Device'}
            </span>

            <span className="inline-flex items-center gap-1">
              {isHMD ? (
                <img src="/public/icons/headset-icon.svg" />
              ) : (
                <Smartphone className={clsx('size-5')} />
              )}

              <span className="ml-1 h-[14px] w-8 overflow-hidden rounded bg-gray-200">
                <span
                  className={clsx('block h-full', batteryBarClass(level))}
                  style={{ width: `${Math.max(0, Math.min(100, level ?? 0))}%` }}
                />
              </span>
              {level != null ? `${level}%` : '-'}
            </span>

            <span className="inline-flex items-center gap-2">
              <img
                className="group-data-[collapsed=true]:pr-[0px]"
                src="/public/icons/controller-icon.svg"
              />
              <div className="flex items-center justify-center gap-1">
                <span className="inline-flex size-[18px] select-none items-center justify-center rounded-full border border-current text-[10px] font-semibold leading-none text-current">
                  L
                </span>
                {peer.controllerBattery?.left === -1 ? (
                  <span>-</span>
                ) : (
                  <span>{peer.controllerBattery?.left}%</span>
                )}
              </div>
              <div className="flex items-center justify-center gap-1">
                <span className="inline-flex size-[18px] select-none items-center justify-center rounded-full border border-current text-[10px] font-semibold leading-none text-current">
                  R
                </span>
                {peer.controllerBattery?.right === -1 ? (
                  <span>-</span>
                ) : (
                  <span>{peer.controllerBattery?.right}%</span>
                )}
              </div>
            </span>

            <span className="inline-flex items-center gap-1">
              <Wifi className="size-5 opacity-70" />
              <span className="truncate">{peer.ssid ?? wifi.ssid ?? '-'}</span>
            </span>
          </div>
        </div>

        <ChevronDown
          className={clsx('size-5 shrink-0 transition-transform', expanded && 'rotate-180')}
        />
      </button>

      {/* 바디(자세히) */}
      {expanded && (
        <div className="grid grid-cols-12 gap-4 px-4 pb-4">
          {/* 위치 & 네트워크 */}
          <div className="col-span-12 space-y-4 lg:col-span-7">
            <div className="rounded-xl border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                <MapPin className="size-4" />
                위치 / 네트워크
              </div>
              <div className="space-y-2 text-sm text-gray-700">
                {peer.placeLabel && (
                  <div>
                    장소: <span className="font-medium">{peer.placeLabel}</span>
                  </div>
                )}
                {peer.geoCity && (
                  <div>
                    <span className="font-bold">지역 : </span>
                    <span className="font-medium">{peer.geoCity}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1">
                  <span className="font-bold">IP : </span>
                  <span>{peer.ip ?? '-'}</span>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  <Wifi className="size-4" />
                  <span className="font-bold">SSID :</span>
                  <span className="font-medium">{peer.ssid ?? wifi.ssid ?? '-'}</span>

                  <span className="font-bold">BSSID :</span>
                  <span className="font-medium">{peer.bssid ?? wifi.bssid ?? '-'}</span>
                </div>

                <div>
                  <span className="font-bold">Last Seen : </span>
                  {peer.lastSeen ? new Date(peer.lastSeen).toLocaleString() : '-'}
                </div>
              </div>
            </div>
            {/* 지도 */}
            {typeof peer.geoLat === 'number' && typeof peer.geoLon === 'number' && (
              <KakaoMiniMap
                center={{ lat: peer.geoLat as number, lon: peer.geoLon as number }}
                acc={peer.geoAccuracyM}
                label={peer.displayName ?? peer.id}
                lastSeen={peer.lastSeen}
              />
            )}
            {/* 미디어 상태 */}
            {/* <div className="rounded-xl border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                <Mic className="size-4" />
                미디어 상태
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={clsx(
                    'inline-flex items-center gap-1 rounded px-2 py-0.5',
                    hasMicTx ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 opacity-70',
                  )}
                >
                  <Mic className="size-4" />
                  Mic TX
                </span>
                <span
                  className={clsx(
                    'inline-flex items-center gap-1 rounded px-2 py-0.5',
                    hasMicRx ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 opacity-70',
                  )}
                >
                  <Mic className="size-4" />
                  Mic RX
                </span>
                <span
                  className={clsx(
                    'inline-flex items-center gap-1 rounded px-2 py-0.5',
                    hasVidTx ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 opacity-70',
                  )}
                >
                  <Video className="size-4" />
                  Video TX
                </span>
                <span
                  className={clsx(
                    'inline-flex items-center gap-1 rounded px-2 py-0.5',
                    hasVidRx ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 opacity-70',
                  )}
                >
                  <Video className="size-4" />
                  Video RX
                </span>
              </div>
              {(peer as any).audioConsumerId || (peer as any).videoConsumerId ? (
                <div className="mt-2 text-xs text-gray-500">
                  audioConsumerId: {(peer as any).audioConsumerId ?? '-'} · videoConsumerId:{' '}
                  {(peer as any).videoConsumerId ?? '-'}
                </div>
              ) : null}
            </div> */}
          </div>

          {/* 저장공간 & 메모/앱 */}
          <div className="col-span-12 space-y-4 lg:col-span-5">
            <div className="rounded-xl border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                <HardDrive className="size-4" />
                저장공간
              </div>
              <div className="space-y-1 text-sm text-gray-700">
                <div>
                  총 용량: <span className="font-medium">{formatGB(total)}</span>
                </div>
                <div>
                  여유: <span className="font-medium">{formatGB(free)}</span>
                </div>
                <div>
                  사용: <span className="font-medium">{formatGB(used)}</span>{' '}
                  {usedPct != null ? `(${usedPct}%)` : ''}
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded bg-gray-200">
                  <span
                    className="block h-2 bg-sky-500"
                    style={{ width: `${Math.max(0, Math.min(100, usedPct ?? 0))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                <StickyNote className="size-4" />
                메모
              </div>
              <div className="text-sm text-gray-700">
                {/* {peer.memo ?? <span className="text-gray-400">메모가 없습니다.</span>} */}
                <span className="text-gray-400">메모가 없습니다.</span>
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                <Package className="size-4" />앱 설치 상태
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{peer.appInstallStatus ?? 'idle'}</span>
                <div className="flex items-center gap-2"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

DeviceItem.displayName = 'DeviceItem';

export default DeviceItem;
