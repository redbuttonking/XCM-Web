// src/hooks/useMultiPeerRecorder.ts

import { useEffect, useRef } from 'react';
import {
  startPeerRecording,
  pickSupportedMimeType,
  type PeerRecorderCtrl,
} from '@/lib/peerRecorder';
import { useRoomStore, type PeerInfo } from '@/store/useRoomStore';
import { useRecordingMultiStore } from '@/store/useRecordingMultiStore';
import { useDownloadQueue } from '@/store/useDownloadQueue';
import { v4 as uuidv4 } from 'uuid';
import { ensureControlXRFolder, saveBlobToControlXRFolder } from '@/core/utils';
import { fixWebmDuration } from '@/core/media';

const safeName = (s: string) => String(s).replace(/[^\w\-]+/g, '_');

function getPeerTracks(peerId: string) {
  const peers = useRoomStore.getState().peers as PeerInfo[];
  const p = peers.find((x) => x.id === peerId);
  if (!p) throw new Error(`해당 peer(${peerId})를 찾을 수 없습니다.`);
  if (!p.videoTrack) throw new Error(`peer(${peerId})에 videoTrack이 없습니다.`);
  // audioTrack 있으면 자동 포함 → "오디오 포함 녹화"
  return { video: p.videoTrack, audio: p.audioTrack ?? null, displayName: p.displayName };
}

