import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { SquadDetailPage } from './pages/SquadDetailPage'
import { SquadsPage } from './pages/SquadsPage'
import { ProtectedLayout } from './routes/Protected'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/squads" element={<SquadsPage />} />
        <Route path="/squads/:id" element={<SquadDetailPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/squads" replace />} />
      <Route path="*" element={<Navigate to="/squads" replace />} />
    </Routes>
  )
}
