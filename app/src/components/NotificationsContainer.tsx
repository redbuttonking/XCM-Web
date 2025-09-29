import Notifications from './Notifications';
import { useRoomStore } from '@/store/useRoomStore';

const NotificationsContainer = () => {
  const notifications = useRoomStore((state) => state.notifications);
  const removeNotification = useRoomStore((state) => state.removeNotification);

  const handleClick = (id: string) => {
    removeNotification(id);
  };

  return <Notifications notifications={notifications} onClick={handleClick} />;
};

export default NotificationsContainer;
