// src/store/useDownloadQueue.ts
import { create } from 'zustand';

export type DownloadItem = { id: string; url: string; name: string };

type State = {
  items: DownloadItem[];
  enqueue: (it: DownloadItem) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useDownloadQueue = create<State>((set) => ({
  items: [],
  enqueue: (it) => set((s) => ({ items: [...s.items, it] })),
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
  clear: () => set({ items: [] }),
}));
