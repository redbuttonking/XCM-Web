import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/Sidebar/AppSidebar';

const RootLayout = () => {
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
