// components/GeoIpMap.tsx
import { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Geo = { lat: number; lon: number; city?: string; region?: string; country?: string };

async function getGeoIP(): Promise<Geo> {
  // 1차: ipapi.co (무키, 가끔 레이트 리밋)
  try {
    const r = await fetch('https://ipapi.co/json/');
    if (r.ok) {
      const j = await r.json();
      if (j?.latitude && j?.longitude) {
        return {
          lat: j.latitude,
          lon: j.longitude,
          city: j.city,
          region: j.region,
          country: j.country_name,
        };
      }
    }
  } catch {}
  // 2차: ipwho.is (무키)
  const r2 = await fetch('https://ipwho.is/');
  const j2 = await r2.json();
  if (j2?.success && j2?.latitude && j2?.longitude) {
    return {
      lat: j2.latitude,
      lon: j2.longitude,
      city: j2.city,
      region: j2.region,
      country: j2.country,
    };
  }
  throw new Error('GeoIP lookup failed');
}

// GeoIP는 보통 도시 레벨 정확도 → 반경 5~20km 정도로 표기(원하는 값으로 조정)
const DEFAULT_RADIUS_M = 8000;

export default function GeoIpMap() {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getGeoIP()
      .then(setGeo)
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    if (!geo) return;
    const { lat, lon } = geo;

    const map = L.map('geoip-map', { center: [lat, lon], zoom: 11 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OSM contributors',
    }).addTo(map);

    const label = [
      '대략적 위치 (GeoIP)',
      [geo.city, geo.region, geo.country].filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .join('<br/>');

    L.marker([lat, lon]).addTo(map).bindPopup(label).openPopup();
    L.circle([lat, lon], { radius: DEFAULT_RADIUS_M }).addTo(map);

    return () => {
      map.remove();
    };
  }, [geo]);

  if (err) return <div>위치 조회 실패: {err}</div>;
  if (!geo) return <div>대략적 위치 계산 중…</div>;
  return <div id="geoip-map" style={{ height: 420, width: '100%' }} />;
}
