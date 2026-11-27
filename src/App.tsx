import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Workload } from './pages/Workload'
import { PendingApprovals } from './pages/PendingApprovals'
import { PaymentConfirmations } from './pages/PaymentConfirmations'
import { ClientDatabase } from './pages/ClientDatabase'
import { EntityPage } from './pages/EntityPage'
import { FilingPage } from './pages/FilingPage'

function Routed() {
  const { session, profile, loading } = useAuth()
  if (loading) return <div className="p-10 text-sm text-slate-500">Loading…</div>
  if (!session) return <Login />
  if (!profile) return <div className="p-10 text-sm text-red-600">Your account isn't set up. Sign in with your schapiracpa.com Google account.</div>
  const home = profile.role === 'staff' ? '/approvals' : '/workload'
  return (
    <Routes>
      <Route element={<Layout />}>
        {profile.role !== 'staff' && <Route path="/workload" element={<Workload />} />}
        <Route path="/approvals" element={<PendingApprovals />} />
        <Route path="/payments" element={<PaymentConfirmations />} />
        <Route path="/clients" element={<ClientDatabase />} />
        <Route path="/entity/:id" element={<EntityPage />} />
        <Route path="/filing/:id" element={<FilingPage />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routed />
      </BrowserRouter>
    </AuthProvider>
  )
}
