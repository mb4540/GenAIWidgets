import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import AiGatewayChatPage from './pages/ai/AiGatewayChatPage'
import FilesPage from './pages/files/FilesPage'
import AdminPage from './pages/admin/AdminPage'
import RagPreprocessingPage from './pages/rag/RagPreprocessingPage'
import AgentManagementPage from './pages/agent-chat/AgentManagementPage'
import ToolsManagementPage from './pages/agent-chat/ToolsManagementPage'
import AgentChatPage from './pages/agent-chat/AgentChatPage'
import AiChatPage from './pages/ai-chat/AiChatPage'
import MemoryManagementPage from './pages/agent-chat/MemoryManagementPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/signup" element={<SignupPage />} />

          {/* Protected routes with app layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/compare-ai-models" element={<AiGatewayChatPage />} />
              <Route path="/files" element={<FilesPage />} />
              <Route path="/rag-preprocessing" element={<RagPreprocessingPage />} />
              <Route path="/agents" element={<AgentManagementPage />} />
              <Route path="/agents/tools" element={<ToolsManagementPage />} />
              <Route path="/agents/memories" element={<MemoryManagementPage />} />
              <Route path="/agent-chat" element={<AgentChatPage />} />
              <Route path="/ai-chat" element={<AiChatPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
