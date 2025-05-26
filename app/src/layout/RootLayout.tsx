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
      <main className="flex-1 overflow-y-auto p-[57px]">
        <SidebarTrigger />
        <Outlet />
      </main>
    </SidebarProvider>
  );
};

export default RootLayout;
