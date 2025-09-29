import { useState } from 'react';

const AudioPlayForm = ({ peerIds, sendJson, onCancel }: AudioPlayFormProps) => {
  const [filename, setFilename] = useState('');
  const [contentUri, setContentUri] = useState('');
  const [title, setTitle] = useState('오디오 재생 중');

  const handlePlay = () => {
    if (peerIds.length === 0) {
      alert('Peer를 하나 이상 선택하세요.');
      return;
    }

    if (!filename && !contentUri) {
      alert('파일명 또는 Content URI 중 하나를 입력하세요.');
      return;
    }

    if (filename && contentUri) {
      alert('파일명과 Content URI 중 하나만 입력하세요.');
      return;
    }

    let payload: AudioCommandPayload;

    if (contentUri) {
      payload = {
        type: 'play_audio',
        targetPeerIds: peerIds,
        title,
        uri: contentUri,
      };
    } else {
      payload = {
        type: 'play_audio',
        targetPeerIds: peerIds,
        title,
        filename,
      };
    }

    sendJson(payload);
  };

  const handleStop = () => {
    if (peerIds.length === 0) {
      alert('Peer를 하나 이상 선택하세요.');
      return;
    }
    const payload: StopAudioPayload = {
      type: 'stop_audio',
      targetPeerIds: peerIds,
    };
    sendJson(payload);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()} // 모달 내부 클릭 이벤트 배경 전파 차단
      >
        <h2 className="mb-4 text-xl font-semibold text-black">오디오 재생</h2>

        <input
          type="text"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="파일명 (예: sample.mp3)"
          className="mb-3 w-full rounded border border-gray-300 p-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {/* URI로 재생시키는 input */}
        {/* <div className="mb-3 text-center font-semibold text-black">또는</div>
        <input
          type="text"
          value={contentUri}
          onChange={(e) => setContentUri(e.target.value)}
          placeholder="Content URI (예: content://.../audio/media/123)"
          className="mb-3 w-full rounded border border-gray-300 p-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
        /> */}
        {/* 오디오 재생시 알림 제목 지정하는 input *기본값은 오디오 재생중 */}
        {/* <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="알림 제목 (선택)"
          className="mb-5 w-full rounded border border-gray-300 p-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
        /> */}

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            className="rounded border bg-white px-5 py-2 text-gray-200"
            onClick={onCancel}
          >
            취소
          </button>

          <button
            type="button"
            className="rounded bg-[#3A589F] px-5 py-2 text-white"
            onClick={handlePlay}
          >
            재생
          </button>

          {/* <button
            type="button"
            className="hover:bg-red-700 rounded bg-red px-5 py-2 text-white"
            onClick={handleStop}
          >
            정지
          </button> */}
        </div>
      </div>
    </div>
  );
};

export default AudioPlayForm;

type PlayByUriPayload = {
  type: 'play_audio';
  targetPeerIds: string[];
  title?: string;
  uri: string;
  filename?: never; // uri를 쓰면 filename x
};

type PlayByFilenamePayload = {
  type: 'play_audio';
  targetPeerIds: string[];
  title?: string;
  filename: string;
  uri?: never; // filename을 쓰면 uri는 x
};

type StopAudioPayload = {
  type: 'stop_audio';
  targetPeerIds: string[];
};

type AudioCommandPayload = PlayByUriPayload | PlayByFilenamePayload | StopAudioPayload;

type AudioPlayFormProps = {
  peerIds: string[];
  sendJson: (payload: AudioCommandPayload) => Promise<void> | void;
  onCancel: () => void; // 모달 닫기용 콜백
};
