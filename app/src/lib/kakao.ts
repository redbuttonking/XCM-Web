// src/lib/kakao.ts
let kakaoPromise: Promise<typeof window.kakao> | null = null;

export function loadKakaoSdk(appkey: string, libs: string[] = ['services']) {
  if (typeof window === 'undefined') return Promise.reject(new Error('window not available'));

  // 이미 로드됨
  if (window.kakao?.maps) {
    return Promise.resolve(window.kakao);
  }

  if (kakaoPromise) return kakaoPromise;

  kakaoPromise = new Promise((resolve, reject) => {
    const scriptId = 'kakao-map-sdk';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

    const finish = () => {
      // autoload=false 이므로 반드시 maps.load로 감싸기
      if (window.kakao?.maps) {
        window.kakao.maps.load(() => resolve(window.kakao));
      } else {
        reject(new Error('Kakao global not ready after script load'));
      }
    };

    if (existing) {
      // 태그는 있는데 아직 전역이 없을 수 있으니 상황에 맞게 처리
      if (window.kakao?.maps) {
        finish();
      } else {
        existing.addEventListener('load', finish, { once: true });
        existing.addEventListener('error', () => reject(new Error('Kakao SDK load error')), {
          once: true,
        });
      }
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.src =
      `https://dapi.kakao.com/v2/maps/sdk.js` +
      `?appkey=${encodeURIComponent(appkey)}` +
      `&autoload=false` +
      `&libraries=${encodeURIComponent(libs.join(','))}`;

    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', () => reject(new Error('Kakao SDK load error')), {
      once: true,
    });

    document.head.appendChild(script);
  });

  return kakaoPromise!;
}

// 타입 보강
declare global {
  interface Window {
    kakao: any;
  }
}
