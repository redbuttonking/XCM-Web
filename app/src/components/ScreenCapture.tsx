import {
  ensureControlXRFolder,
  getOrSelectControlXRFolder,
  saveBlobToControlXRFolder,
} from '@/core/utils';
import { SidebarMenuButton, SidebarMenuItem } from './ui/sidebar';
import { Camera } from 'lucide-react';

const ScreenCapture = () => {
  async function handleCapture() {
    const folderHandle = await ensureControlXRFolder();
    if (!folderHandle) {
      alert('저장할 폴더가 선택되지 않았습니다.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const video = document.createElement('video');
      video.srcObject = new MediaStream([track]);
      video.muted = true;
      video.autoplay = true;
      await video.play();

      async function captureWhenReady() {
        if (video.readyState >= 2) {
          setTimeout(async () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imgBlob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, 'image/png'),
              );
              if (!imgBlob) {
                alert('스크린샷 저장 실패');
                return;
              }
              const now = new Date();
              const filename = `Full-Screen-Capture-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.png`;
              await saveBlobToControlXRFolder(folderHandle!, imgBlob, filename);
              alert(`스크린샷이 저장되었습니다: ${filename}`);
            }
            track.stop();
            video.srcObject = null;
          }, 200);
        } else {
          setTimeout(captureWhenReady, 100);
        }
      }
      captureWhenReady();
    } catch (error) {
      console.error('스크린 캡처 실패:', error);
      // alert('스크린 캡처에 실패했습니다.');
    }
  }

  return (
    <SidebarMenuItem className="mb-[21px] flex h-[48px] justify-center">
      <SidebarMenuButton
        className="h-full p-[10px] text-[22px] font-semibold text-gray-200 group-data-[collapsed=true]:!h-[48px] group-data-[collapsed=true]:!w-[48px]"
        onClick={handleCapture}
      >
        <span className="ml-[4px]">
          <Camera />
        </span>
        <span className="group-data-[collapsed=true]:hidden">전체화면 캡쳐</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

export default ScreenCapture;
