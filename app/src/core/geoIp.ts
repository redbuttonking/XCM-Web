// src/core/geoIp.ts
// - 같은 IP 중복 호출 방지 (메모리 캐시)
// - 24시간 TTL
// - 같은 순간 중복 호출은 in-flight 결합
// - 에러 시 캐시에 저장하지 않음

export type GeoIpResult = {
  ip: string;
  city?: string;
  region?: string;
  country_name?: string;
  latitude?: number;
  longitude?: number;
  postal?: string;
  country?: string;
  lat?: number | string;
  lon?: number | string;
};

type CacheEntry = {
  ts: number; // ms
  data: GeoIpResult;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// 간단한 메모리 캐시
const cache = new Map<string, CacheEntry>();

// 같은 IP로 다수 동시요청이 들어오면 하나로 합치기
const inflight = new Map<string, Promise<GeoIpResult>>();

/**
 * ipgeolocation(무료 버전)
 * 응답 예시는 사용자가 보낸 JSON과 동일한 필드 구조를 가정.
 */
// api 키가 담긴 env 파일 필요
const API_KEY = import.meta.env.VITE_IPGEOLOCATION_KEY as string;

async function fetchGeoIp(ip: string): Promise<GeoIpResult> {
  if (!API_KEY) throw new Error('Missing VITE_IPGEOLOCATION_API_KEY');

  // v1 (/ipgeo)나 v2 (/v2/ipgeo) 아무거나 써도 되도록 매핑을 유연하게
  const url = `https://api.ipgeolocation.io/ipgeo?apiKey=${encodeURIComponent(API_KEY)}&ip=${encodeURIComponent(ip)}`;

  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`ipgeolocation failed: ${res.status}`);
  const j = await res.json();

  const loc = j.location ?? {}; // v2에서는 location.* 안에 들어있음
  const latNum = Number(j.latitude ?? loc.latitude);
  const lonNum = Number(j.longitude ?? loc.longitude);

  return {
    ip: String(j.ip ?? j.ip_address ?? ip),
    // ✅ city 우선
    city: loc.city ?? j.city ?? undefined,
    region: loc.state_prov ?? j.state_prov ?? j.region ?? undefined,
    country_name: loc.country_name ?? j.country_name ?? j.country ?? undefined,
    postal: loc.zipcode ?? j.zipcode ?? j.postal ?? undefined,
    latitude: Number.isFinite(latNum) ? latNum : undefined,
    longitude: Number.isFinite(lonNum) ? lonNum : undefined,
    lat: Number.isFinite(latNum) ? latNum : undefined,
    lon: Number.isFinite(lonNum) ? lonNum : undefined,
  };
}

/**
 * 캐시를 확인하고, 없거나 만료면 실제 호출.
 * - TTL: 24h
 * - inflight 결합
 */
export async function resolveGeoIp(ip: string): Promise<GeoIpResult> {
  if (!ip) throw new Error('ip is empty');

  // 1) 캐시 HIT
  const now = Date.now();
  const c = cache.get(ip);
  if (c && now - c.ts < DAY_MS) return c.data;

  // 2) in-flight 결합
  const existing = inflight.get(ip);
  if (existing) return existing;

  // 3) 새 요청
  const p = (async () => {
    try {
      const data = await fetchGeoIp(ip);
      cache.set(ip, { ts: Date.now(), data });
      return data;
    } finally {
      inflight.delete(ip);
    }
  })();

  inflight.set(ip, p);
  return p;
}

/**
 * 필요 시 수동으로 캐시 무효화 (예: 강제 새로고침 버튼)
 */
export function invalidateGeoIp(ip: string) {
  cache.delete(ip);
}
