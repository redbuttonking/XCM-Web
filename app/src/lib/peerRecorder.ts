// 트랙 → MediaRecorder로 녹화하는 순수 유틸

export type PeerRecorderCtrl = {
  stop: () => Promise<Blob>;
  pause: () => void;
  resume: () => void;
  state: () => RecordingState | 'unsupported';
};

export function pickSupportedMimeType(
  candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'],
) {
  for (const t of candidates) if ((window as any).MediaRecorder?.isTypeSupported?.(t)) return t;
  return '';
}

export function startPeerRecording(opts: {
  videoTrack: MediaStreamTrack;
  audioTrack?: MediaStreamTrack | null;
  timesliceMs?: number; // 메모리 폭주 방지용(권장: 1000)
  alsoBufferForDownload?: boolean; // 이친구는 뭐하는 친구인가
  onChunk?: (blob: Blob) => void; // 스트리밍 업로드/IndexedDB 저장 시
  onStop?: (blob: Blob) => void; // ★ 추가
}): PeerRecorderCtrl {
  const {
    videoTrack,
    audioTrack = null,
    timesliceMs = 0,
    onChunk,
    alsoBufferForDownload = false,
    onStop,
  } = opts;

  // 브라우저 지원 가드
  if (!(window as any).MediaRecorder) {
    console.warn('MediaRecorder unsupported in this browser.');
    return {
      stop: async () => new Blob(),
      pause: () => {},
      resume: () => {},
      state: () => 'unsupported',
    };
  }

  const stream = new MediaStream([videoTrack]);
  if (audioTrack) stream.addTrack(audioTrack);

  const mimeType = pickSupportedMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  const chunks: Blob[] = [];
  const handleData = (e: BlobEvent) => {
    if (e.data && e.data.size > 0) {
      if (onChunk) onChunk(e.data);
      if (!onChunk || alsoBufferForDownload) chunks.push(e.data);
    }
  };
  recorder.addEventListener('dataavailable', handleData);

  const onEnded = () => recorder.state !== 'inactive' && recorder.stop();
  videoTrack.addEventListener('ended', onEnded);
  audioTrack?.addEventListener('ended', onEnded);

  let resolveStop: (b: Blob) => void;
  const stopped = new Promise<Blob>((res) => (resolveStop = res));

  recorder.addEventListener('stop', () => {
    videoTrack.removeEventListener('ended', onEnded);
    audioTrack?.removeEventListener('ended', onEnded);
    recorder.removeEventListener('dataavailable', handleData);

    const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
    onStop?.(blob); // ★ 자동 저장/정리용 콜백
    resolveStop(blob);
  });

  recorder.start(timesliceMs || undefined);

  return {
    stop: async () => {
      if (recorder.state !== 'inactive') recorder.stop();
      return stopped;
    },
    pause: () => {
      if (recorder.state === 'recording') recorder.pause();
    },
    resume: () => {
      if (recorder.state === 'paused') recorder.resume();
    },
    state: () => recorder.state,
  };
}
