import { useState } from 'react';

const AudioPlayForm = ({ peerIds, sendJson }: AudioPlayFormProps) => {
  const [filename, setFilename] = useState('');
  const [contentUri, setContentUri] = useState('');
  const [title, setTitle] = useState('오디오 재생 중'); // 상단바에서 띄울 알림 제목

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
    <div>
      <div className="text-black">오디오 재생</div>
      <input
        type="text"
        value={filename}
        onChange={(e) => setFilename(e.target.value)}
        placeholder="파일명 (예: sample.mp3)"
        className="w-full border p-2 text-black"
      />
      <div className="text-black">또는</div>
      <input
        type="text"
        value={contentUri}
        onChange={(e) => setContentUri(e.target.value)}
        placeholder="Content URI (선택, 예: content://.../audio/media/123)"
        className="w-full border p-2 text-black"
      />
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="알림 제목 (선택)"
        className="w-full border p-2 text-black"
      />
      <div className="text-black">선택된 Peer 수 : {peerIds.length}</div>
      <button className="mr-[10px] rounded bg-blue px-4 py-2 text-white" onClick={handlePlay}>
        재생
      </button>
      <button className="rounded bg-blue px-4 py-2 text-white" onClick={handleStop}>
        정지
      </button>
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
};
