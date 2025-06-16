import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/Sidebar/AppSidebar';

const RootLayout = () => {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '325px',
          '--sidebar-width-icon': '70px',
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      {/* <main className="mx-auto h-[1080px] w-[1920px] overflow-hidden"> */}
      <main className="h-screen flex-1 overflow-hidden p-[20px]">
        <SidebarTrigger />
        <Outlet />
      </main>
    </SidebarProvider>
  );
};

export default RootLayout;
