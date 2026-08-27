import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthContext } from './context/AuthContext'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Register from './pages/Register'
import CustomerShop from './pages/CustomerShop'
import MerchantDashboard from './pages/MerchantDashboard'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

function AppContent() {
  const { auth } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      <Route path="/" element={auth ? <Navigate to={auth.role === 'MERCHANT' ? '/merchant/dashboard' : '/shop'} /> : <Navigate to="/login" />} />
      
      <Route 
        path="/shop/*" 
        element={
          <ProtectedRoute requiredRole="CUSTOMER">
            <CustomerShop />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/merchant/*" 
        element={
          <ProtectedRoute requiredRole="MERCHANT">
            <MerchantDashboard />
          </ProtectedRoute>
        } 
      />
    </Routes>
  )
}

function App() {
  return (
    <AuthContext>
      <Router>
        <AppContent />
      </Router>
    </AuthContext>
  )
}

export default App
