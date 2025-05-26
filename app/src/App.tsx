import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Monitoring from './pages/Monitoring';
import UserManagement from './pages/UserManagement';
import Settings from './pages/Settings';
import RootLayout from './layout/RootLayout';
import ClassManagement from './pages/ClassManagement';
import DeviceManagement from './pages/DeviceManagement';
import RecordingManagement from './pages/RecordingManagement';
import FeedbackManagement from './pages/FeedbackManagement';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<Monitoring />} />
          <Route path="/usermanagement" element={<UserManagement />} />
          <Route path="/classmanagement" element={<ClassManagement />} />
          <Route path="/devicemanagement" element={<DeviceManagement />} />
          <Route path="/recordingmanagement" element={<RecordingManagement />} />
          <Route path="/feedbackmanagement" element={<FeedbackManagement />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
