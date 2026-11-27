import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { supabase } from './lib/supabase'
import { Layout } from './components/Layout'
import { Loading } from './components/ui'
import { Login } from './pages/Login'
import { ClientsPage } from './pages/ClientsPage'
import { GroupPage } from './pages/GroupPage'
import { EntityPage } from './pages/EntityPage'
import { YearPage } from './pages/YearPage'
import { Workload } from './pages/Workload'
import { PendingApprovals } from './pages/PendingApprovals'
import { PaymentConfirmations } from './pages/PaymentConfirmations'
import { SearchPage } from './pages/SearchPage'

// Old /filing/:id links -> year page
function FilingRedirect() {
  const { id } = useParams()
  const [to, setTo] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('filings').select('entity_id, tax_year, stage').eq('id', id!).single()
      .then(({ data }) => setTo(data ? `/entity/${data.entity_id}/${data.tax_year}?stage=${data.stage}` : '/clients'))
  }, [id])
  return to ? <Navigate to={to} replace /> : <Loading />
}

function Routed() {
  const { session, profile, loading } = useAuth()
  if (loading) return <div className="p-10"><Loading /></div>
  if (!session) return <Login />
  if (!profile) return <div className="p-10 text-sm text-red-600">Your account isn't set up yet.</div>
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:groupId" element={<GroupPage />} />
        <Route path="/entity/:id" element={<EntityPage />} />
        <Route path="/entity/:id/:year" element={<YearPage />} />
        <Route path="/filing/:id" element={<FilingRedirect />} />
        {profile.role !== 'staff' && <Route path="/workload" element={<Workload />} />}
        <Route path="/approvals" element={<PendingApprovals />} />
        <Route path="/payments" element={<PaymentConfirmations />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="*" element={<Navigate to="/clients" replace />} />
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
