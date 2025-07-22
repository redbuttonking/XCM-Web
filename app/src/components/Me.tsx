// components/Me.tsx
import { useState } from 'react';
import MicVolumeMeter from './MicVolumeMeter';
import PeerView from './PeerView';
import { useRoomStore } from '@/store/useRoomStore';

const Me = () => {
  const micTrack = useRoomStore((state) => state.micTrack);
  const webcamTrack = useRoomStore((state) => state.webcamTrack);
  const micEnabled = useRoomStore((state) => state.micEnabled);
  const webcamEnabled = useRoomStore((state) => state.webcamEnabled);
  const [chatInput, setChatInput] = useState('');
  const roomClient = useRoomStore((state) => state.roomClient);

  const toggleMic = async () => {
    if (!roomClient) return;

    if (micEnabled) {
      console.log('[toggleMic] 마이크 끄기');
      await roomClient.disableMic();
      // setMicEnabled(false);
    } else {
      console.log('[toggleMic] 마이크 켜기');
      await roomClient.enableMic();
      // setMicEnabled(true);
    }
  };

  const toggleWebcam = async () => {
    if (!roomClient) return;

    if (webcamEnabled) {
      console.log('[toggleWebcam] 웹캠 끄기');
      await roomClient.disableWebcam();
      // setWebcamEnabled(false);
    } else {
      console.log('[toggleWebcam] 웹캠 켜기');
      await roomClient.enableWebcam();
      // setWebcamEnabled(true);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    if (!roomClient) {
      console.warn('RoomClient가 존재하지 않습니다.');
      return;
    }

    try {
      await roomClient.sendChatMessage(chatInput.trim()); // RoomClient.ts 메서드 호출
      console.log('[Me.tsx] sendChatMessage 호출 완료');
      setChatInput('');
    } catch (err) {
      console.error('채팅 메시지 전송 오류:', err);
    }
  };

  return (
    <div className="m-[16px] w-[300px] rounded-lg bg-gray-800 p-2">
      <h2 className="mb-1 text-sm">나</h2>
      <PeerView micTrack={micTrack} videoTrack={webcamTrack} />
      <div className="mt-2 flex gap-2">
        <button onClick={toggleMic} className="bg-blue-600 rounded px-3 py-1 text-sm hover:bg-blue">
          {micEnabled ? '마이크 끄기' : '마이크 켜기'}
        </button>
        <button
          onClick={toggleWebcam}
          className="bg-green-600 rounded px-3 py-1 text-sm hover:bg-green"
        >
          {webcamEnabled ? '카메라 끄기' : '카메라 켜기'}
        </button>
      </div>

      <div>
        <input
          className="text-black"
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSendChat();
            }
          }}
          placeholder="메시지를 입력하세요"
        />
        <button onClick={handleSendChat}>전송</button>
      </div>
      {/* <MicVolumeMeter /> */}
    </div>
  );
};

export default Me;
