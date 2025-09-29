// src/components/DeviceMapKakao.tsx
import { useEffect, useMemo, useRef } from 'react';
import { useRoomStore } from '@/store/useRoomStore';
import { loadKakaoSdk } from '@/lib/kakao';

type PeerOnMap = {
  id: string;
  displayName?: string;
  lat: number;
  lon: number;
  acc?: number;
  ssid?: string;
  bssid?: string | null;
  placeLabel?: string;
  lastSeen?: number;
};

const APPKEY = import.meta.env.VITE_KAKAO_MAP_KEY as string;

export default function DeviceMapKakao() {
  const peers = useRoomStore((s) => s.peers);
  const locatedPeers: PeerOnMap[] = useMemo(
    () =>
      peers
        .filter((p) => typeof p.geoLat === 'number' && typeof p.geoLon === 'number')
        .map((p) => ({
          id: p.id,
          displayName: p.displayName,
          lat: p.geoLat!,
          lon: p.geoLon!,
          acc: p.geoAccuracyM,
          ssid: p.ssid,
          bssid: p.bssid,
          placeLabel: p.placeLabel,
          lastSeen: p.lastSeen,
        })),
    [peers],
  );

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<any>(null);
  const overlaysRef = useRef<{ markers: any[]; circles: any[]; infoWindows: any[] }>({
    markers: [],
    circles: [],
    infoWindows: [],
  });

  useEffect(() => {
    if (!mapRef.current) return;
    let destroyed = false;

    (async () => {
      const kakao = await loadKakaoSdk(APPKEY, ['services']);
      if (destroyed) return;

      const center = locatedPeers.length
        ? new kakao.maps.LatLng(locatedPeers[0].lat, locatedPeers[0].lon)
        : new kakao.maps.LatLng(37.5665, 126.978); // 기본(서울)

      mapObj.current = new kakao.maps.Map(mapRef.current, {
        center,
        level: 5,
      });

      renderPeers();
      fitAll();
    })();

    return () => {
      destroyed = true;
      // 카카오맵은 명시 dispose가 없고, DOM 제거하면 GC됩니다.
      // 오버레이는 수동 제거
      clearOverlays();
      mapObj.current = null;
    };
  }, []);

  const geoSig = useMemo(
    () =>
      JSON.stringify(
        locatedPeers.map((p) => [
          p.id,
          +p.lat.toFixed(5),
          +p.lon.toFixed(5),
          Math.round(p.acc ?? 0),
        ]),
      ),
    [locatedPeers], // 계산은 되지만, 실제 effect는 geoSig 변화에만 반응
  );

  useEffect(() => {
    if (!mapObj.current) return;
    renderPeers();
    fitAll();
  }, [geoSig]);

  useEffect(() => {
    console.log(
      '[DeviceMapKakao] container size:',
      mapRef.current?.clientWidth,
      mapRef.current?.clientHeight,
    );
    console.log('[DeviceMapKakao] kakao?', !!(window as any).kakao);
  }, []);

  const clearOverlays = () => {
    const { markers, circles, infoWindows } = overlaysRef.current;
    markers.forEach((m) => m.setMap(null));
    circles.forEach((c) => c.setMap(null));
    infoWindows.forEach((i) => i.close());
    overlaysRef.current = { markers: [], circles: [], infoWindows: [] };
  };

  const renderPeers = () => {
    const kakao = window.kakao;
    clearOverlays();

    locatedPeers.forEach((p) => {
      const pos = new kakao.maps.LatLng(p.lat, p.lon);
      const marker = new kakao.maps.Marker({ position: pos });
      marker.setMap(mapObj.current);

      const radius = typeof p.acc === 'number' ? p.acc : 200;
      const circle = new kakao.maps.Circle({
        center: pos,
        radius,
        strokeWeight: 2,
        strokeColor: '#4B5563',
        strokeOpacity: 0.6,
        fillColor: '#3B82F6',
        fillOpacity: 0.2,
      });
      circle.setMap(mapObj.current);

      const html = `
        <div style="min-width:220px">
          <div style="font-weight:700;margin-bottom:4px">${p.displayName ?? p.id}</div>
          ${p.placeLabel ? `<div>📍 ${p.placeLabel}</div>` : ''}
          ${p.ssid || p.bssid ? `<div>Wi-Fi: ${p.ssid ?? '-'} ${p.bssid ? `(${p.bssid})` : ''}</div>` : ''}
          <div>Lat/Lon: ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}</div>
          ${p.acc ? `<div>Accuracy ≈ ±${Math.round(p.acc)} m</div>` : ''}
          ${p.lastSeen ? `<div style="color:#666">Seen: ${new Date(p.lastSeen).toLocaleString()}</div>` : ''}
        </div>
      `;
      const iw = new kakao.maps.InfoWindow({ position: pos, content: html });

      kakao.maps.event.addListener(marker, 'click', () => {
        iw.open(mapObj.current, marker);
      });

      overlaysRef.current.markers.push(marker);
      overlaysRef.current.circles.push(circle);
      overlaysRef.current.infoWindows.push(iw);
    });
  };

  const fitAll = () => {
    const kakao = window.kakao;
    if (!locatedPeers.length) return;

    const bounds = new kakao.maps.LatLngBounds();
    locatedPeers.forEach((p) => bounds.extend(new kakao.maps.LatLng(p.lat, p.lon)));
    mapObj.current.setBounds(bounds);

    // 너무 가까우면 level 조정
    const level = mapObj.current.getLevel();
    if (level < 2) mapObj.current.setLevel(2);
  };

  return <div ref={mapRef} className="h-full w-full rounded-xl border" />;
}
