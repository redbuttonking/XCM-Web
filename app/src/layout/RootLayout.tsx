import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/Sidebar/AppSidebar';
import RoomConnectionProvider from '@/providers/RoomConnectionProvider';
import { useEffect, useRef } from 'react';
import { useRoomStore } from '@/store/useRoomStore';
import usePersistPeersToCache from '@/hooks/usePersistPeersToCache';
import { useAuthStore } from '@/store/useAuthStore';

const RootLayout = () => {
  usePersistPeersToCache();

  const location = useLocation();

  const roomClient = useRoomStore((state) => state.roomClient);
  const joined = useRoomStore((state) => state.joined);

  // 로그인 id or JWT 받기 전 mock 데이터
  const didMock = useRef(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const adminId = useAuthStore((s) => s.adminId);
  const jwt = useAuthStore((s) => s.jwt);

  useEffect(() => {
    if (!roomClient || !joined) return;

    const searchParams = new URLSearchParams(location.search);
    const singleMonitoringPeerId = searchParams.get('peer');

    if (singleMonitoringPeerId) {
      // 단일 모니터링 모드로 진입: 해당 peerId만 재생하도록 앱에 명령 전송
      roomClient.sendSingleMonitoring([singleMonitoringPeerId]).catch(console.error);
    } else {
      // 전체 모니터링 아님: 앱에 consumer 모두 중단하라고 명령 전송
      console.log('roomClient.peerId: ', roomClient.peerId);
      roomClient.sendFullMonitoring([roomClient.peerId]).catch(console.error);
    }
  }, [location.search, roomClient, joined]);

  // 앱 실행시 AuthStore 값 임시로 지정(로그인하고 받을 값 id or JWT)
  useEffect(() => {
    if (didMock.current) return;
    didMock.current = true;

    // 이미 로그인 값 있으면 건너뜀
    if (adminId) return;

    // 쿼리로 오버라이드 가능 (?adminId=...&jwt=...)
    const q = new URLSearchParams(window.location.search);
    const qAdminId = q.get('adminId') || undefined;
    const qJwt = q.get('jwt') || undefined;

    setAuth({
      adminId: qAdminId ?? 'monitoringRoom', // 임시 관리자 ID
      jwt: qJwt ?? 'dev.fake.jwt.token', // 임시 JWT
    });
  }, [adminId, setAuth]);

  return (
    <SidebarProvider
      open={false} // 사이드바 접기 펴기
      style={
        {
          '--sidebar-width': '325px',
          '--sidebar-width-icon': '70px',
        } as React.CSSProperties
      }
    >
      {adminId && <RoomConnectionProvider />}
      <AppSidebar />

      <main className="relative min-w-0 flex-1 overflow-x-auto overflow-y-auto pb-[50px] pl-[clamp(50px,calc((100vw-2120px)/2),9999px)] pr-[clamp(50px,calc((100vw-2120px)/2),9999px)] pt-[40px]">
        <div className="flex h-[1080px] w-full min-w-[1280px] max-w-[1920px] flex-col">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  );
};

export default RootLayout;
