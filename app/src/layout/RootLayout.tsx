import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/Sidebar/AppSidebar';
import RoomConnectionProvider from '@/providers/RoomConnectionProvider';
import { useEffect } from 'react';
import { useRoomStore } from '@/store/useRoomStore';
import usePersistPeersToCache from '@/hooks/usePersistPeersToCache';

const RootLayout = () => {
  usePersistPeersToCache();

  const location = useLocation();

  const roomClient = useRoomStore((state) => state.roomClient);
  const joined = useRoomStore((state) => state.joined);

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
      <RoomConnectionProvider />
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
