import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import SignIn from './components/auth/SignIn'
import ConnectAccounts from './components/onboarding/ConnectAccounts'
import SchoolHoursSetup from './components/onboarding/SchoolHoursSetup'
import AppShell from './components/layout/AppShell'
import Dashboard from './components/dashboard/Dashboard'
import Settings from './components/settings/Settings'

function OnboardingGate({ step, children }: { step: 'connect' | 'school-hours'; children: React.ReactNode }) {
  const { isSignedIn, onboardingStep } = useApp()
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  if (step === 'school-hours' && onboardingStep === 'connect') {
    return <Navigate to="/onboarding/connect" replace />
  }
  return <>{children}</>
}

function ProtectedShell() {
  const { isSignedIn, onboardingStep } = useApp()
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  if (onboardingStep === 'connect') return <Navigate to="/onboarding/connect" replace />
  if (onboardingStep === 'school-hours') return <Navigate to="/onboarding/school-hours" replace />
  return <AppShell />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route
        path="/onboarding/connect"
        element={
          <OnboardingGate step="connect">
            <ConnectAccounts />
          </OnboardingGate>
        }
      />
      <Route
        path="/onboarding/school-hours"
        element={
          <OnboardingGate step="school-hours">
            <SchoolHoursSetup />
          </OnboardingGate>
        }
      />
      <Route path="/" element={<ProtectedShell />}>
        <Route index element={<Navigate to="today" replace />} />
        <Route path="today" element={<Dashboard view="today" />} />
        <Route path="week" element={<Dashboard view="week" />} />
        <Route path="assignments" element={<Dashboard view="assignments" />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  )
}
