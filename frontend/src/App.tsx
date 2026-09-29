import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import Overview from './pages/Overview'
import SonarAnalysis from './pages/SonarAnalysis'
import LiveDetection from './pages/LiveDetection'
import AnomalyMap from './pages/AnomalyMap'
import History from './pages/History'
import Reports from './pages/Reports'
import SystemHealth from './pages/SystemHealth'
import SettingsPage from './pages/Settings'

export default function App() {
  const { user } = useAuth()
  if (!user) return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<AppShell />}>
        <Route index element={<Overview />} />
        <Route path="analysis" element={<SonarAnalysis />} />
        <Route path="live" element={<LiveDetection />} />
        <Route path="map" element={<AnomalyMap />} />
        <Route path="history" element={<History />} />
        <Route path="reports" element={<Reports />} />
        <Route path="health" element={<SystemHealth />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
