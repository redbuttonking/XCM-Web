// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react-swc';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import { dirname } from 'path';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// export default defineConfig({
//   plugins: [react()],
//   resolve: {
//     alias: {
//       '@': path.resolve(__dirname, 'src'),
//     },
//   },
// });

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '../server/key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../server/cert.pem')),
    },
    proxy: {
      // WebSocket 프록시 (프로투)
      '/ws': {
        target: 'https://localhost:4443', // mediasoup 서버
        ws: true,
        changeOrigin: true,
        secure: false, // 개발용 self-signed 허용
      },
      // REST 프록시 (place-map / 업로드/다운로드 등)
      '/place-map': {
        target: 'https://localhost:4443',
        changeOrigin: true,
        secure: false,
      },
      '/upload-webm': {
        target: 'https://localhost:4443',
        changeOrigin: true,
        secure: false,
      },
      '/download': {
        target: 'https://localhost:4443',
        changeOrigin: true,
        secure: false,
      },
    },
    // 로컬 호스트 전용
    // host: 'localhost',
  },
});
