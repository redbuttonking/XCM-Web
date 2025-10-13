import { create } from 'zustand';

type AuthState = {
  adminId?: string; // 로그인한 관리자 고유 ID
  jwt?: string; // (옵션) JWT 토큰
  setAuth: (p: { adminId?: string; jwt?: string }) => void;
  clearAuth: () => void;
};

// 아직 로그인시 id만 받는지 JWT를 받는지 정확하게 모르기에
// main.tsx에서 mock데이터를 가지고 room 생성하는중(추후 확정되면 수정 예정)
export const useAuthStore = create<AuthState>((set) => ({
  adminId: undefined,
  jwt: undefined,
  setAuth: ({ adminId, jwt }) => set({ adminId, jwt }),
  clearAuth: () => set({ adminId: undefined, jwt: undefined }),
}));
