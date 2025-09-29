import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const FeedbackManagement = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/', { replace: true });
  }, []);
  return <>{/* <div>피드백백관리 페이지</div> */}</>;
};

export default FeedbackManagement;
