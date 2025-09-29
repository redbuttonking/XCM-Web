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

export function getProtooUrl(params: Params): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host; // ex) localhost:3000
  const query = qs.stringify(params);
  // 프록시 경로로 붙는다 → Vite가 4443으로 터널링
  return `${protocol}://${host}/ws?${query}`;
}
