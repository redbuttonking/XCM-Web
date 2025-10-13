// 데모버전 urlFactory.js
// import qs from 'qs';

// let protooPort = 4443;

// if (window.location.hostname === 'test.mediasoup.org') {
// 	protooPort = 4444;
// }
// // 회사 ip
// const hostname = window.location.hostname;
// // 핫스팟
// // const hostname = '192.168.78.50';
// const protocol = 'wss';

// // const hostname = 'v3demo.mediasoup.org'
// // const protocol = 'ws';

// export function getProtooUrl(params) {
// 	const query = qs.stringify(params);

// 	return `${protocol}://${hostname}:${protooPort}/?${query}`;
// }

import qs from 'qs';

interface Params {
  [key: string]: string;
}
type ExtraQuery = Record<string, string | number | boolean | null | undefined>;

export function getProtooUrl(baseParams: Params, extraQuery?: ExtraQuery): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host; // ex) localhost:3000

  // ✅ 기본 params + extraQuery 병합 (빈 값 제거)
  const merged: Record<string, string | number | boolean> = {};
  const all = { ...baseParams, ...(extraQuery || {}) };

  for (const [k, v] of Object.entries(all)) {
    if (v === undefined || v === null || v === '') continue;
    merged[k] = v as string | number | boolean;
  }

  const query = qs.stringify(merged);
  // 프록시 경로로 붙는다 → Vite가 4443으로 터널링
  return `${protocol}://${host}/ws?${query}`;
}
