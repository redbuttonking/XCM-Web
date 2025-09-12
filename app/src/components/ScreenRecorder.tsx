import { useRef, useState } from 'react';
import {
  saveBlobToControlXRFolder,
  getOrSelectControlXRFolder,
  ensureControlXRFolder,
} from '@/core/utils';
import { SidebarMenuButton, SidebarMenuItem } from './ui/sidebar';
import { Video } from 'lucide-react';

const ScreenRecorder = () => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = async () => {
    const folderHandle = await ensureControlXRFolder();
    if (!folderHandle) {
      alert('저장할 폴더가 선택되지 않았습니다.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      await new Promise((resolve) => setTimeout(resolve, 500));
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
          setIsRecording(false);
        };
      });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        if (blob.size === 0) {
          alert('녹화된 영상이 없습니다.');
          return;
        }

        try {
          const now = new Date();
          const filename = `Full-Recording-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${now.getHours()}${now.getMinutes()}${now.getSeconds()}.webm`;
          await saveBlobToControlXRFolder(folderHandle, blob, filename);
          alert(`전체화면 녹화본이 저장되었습니다: ${filename}`);
        } catch (e) {
          console.error('전체화면 녹화본 저장 중 오류', e);
          alert('전체화면 녹화본 저장을 실패했습니다.');
        }
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('전체화면 녹화 시작 실패:', error);
      alert('전체화면 녹화를 시작할 수 없습니다.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      setIsRecording(false);
    }
  };

  return (
    <>
      <SidebarMenuItem className="mb-[21px] flex h-[48px] justify-center">
        {isRecording ? (
          <SidebarMenuButton
            className={`h-full p-[10px] text-[22px] font-semibold text-gray-200 group-data-[collapsed=true]:!h-[48px] group-data-[collapsed=true]:!w-[48px]`}
            onClick={stopRecording}
          >
            <span className="ml-[9px] flex justify-center">
              <span className="relative mr-2 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-75"></span>
                <span className="relative inline-flex h-full w-3 rounded-full bg-red"></span>
              </span>
            </span>
            <span className="group-data-[collapsed=true]:hidden">전체화면 녹화 종료</span>
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton
            className={`h-full p-[10px] text-[22px] font-semibold text-gray-200 group-data-[collapsed=true]:!h-[48px] group-data-[collapsed=true]:!w-[48px]`}
            onClick={startRecording}
          >
            <span className="ml-[4px]">
              <Video />
            </span>
            <span className="group-data-[collapsed=true]:hidden">전체화면 녹화</span>
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    </>
  );
};

export default ScreenRecorder;
