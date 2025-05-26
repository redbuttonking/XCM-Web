import { Link } from 'react-router-dom';
import { Button } from '../../ui/button';

const Navigation = () => {
  return (
    <nav className="flex flex-col">
      <Link to="/">
        <Button variant="ghost">모니터링</Button>
      </Link>
      <Link to="/usermanagement">
        <Button variant="ghost">학생관리</Button>
      </Link>
      <Link to="/classmanagement">
        <Button variant="ghost">수업관리</Button>
      </Link>
      <Link to="/devicemanagement">
        <Button variant="ghost">기기관리</Button>
      </Link>
      <Link to="/recordingmanagement">
        <Button variant="ghost">녹화관리</Button>
      </Link>
      <Link to="/feedbackmanagement">
        <Button variant="ghost">피드백관리</Button>
      </Link>
    </nav>
  );
};

export default Navigation;
