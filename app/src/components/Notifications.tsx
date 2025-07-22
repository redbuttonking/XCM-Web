// components/Notifications.tsx
import classNames from 'classnames';

const Notifications = ({ notifications, onClick }: NotificationProps) => {
  return (
    <div data-component="Notifications">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={classNames('notification', notification.type)}
          onClick={() => onClick(notification.id)}
        >
          <div className="icon" />
          <div className="body">
            {notification.title && <p className="title">{notification.title}</p>}
            <p className="text">{notification.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export interface NotificationProps {
  notifications: Notification[];
  onClick: (id: string) => void;
}

export interface Notification {
  id: string;
  type: 'chat' | 'error' | 'info';
  title?: string;
  text: string;
}

export default Notifications;