export function useMultiPeerRecorder(timesliceMs = 1000) {
  // peerId -> RecorderCtrl
  const ctrlMapRef = useRef<Map<string, PeerRecorderCtrl>>(new Map());
  // peerId -> timer id
  const timerMapRef = useRef<Map<string, number>>(new Map());
  const startedAtMapRef = useRef<Map<string, number>>(new Map());

  const begin = useRecordingMultiStore((s) => s.begin);
  const end = useRecordingMultiStore((s) => s.end);
  const fail = useRecordingMultiStore((s) => s.fail);
  const tickBytes = useRecordingMultiStore((s) => s.tickBytes);
  const bumpChunk = useRecordingMultiStore((s) => s.bumpChunk);
  const setDuration = useRecordingMultiStore((s) => s.setDuration);
  // const resetPeer = useRecordingMultiStore((s) => s.resetPeer);
  const sessions = useRecordingMultiStore((s) => s.sessions);
  const nameMapRef = useRef<Map<string, string>>(new Map());
  const pendingNameRef = useRef<Map<string, string>>(new Map());
  const savedOnceRef = useRef<Set<string>>(new Set());

  const enqueue = useDownloadQueue((s) => s.enqueue);
  const userStopRef = useRef<Map<string, boolean>>(new Map()); // 수동 중지 여부

  // 언마운트 시 모든 녹화 안전 정지
  useEffect(() => {
    let cleaned = false; // StrictMode 이중-cleanup 방지

    return () => {
      if (cleaned) return;
      cleaned = true;

      // 1) 타이머 정리
      for (const [peerId] of ctrlMapRef.current) {
        const t = timerMapRef.current.get(peerId);
        if (t) {
          clearInterval(t);
          timerMapRef.current.delete(peerId);
        }
      }
      // 2) 레코더 stop만 호출 (저장은 onStop에서!)
      for (const [, ctrl] of ctrlMapRef.current) {
        try {
          ctrl.stop();
        } catch {}
      }
    };
  }, []);

  // peers 변화 감시: 사라졌거나 videoTrack이 없으면 stop()
  useEffect(() => {
    const unsubscribe = useRoomStore.subscribe((state, prevState) => {
      if (prevState && state.peers === prevState.peers) return;

      const byId = new Map<string, PeerInfo>(state.peers.map((p) => [p.id, p] as const));

      for (const [peerId, ctrl] of ctrlMapRef.current) {
        const p = byId.get(peerId);
        const v = p?.videoTrack;
        if (!p || !v || v.readyState === 'ended') {
          setTimeout(() => {
            try {
              ctrl.stop();
            } catch {}
          }, 150);
        }
      }
    });

    return unsubscribe;
  }, []);

  function isRecording(peerId: string) {
    return !!sessions[peerId]?.isRecording;
  }

  async function start(peerId: string) {
    // 폴더 지정 유도 함수
    const folderHandle = await ensureControlXRFolder();
    if (!folderHandle) {
      alert('저장할 폴더가 선택되지 않았습니다.');
      return;
    }

    if (ctrlMapRef.current.get(peerId)?.state() === 'recording') return;

    // 새 녹화 시작시 플래그/ 이름 초기화
    savedOnceRef.current.delete(peerId);
    userStopRef.current.delete(peerId);
    pendingNameRef.current.delete(peerId);

    let tracks: { video: MediaStreamTrack; audio: MediaStreamTrack | null; displayName: string };
    try {
      tracks = getPeerTracks(peerId);
    } catch (e: any) {
      fail(peerId, e?.message ?? '트랙 조회 실패');
      return;
    }
    nameMapRef.current.set(peerId, tracks.displayName);

    const mime = pickSupportedMimeType();
    begin(peerId, mime || null);

    let onEnded: (() => void) | undefined;

    const ctrl = startPeerRecording({
      videoTrack: tracks.video,
      audioTrack: tracks.audio,
      timesliceMs,
      onChunk: (b) => {
        tickBytes(peerId, b.size);
        bumpChunk(peerId);
      },
      alsoBufferForDownload: true,
      onStop: async (blob) => {
        if (savedOnceRef.current.has(peerId)) return; // 중복 저장 방지
        savedOnceRef.current.add(peerId);

        // 타이머/상태 정리
        const t = timerMapRef.current.get(peerId);
        if (t) {
          clearInterval(t);
          timerMapRef.current.delete(peerId);
        }
        end(peerId);
        ctrlMapRef.current.delete(peerId);

        if (onEnded) tracks.video.removeEventListener('ended', onEnded);

        if (blob.size > 0) {
          try {
            // 1) duration 계산
            const liveSessions = useRecordingMultiStore.getState().sessions;
            let durationMs = liveSessions[peerId]?.durationMs ?? 0;
            if (!durationMs || durationMs < 1) {
              const startedAt = startedAtMapRef.current.get(peerId) ?? Date.now();
              durationMs = Math.max(0, Date.now() - startedAt);
            }

            // 2) duration/seek 메타데이터 보정
            const fixedBlob = await fixWebmDuration(blob);

            const dn = safeName(nameMapRef.current.get(peerId) ?? peerId);
            const pending = pendingNameRef.current.get(peerId);
            pendingNameRef.current.delete(peerId);
            const name = pending || `record-${dn}-${peerId}-${Date.now()}.webm`;

            // 폴더 직접 저장(에러 시에만 fallback)
            const folderHandle = await ensureControlXRFolder();
            if (folderHandle) {
              try {
                await saveBlobToControlXRFolder(folderHandle, fixedBlob, name);
                alert(`녹화 영상이 지정 폴더에 저장되었습니다: ${name}`);
              } catch (e) {
                // 저장 실패: fallback - 다운로드 트레이 활용
                const url = URL.createObjectURL(fixedBlob);
                enqueue({ id: uuidv4(), url, name });
                setTimeout(() => URL.revokeObjectURL(url), 6000);
              }
            } else {
              // 폴더 미지정 - fallback
              const url = URL.createObjectURL(fixedBlob);
              enqueue({ id: uuidv4(), url, name });
              setTimeout(() => URL.revokeObjectURL(url), 6000);
            }
          } catch (err) {
            fail(peerId, `Duration fix 실패: ${String(err)}`);
          }
        }
        startedAtMapRef.current.delete(peerId);
        nameMapRef.current.delete(peerId); // displayName 캐시 정리
      },
    });

    onEnded = () => {
      setTimeout(() => {
        try {
          ctrl.stop();
        } catch {}
      }, 150); // 마지막 timeslice가 떨어질 시간 버퍼
    };
    tracks.video.addEventListener('ended', onEnded);

    // MediaRecorder 미지원 브라우저 체크
    if (ctrl.state() === 'unsupported') {
      fail(peerId, 'MediaRecorder 미지원 브라우저');
      end(peerId);
      return;
    }

    ctrlMapRef.current.set(peerId, ctrl);

    const started = Date.now();
    startedAtMapRef.current.set(peerId, started);
    const timer = window.setInterval(() => setDuration(peerId, Date.now() - started), 250);
    timerMapRef.current.set(peerId, timer);
  }

  async function stopAndDownload(peerId: string, filename?: string) {
    const ctrl = ctrlMapRef.current.get(peerId);
    if (!ctrl) return;

    if (filename) pendingNameRef.current.set(peerId, filename); // 원하는 파일명 전달
    userStopRef.current.set(peerId, true); // 수동 중지 표시
    try {
      await ctrl.stop();
    } catch {}
  }

  // 배치 지원
  async function startMany(peerIds: string[]) {
    await Promise.all(peerIds.map((id) => start(id)));
  }

  async function stopManyAndDownload(peerIds: string[]) {
    await Promise.all(peerIds.map((id) => stopAndDownload(id)));
  }

  async function capturePeerScreen(peerId: string): Promise<void> {
    const { video: videoTrack, displayName } = getPeerTracks(peerId);
    const stream = new MediaStream([videoTrack]);
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.autoplay = true;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        video
          .play()
          .then(() => resolve())
          .catch(reject);
      };
      video.onerror = () => reject(new Error('Video load error'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get canvas context');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imgBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!imgBlob) throw new Error('Failed to create image Blob');

    const folderHandle = await ensureControlXRFolder();
    if (!folderHandle) {
      alert('저장할 폴더를 선택해주세요');
      return;
    }

    const now = new Date();
    const safeDisplayName = displayName.replace(/[^\w\s-]/g, '');
    const timestamp = `${now.getHours().toString().padStart(2, '0')}${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}${now
      .getMilliseconds()
      .toString()
      .padStart(3, '0')}`;

    const filename = `Peer-Screen-Capture-${safeDisplayName}-${timestamp}.png`;
    await saveBlobToControlXRFolder(folderHandle, imgBlob, filename);
    alert(`단일 화면 캡처 저장 완료: ${filename}`);

    video.srcObject = null;
    video.remove();
  }

  return {
    start,
    stopAndDownload,
    startMany,
    stopManyAndDownload,
    isRecording,
    capturePeerScreen,
    sessions, // UI가 per-peer 상태 표시할 때 사용
  };
}
