// // src/components/KakaoMiniMap.tsx
// import { useEffect, useMemo, useRef } from 'react';
// import { useRoomStore } from '@/store/useRoomStore';
// import { loadKakaoSdk } from '@/lib/kakao';

// type PeerOnMap = {
//   id: string;
//   displayName?: string;
//   lat: number;
//   lon: number;
//   acc?: number;
//   lastSeen?: number;
// };

// const APPKEY = import.meta.env.VITE_KAKAO_MAP_KEY as string; // .env.local에 설정한 키
// // const key = import.meta.env.
// export default function KakaoMiniMap() {
//   // 1) store에서 좌표가 있는 peer만 추출
//   const peers = useRoomStore((s) => s.peers);
//   const locatedPeers: PeerOnMap[] = useMemo(
//     () =>
//       (peers ?? [])
//         .filter((p) => typeof p.geoLat === 'number' && typeof p.geoLon === 'number')
//         .map((p) => ({
//           id: p.id,
//           displayName: p.displayName,
//           lat: p.geoLat as number,
//           lon: p.geoLon as number,
//           acc: p.geoAccuracyM,
//           lastSeen: p.lastSeen,
//         })),
//     [peers],
//   );

//   // 2) 기본 센터(아무도 없을 때)
//   const defaultCenter: [number, number] = locatedPeers.length
//     ? [locatedPeers[0].lat, locatedPeers[0].lon]
//     : [37.5665, 126.978]; // 서울 시청 근처

//   // 3) 카카오맵 객체 & 오버레이 레퍼런스
//   const mapDivRef = useRef<HTMLDivElement | null>(null);
//   const mapRef = useRef<any>(null);
//   const overlaysRef = useRef<{ markers: any[]; circles: any[]; infoWindows: any[] }>({
//     markers: [],
//     circles: [],
//     infoWindows: [],
//   });

//   // 4) 초기 로드: SDK 불러오고 맵 생성
//   useEffect(() => {
//     if (!mapDivRef.current) return;
//     let destroyed = false;

//     (async () => {
//       const kakao = await loadKakaoSdk(APPKEY, ['services']); // services 라이브러리 로드
//       if (destroyed) return;

//       const center = new kakao.maps.LatLng(defaultCenter[0], defaultCenter[1]);
//       mapRef.current = new kakao.maps.Map(mapDivRef.current, { center, level: 5 });

//       renderPeers();
//       fitAll();
//     })();

//     return () => {
//       destroyed = true;
//       clearOverlays();
//       mapRef.current = null;
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []); // 최초 1회

//   // 5) peers 변경 시 반영
//   const geoSig = useMemo(
//     () =>
//       JSON.stringify(
//         locatedPeers.map((p) => [
//           p.id,
//           +p.lat.toFixed(5),
//           +p.lon.toFixed(5),
//           Math.round(p.acc ?? 0),
//         ]),
//       ),
//     [locatedPeers],
//   );
//   useEffect(() => {
//     if (!mapRef.current) return;
//     renderPeers();
//     fitAll();
//   }, [geoSig]);

//   useEffect(() => {
//     console.log('피어의 값이 뭐게', locatedPeers);
//   }, []);

//   // --- helpers ---
//   const clearOverlays = () => {
//     const { markers, circles, infoWindows } = overlaysRef.current;
//     markers.forEach((m) => m.setMap(null));
//     circles.forEach((c) => c.setMap(null));
//     infoWindows.forEach((i) => i.close());
//     overlaysRef.current = { markers: [], circles: [], infoWindows: [] };
//   };

//   const renderPeers = () => {
//     const kakao = window.kakao;
//     if (!kakao || !mapRef.current) return;

//     clearOverlays();

//     locatedPeers.forEach((p) => {
//       const pos = new kakao.maps.LatLng(p.lat, p.lon);

//       const marker = new kakao.maps.Marker({ position: pos });
//       marker.setMap(mapRef.current);

//       const radius = typeof p.acc === 'number' ? p.acc : 200; // m
//       const circle = new kakao.maps.Circle({
//         center: pos,
//         radius,
//         strokeWeight: 2,
//         strokeColor: '#4B5563',
//         strokeOpacity: 0.6,
//         fillColor: '#3B82F6',
//         fillOpacity: 0.2,
//       });
//       circle.setMap(mapRef.current);

//       const html = `
//         <div style="min-width:180px">
//           <div style="font-weight:700;margin-bottom:4px">${p.displayName ?? p.id}</div>
//           <div>Lat/Lon: ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}</div>
//           ${typeof p.acc === 'number' ? `<div>Accuracy: ±${Math.round(p.acc)}m</div>` : ''}
//           ${p.lastSeen ? `<div style="color:#666">Seen: ${new Date(p.lastSeen).toLocaleString()}</div>` : ''}
//         </div>
//       `;
//       const iw = new kakao.maps.InfoWindow({ position: pos, content: html });
//       kakao.maps.event.addListener(marker, 'click', () => iw.open(mapRef.current, marker));

//       overlaysRef.current.markers.push(marker);
//       overlaysRef.current.circles.push(circle);
//       overlaysRef.current.infoWindows.push(iw);
//     });
//   };

//   const fitAll = () => {
//     const kakao = window.kakao;
//     if (!kakao || !mapRef.current) return;

