import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardScreen from './screens/DashboardScreen.jsx';
import ReviewScreen from './screens/ReviewScreen.jsx';
import SummaryScreen from './screens/SummaryScreen.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardScreen />} />
      <Route path="/review" element={<ReviewScreen />} />
      <Route path="/summary" element={<SummaryScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
