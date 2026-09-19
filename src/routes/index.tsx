import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import AppLayout from '@/layouts/AppLayout'
import { Loading } from '@/components/ui'
import LoginPage from '@/pages/Auth/LoginPage'
import RegisterPage from '@/pages/Auth/RegisterPage'
import ForgotPasswordPage from '@/pages/Auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/Auth/ResetPasswordPage'
import DashboardPage from '@/pages/Dashboard/DashboardPage'
import FinancePage from '@/pages/Finance/FinancePage'
import PortfoliosPage from '@/pages/Portfolio/PortfoliosPage'
import PortfolioDetailPage from '@/pages/Portfolio/PortfolioDetailPage'
import InvestmentsPage from '@/pages/Investments/InvestmentsPage'
import BrokersPage from '@/pages/Brokers/BrokersPage'
import MarketPage from '@/pages/Market/MarketPage'
import AssetDetailPage from '@/pages/Market/AssetDetailPage'
import AnalysisPage from '@/pages/Analysis/AnalysisPage'
import ComparePage from '@/pages/Analysis/ComparePage'
import RecommendationPage from '@/pages/Analysis/RecommendationPage'
import BacktestingPage from '@/pages/Backtesting/BacktestingPage'
import SettingsPage from '@/pages/Settings/SettingsPage'

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <Loading text="Verificando sesión…" />
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />
  return children
}

function PublicOnly({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (user) return <Navigate to="/" replace />
  return children
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<Protected><AppLayout /></Protected>}>
        <Route index element={<DashboardPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="portfolios" element={<PortfoliosPage />} />
        <Route path="portfolios/:id" element={<PortfolioDetailPage />} />
        <Route path="investments" element={<InvestmentsPage />} />
        <Route path="brokers" element={<BrokersPage />} />
        <Route path="market" element={<MarketPage />} />
        <Route path="market/:id" element={<AssetDetailPage />} />
        <Route path="analysis" element={<AnalysisPage />} />
        <Route path="analysis/compare" element={<ComparePage />} />
        <Route path="recommend" element={<RecommendationPage />} />
        <Route path="backtesting" element={<BacktestingPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