//     if (!locatedPeers.length) {
//       // 아무도 없으면 기본 센터/레벨로
//       mapRef.current.setCenter(new kakao.maps.LatLng(defaultCenter[0], defaultCenter[1]));
//       mapRef.current.setLevel(5);
//       return;
//     }

//     const bounds = new kakao.maps.LatLngBounds();
//     locatedPeers.forEach((p) => bounds.extend(new kakao.maps.LatLng(p.lat, p.lon)));
//     mapRef.current.setBounds(bounds);

//     // 너무 가까우면 레벨 보정
//     const level = mapRef.current.getLevel();
//     if (level < 2) mapRef.current.setLevel(2);
//   };

//   // 6) 컨테이너 (높이 250px 고정: 예전 Mini 스타일)
//   return <div ref={mapDivRef} className="h-[250px] w-full overflow-hidden rounded-xl border" />;
// }

// src/components/KakaoMiniMap.tsx
import { useEffect, useMemo, useRef } from 'react';
import { loadKakaoSdk } from '@/lib/kakao';

type KakaoMiniMapProps = {
  center: { lat: number; lon: number }; // 필수
  acc?: number; // 정확도(m)
  label?: string; // 디바이스 이름
  lastSeen?: number; // timestamp(ms)
  level?: number; // 초기 줌 레벨(옵션)
};

const APPKEY = import.meta.env.VITE_KAKAO_MAP_KEY as string;

export default function KakaoMiniMap({ center, acc, label, lastSeen, level }: KakaoMiniMapProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const infoRef = useRef<any>(null);

  // 1) 최초 1회: SDK 로드 + 맵/오버레이 생성
  useEffect(() => {
    let dead = false;
    if (!divRef.current) return;

    (async () => {
      const kakao = await loadKakaoSdk(APPKEY, ['services']);
      if (dead || !divRef.current) return;

      const pos = new kakao.maps.LatLng(center.lat, center.lon);
      mapRef.current = new kakao.maps.Map(divRef.current, { center: pos, level: level ?? 5 });

      markerRef.current = new kakao.maps.Marker({ position: pos });
      markerRef.current.setMap(mapRef.current);

      const radius = typeof acc === 'number' ? acc : 200;
      circleRef.current = new kakao.maps.Circle({
        center: pos,
        radius: typeof acc === 'number' ? acc : 200,
        strokeWeight: 2,
        strokeColor: '#4B5563',
        strokeOpacity: 0.6,
        fillColor: '#3B82F6',
        fillOpacity: 0.2,
      });
      circleRef.current.setMap(mapRef.current);

      infoRef.current = new kakao.maps.InfoWindow({
        position: pos,
        content: buildInfo(label, center.lat, center.lon, acc, lastSeen),
      });
      kakao.maps.event.addListener(markerRef.current, 'click', () =>
        infoRef.current.open(mapRef.current, markerRef.current),
      );

      fitToRadius(kakao, mapRef.current, { lat: center.lat, lon: center.lon }, radius);
    })();

    return () => {
      dead = true;
      if (markerRef.current) markerRef.current.setMap(null);
      if (circleRef.current) circleRef.current.setMap(null);
      infoRef.current?.close();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
      infoRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 최초 1회만

  // 2) props가 바뀌면 오버레이만 업데이트
  const sig = useMemo(
    () =>
      JSON.stringify({
        lat: +center.lat.toFixed(6),
        lon: +center.lon.toFixed(6),
        acc: typeof acc === 'number' ? Math.round(acc) : undefined,
        label,
        seen: lastSeen ? Math.floor(lastSeen / 1000) : undefined,
      }),
    [center.lat, center.lon, acc, label, lastSeen],
  );

  useEffect(() => {
    const kakao = (window as any).kakao;
    if (!kakao || !mapRef.current) return;

    const pos = new kakao.maps.LatLng(center.lat, center.lon);
    markerRef.current?.setPosition(pos);

    const nextRadius = typeof acc === 'number' ? acc : (circleRef.current?.getRadius?.() ?? 200);

    circleRef.current?.setOptions({
      center: pos,
      radius: nextRadius,
    });

    if (infoRef.current) {
      infoRef.current.setPosition(pos);
      infoRef.current.setContent(buildInfo(label, center.lat, center.lon, acc, lastSeen));
    }

    mapRef.current.setCenter(pos);
    fitToRadius(kakao, mapRef.current, { lat: center.lat, lon: center.lon }, nextRadius);
  }, [sig]);

  return <div ref={divRef} className="h-[250px] w-full overflow-hidden rounded-xl border" />;
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

function fitToRadius(kakao: any, map: any, center: { lat: number; lon: number }, radiusM: number) {
  if (!kakao || !map || !center || !isFinite(center.lat) || !isFinite(center.lon)) return;

  const r = Math.max(1, radiusM || 200); // 최소 1m
  const lat = center.lat;
  const lon = center.lon;
  const bounds = new kakao.maps.LatLngBounds();

  const dLat = r / 111320; // 위도 1도 ≈ 111.32km
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLon = r / (111320 * (cos || 1e-6)); // 극지방 보호용 epsilon

  bounds.extend(new kakao.maps.LatLng(lat + dLat, lon + dLon));
  bounds.extend(new kakao.maps.LatLng(lat - dLat, lon - dLon));

  map.setBounds(bounds);
  const level = map.getLevel();
  if (level < 2) map.setLevel(2);
}
