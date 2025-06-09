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
  const hostname = window.location.hostname;
  const port = 4443; // 실제 사용하는 포트 번호로 바꿔줘야 함

  const query = qs.stringify(params);

  return `${protocol}://${hostname}:${port}/?${query}`;
}
