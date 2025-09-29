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
 * ipapi(무료) 기본 엔드포인트 https://ipapi.co/{ip}/json/
 * 응답 예시는 사용자가 보낸 JSON과 동일한 필드 구조를 가정.
 * CORS 허용됨(무료 플랜 기준). 필요 시 헤더 조정.
 */
async function fetchGeoIp(ip: string): Promise<GeoIpResult> {
  const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;

  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`ipapi failed: ${res.status}`);
  const j = await res.json();

  // 필드 매핑(사용 중인 UI/Store에 맞게 최소한만 추림)
  const data: GeoIpResult = {
    ip: String(j.ip ?? ip),
    city: j.city,
    region: j.region,
    country_name: j.country_name ?? j.country ?? undefined,
    latitude: typeof j.latitude === 'number' ? j.latitude : undefined,
    longitude: typeof j.longitude === 'number' ? j.longitude : undefined,
    postal: j.postal,
  };

  return data;
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
