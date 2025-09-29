// src/store/useRecordingMultiStore.ts
import { create } from 'zustand';

export type RecordingSession = {
  isRecording: boolean;
  startedAt: number | null;
  durationMs: number;
  bytes: number;
  chunks: number;
  mimeType: string | null;
  error: string | null;
};

type RecordingMultiState = {
  // peerId -> session
  sessions: Record<string, RecordingSession>;
};

type RecordingMultiActions = {
  begin: (peerId: string, mimeType?: string | null) => void;
  tickBytes: (peerId: string, delta: number) => void;
  bumpChunk: (peerId: string) => void;
  setDuration: (peerId: string, ms: number) => void;
  end: (peerId: string) => void;
  fail: (peerId: string, msg: string) => void;
  resetPeer: (peerId: string) => void;
  resetAll: () => void;
};

const empty = (): RecordingSession => ({
  isRecording: false,
  startedAt: null,
  durationMs: 0,
  bytes: 0,
  chunks: 0,
  mimeType: null,
  error: null,
});

export const useRecordingMultiStore = create<RecordingMultiState & RecordingMultiActions>(
  (set, get) => ({
    sessions: {},

    begin: (peerId, mimeType = null) =>
      set((state) => ({
        sessions: {
          ...state.sessions,
          [peerId]: { ...empty(), isRecording: true, startedAt: Date.now(), mimeType },
        },
      })),
    tickBytes: (peerId, delta) =>
      set((state) => {
        const s = state.sessions[peerId] ?? empty();
        return {
          sessions: {
            ...state.sessions,
            [peerId]: { ...s, bytes: Math.max(0, (s.bytes || 0) + delta) },
          },
        };
      }),
    bumpChunk: (peerId) =>
      set((state) => {
        const s = state.sessions[peerId] ?? empty();
        return { sessions: { ...state.sessions, [peerId]: { ...s, chunks: (s.chunks || 0) + 1 } } };
      }),
    setDuration: (peerId, ms) =>
      set((state) => {
        const s = state.sessions[peerId] ?? empty();
        return { sessions: { ...state.sessions, [peerId]: { ...s, durationMs: ms } } };
      }),
    end: (peerId) =>
      set((state) => {
        const s = state.sessions[peerId] ?? empty();
        return { sessions: { ...state.sessions, [peerId]: { ...s, isRecording: false } } };
      }),
    fail: (peerId, msg) =>
      set((state) => {
        const s = state.sessions[peerId] ?? empty();
        return {
          sessions: { ...state.sessions, [peerId]: { ...s, isRecording: false, error: msg } },
        };
      }),
    resetPeer: (peerId) =>
      set((state) => {
        const { [peerId]: _, ...rest } = state.sessions;
        return { sessions: rest };
      }),
    resetAll: () => set({ sessions: {} }),
  }),
);
