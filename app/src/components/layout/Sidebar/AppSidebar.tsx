import ScreenCapture from '@/components/ScreenCapture';
import ScreenRecorder from '@/components/ScreenRecorder';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  AlignJustify,
  BookOpen,
  Camera,
  Image,
  MessagesSquare,
  Monitor,
  RectangleGoggles,
  Settings,
  User,
  UserRound,
  Video,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const AppSidebar = () => {
  const location = useLocation();

  const { open: isSidebarOpen } = useSidebar();

  const menuItems = [
    {
      title: '모니터링',
      url: '/',
      icon: <Monitor />,
    },
    // {
    //   title: '학생관리',
    //   url: '/usermanagement',
    //   icon: <UserRound />,
    // },
    // {
    //   title: '수업관리',
    //   url: '/classmanagement',
    //   icon: <BookOpen />,
    // },
    {
      title: '기기관리',
      url: '/devicemanagement',
      icon: <RectangleGoggles />,
    },
    {
      title: '녹화관리',
      url: '/recordingmanagement',
      icon: <Image />,
    },
    {
      title: '피드백관리',
      url: '/feedbackmanagement',
      icon: <MessagesSquare />,
    },
    {
      title: '환경설정',
      url: '/settings',
      icon: <Settings />,
    },
  ];

  const screenToolsMenu = [
    {
      title: '전체화면 캡쳐',
      icon: <Camera />,
    },
    {
      title: '전체화면 녹화',
      icon: <Video />,
    },
  ];

  return (
    <Sidebar
      className="group bg-white"
      data-collapsed={isSidebarOpen ? 'false' : 'true'}
      collapsible="icon"
      // variant="inset"
      // variant="sidebar"
      // variant="floating"
    >
      <div className="flex justify-end p-2">{/* <SidebarTrigger /> */}</div>
      <SidebarHeader className="flex flex-col pb-[30px] pl-[17px] pr-[17px] pt-[20px]">
        <div className="flex h-[48px] items-center justify-between">
          <div className="ml-[5px] flex items-center">
            <img className="group-data-[collapsed=true]:pr-[0px]" src="/public/icons/logo.svg" />

            <div className="ml-[20px] text-2xl font-bold group-data-[collapsed=true]:hidden">
              ControlXR
            </div>
          </div>
          {/* <AlignJustify className="group-data-[collapsed=true]:hidden" /> */}
        </div>
      </SidebarHeader>
      <SidebarContent className="scrollbar-thin scrollbar-thumb">
        <SidebarGroup>
          <SidebarGroupContent>
            {/* 메인 메뉴 */}
            <SidebarMenu>
              {menuItems.map((item) => (
                <Link to={item.url} key={item.title}>
                  <SidebarMenuItem className="mb-[21px] flex h-[48px] justify-center">
                    <SidebarMenuButton
                      className={`h-full p-[10px] text-[22px] font-semibold text-gray-200 hover:bg-[rgba(18,18,18,0.06)] group-data-[collapsed=true]:!h-[48px] group-data-[collapsed=true]:!w-[48px] ${location.pathname === item.url ? 'bg-[rgba(18,18,18,0.06)] text-black' : ''}`}
                    >
                      <span className="ml-[4px]">{item.icon}</span>
                      <span className="group-data-[collapsed=true]:hidden">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </Link>
              ))}
            </SidebarMenu>

            <div className="bg-gray-500 p-[0.5px]"></div>

            {/* 화면 관리 */}
            <SidebarMenu className="mt-[21px]">
              <ScreenRecorder />
              <ScreenCapture />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* 사이드바 푸터 */}
      {/* <SidebarFooter className="pb-[26px] pl-[17px] pr-[17px] pt-[50px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <img
              src="/public/icons/admin-img.svg"
              className="pr-[18px] group-data-[collapsed=true]:p-0"
            />
            <span className="text-[26px] font-bold group-data-[collapsed=true]:hidden">관리자</span>
          </div>
          <Settings
            onClick={() => {
              console.log('환경설정 클릭');
            }}
            className="hover:cursor-pointer group-data-[collapsed=true]:hidden"
          />
        </div>

        <div className="mt-[27px] flex flex-col group-data-[collapsed=true]:hidden">
          <span className="text-[18px]">7월 19일 금요일</span>
          <span className="text-[27px]">13:49</span>
        </div>
      </SidebarFooter> */}
    </Sidebar>
  );
};

export default AppSidebar;
