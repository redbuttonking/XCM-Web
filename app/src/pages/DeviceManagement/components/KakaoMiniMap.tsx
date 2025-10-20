// src/components/KakaoMiniMap.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import { loadKakaoSdk } from '@/lib/kakao';

type KakaoMiniMapProps = {
  center: { lat: number; lon: number };
  acc?: number;
  label?: string;
  lastSeen?: number;
  level?: number;
};

const APPKEY = import.meta.env.VITE_KAKAO_MAP_KEY as string;

function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

export default function KakaoMiniMap({ center, acc, label, lastSeen, level }: KakaoMiniMapProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const infoRef = useRef<any>(null);

  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [autoTrack, setAutoTrack] = useState(true);
  const userInteractingRef = useRef(false);
  const prevPosRef = useRef<{ lat: number; lon: number } | null>(null);
  const prevAccRef = useRef<number | undefined>(undefined);

  // 1) 최초 1회: SDK 로드 + 맵 구성
  useEffect(() => {
    let dead = false;
    if (!divRef.current) return;

    (async () => {
      try {
        setReady(false);
        setErr(null);

        const kakao = await loadKakaoSdk(APPKEY, ['services']);
        if (dead || !divRef.current) return;

        kakao.maps.load(() => {
          if (dead || !divRef.current) return;

          const pos = new kakao.maps.LatLng(center.lat, center.lon);
          const map = new kakao.maps.Map(divRef.current, { center: pos, level: level ?? 5 });
          mapRef.current = map;
          prevPosRef.current = { lat: center.lat, lon: center.lon };

          // 사용자 조작 감지 → 자동 추적 해제
          const onUser = () => {
            userInteractingRef.current = true;
            if (autoTrack) setAutoTrack(false);
            window.setTimeout(() => {
              userInteractingRef.current = false;
            }, 600);
          };
          kakao.maps.event.addListener(map, 'dragstart', onUser);
          kakao.maps.event.addListener(map, 'zoom_changed', onUser);

          const marker = new kakao.maps.Marker({ position: pos });
          marker.setMap(map);
          markerRef.current = marker;

          const radius = typeof acc === 'number' ? acc : 200;
          const circle = new kakao.maps.Circle({
            center: pos,
            radius,
            strokeWeight: 2,
            strokeColor: '#4B5563',
            strokeOpacity: 0.6,
            fillColor: '#3B82F6',
            fillOpacity: 0.2,
          });
          circle.setMap(map);
          circleRef.current = circle;
          prevAccRef.current = radius;

          const info = new kakao.maps.InfoWindow({
            position: pos,
            content: buildInfo(label, center.lat, center.lon, acc, lastSeen),
          });
          infoRef.current = info;
          kakao.maps.event.addListener(marker, 'click', () => info.open(map, marker));

          setReady(true);
        });
      } catch (e: any) {
        console.error('[KakaoMiniMap] init failed:', e);
        setErr(e?.message || 'init failed');
        setReady(false);
      }
    })();

    return () => {
      dead = true;
      if (markerRef.current) markerRef.current.setMap(null);
      if (circleRef.current) circleRef.current.setMap(null);
      infoRef.current?.close?.();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
      infoRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2-A) 지오메트리(센터/정확도) 변화에만 반응 (뷰포트 이동은 조건부)
  const geomSig = useMemo(
    () =>
      JSON.stringify({
        lat: +center.lat.toFixed(6),
        lon: +center.lon.toFixed(6),
        acc: typeof acc === 'number' ? Math.round(acc) : undefined,
      }),
    [center.lat, center.lon, acc],
  );

  useEffect(() => {
    const kakao = (window as any).kakao;
    const map = mapRef.current;
    if (!kakao || !map) return;

    const pos = new kakao.maps.LatLng(center.lat, center.lon);
    markerRef.current?.setPosition(pos);

    const nextRadius = typeof acc === 'number' ? acc : (prevAccRef.current ?? 200);
    // 정확도 변화가 3m 이상일 때만 반영
    if (
      circleRef.current &&
      (prevAccRef.current == null || Math.abs(nextRadius - prevAccRef.current) > 3)
    ) {
      circleRef.current.setOptions({ center: pos, radius: nextRadius });
      prevAccRef.current = nextRadius;
    } else {
      circleRef.current?.setOptions({ center: pos });
    }

    // 뷰포트는 자동추적 & 거리 임계 초과시에만 부드럽게 이동
    if (autoTrack && !userInteractingRef.current) {
      const cur = map.getCenter?.();
      const curPos = cur ? { lat: cur.getLat(), lon: cur.getLng() } : null;
      const prev = prevPosRef.current;

      // 이전 적용 좌표와의 거리
      const distFromPrev = prev
        ? distanceMeters(prev, { lat: center.lat, lon: center.lon })
        : Infinity;

      // 현재 화면 중심과도 비교해 필요할 때만 panTo
      if (!curPos || distanceMeters(curPos, { lat: center.lat, lon: center.lon }) > 15) {
        map.panTo(pos);
        prevPosRef.current = { lat: center.lat, lon: center.lon };
      } else if (distFromPrev > 15) {
        // 사용자 중심은 비슷하지만 데이터 기준 위치가 많이 바뀐 경우 prev만 갱신
        prevPosRef.current = { lat: center.lat, lon: center.lon };
      }
    }
  }, [geomSig, autoTrack]);

  // 2-B) 메타 정보(라벨/라스트씬)만 바뀌면 InfoWindow 내용만 갱신 (뷰포트 X)
  const infoSig = useMemo(
    () =>
      JSON.stringify({
        label,
        seen: lastSeen ? Math.floor(lastSeen / 1000) : undefined,
      }),
    [label, lastSeen],
  );

  useEffect(() => {
    if (!infoRef.current) return;
    infoRef.current.setContent(buildInfo(label, center.lat, center.lon, acc, lastSeen));
  }, [infoSig]); // 뷰포트 이동 없음

  return (
    <div
      className="relative h-[250px] w-full overflow-hidden rounded-xl border"
      aria-busy={!ready}
      aria-live="polite"
    >
      <div
        ref={divRef}
        className={clsx(
          'h-full w-full transition-opacity duration-300',
          ready ? 'opacity-100' : 'opacity-0',
        )}
      />

      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-gray-50">
          <div className="flex items-center gap-2 text-gray-600">
            {!err ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>지도 불러오는 중…</span>
              </>
            ) : (
              <span>지도를 불러오지 못했습니다</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildInfo(label?: string, lat?: number, lon?: number, acc?: number, lastSeen?: number) {
  return `
    <div style="min-width:180px">
      <div style="font-weight:700;margin-bottom:4px">${label ?? ''}</div>
      ${typeof lat === 'number' ? `<div>Lat/Lon: ${lat.toFixed(5)}, ${lon?.toFixed(5)}</div>` : ''}
      ${typeof acc === 'number' ? `<div>Accuracy: ±${Math.round(acc)}m</div>` : ''}
      ${lastSeen ? `<div style="color:#666">Seen: ${new Date(lastSeen).toLocaleString()}</div>` : ''}
    </div>
  `;
}
