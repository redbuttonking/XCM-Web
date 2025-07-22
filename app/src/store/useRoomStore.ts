import { create } from 'zustand';
import type RoomClient from '../core/RoomClient'; // 실제 경로에 맞게 수정할 것

export interface PeerInfo {
  id: string;
  displayName: string;
  videoTrack?: MediaStreamTrack;
  audioTrack?: MediaStreamTrack;
}

export interface Notification {
  id: string;
  type: 'chat' | 'error' | 'info';
  title?: string;
  text: string;
}

interface RoomState {
  joined: boolean;
  roomClient: RoomClient | null;
  micTrack: MediaStreamTrack | null;
  webcamTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack | null;
  micEnabled: boolean;
  webcamEnabled: boolean;
  screenShareEnabled: boolean;
  peers: PeerInfo[];
  peerId: string;
  notifications: Notification[];

  // 상태 업데이트 함수들
  setJoined: (joined: boolean) => void;
  setRoomClient: (client: RoomClient) => void;
  setMicTrack: (track: MediaStreamTrack | null) => void;
  setWebcamTrack: (track: MediaStreamTrack | null) => void;
  setScreenTrack: (track: MediaStreamTrack | null) => void;
  setMicEnabled: (enabled: boolean) => void;
  setWebcamEnabled: (enabled: boolean) => void;
  setScreenShareEnabled: (enabled: boolean) => void;
  setPeers: (peers: PeerInfo[]) => void;
  addPeer: (peer: PeerInfo) => void;
  removePeer: (peerId: string) => void;
  updatePeerTrack: (peerId: string, kind: 'mic' | 'video', track: MediaStreamTrack) => void;
  resetRoom: () => void;
  setPeerId: (peerId: string) => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  joined: false,
  roomClient: null,
  micEnabled: false,
  webcamEnabled: false,
  screenShareEnabled: false,
  micTrack: null,
  webcamTrack: null,
  screenTrack: null,
  peers: [],
  peerId: '',
  notifications: [],

  setJoined: (joined) => set({ joined }),
  setMicEnabled: (enabled) => set({ micEnabled: enabled }),
  setWebcamEnabled: (enabled) => set({ webcamEnabled: enabled }),
  setScreenShareEnabled: (enabled) => set({ screenShareEnabled: enabled }),

  setMicTrack: (track) => set({ micTrack: track }),
  setWebcamTrack: (track) => set({ webcamTrack: track }),
  setScreenTrack: (track) => set({ screenTrack: track }),

  setRoomClient: (client) => set({ roomClient: client }),

  setPeerId: (peerId) => set({ peerId }),
  setPeers: (peers) => set({ peers }),
  addPeer: (peer) =>
    set((state) => {
      // 이미 동일 ID의 peer가 있다면 추가하지 않음
      const exists = state.peers.some((p) => p.id === peer.id);
      if (exists) return state;

      return {
        peers: [...state.peers, peer],
      };
    }),
  removePeer: (peerId) => set((state) => ({ peers: state.peers.filter((p) => p.id !== peerId) })),

  updatePeerTrack: (peerId, kind, track) =>
    set((state) => ({
      peers: state.peers.map((peer) =>
        peer.id === peerId ? { ...peer, [`${kind}Track`]: track } : peer,
      ),
    })),

  resetRoom: () =>
    set({
      joined: false,
      roomClient: null,
      micEnabled: false,
      webcamEnabled: false,
      screenShareEnabled: false,
      micTrack: null,
      webcamTrack: null,
      screenTrack: null,
      peers: [],
      peerId: '',
    }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [...state.notifications, notification],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));
