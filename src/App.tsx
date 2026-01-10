import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import HomePage from './pages/HomePage'
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import DashboardPage from './pages/dashboard/DashboardPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/signup" element={<SignupPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
