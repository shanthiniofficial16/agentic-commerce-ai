import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Lock, Mail, Check } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await axios.post('/api/auth/login', { email, password })
      const { user, token } = response.data.data

      login(user, token)
      if (remember) localStorage.setItem('rememberEmail', email)

      if (user.role === 'MERCHANT') {
        navigate('/merchant/dashboard')
      } else {
        navigate('/shop')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      {/* Left Panel - Form */}
      <div className="auth-form-section">
        <div className="auth-form-container">
          <div className="auth-header">
            <Link to="/login" className="auth-logo">
              <span className="auth-logo-mark">⚡</span>
              <strong>AI Commerce</strong>
            </Link>
            <div className="auth-header-text">
              <p className="auth-subtitle">Welcome back</p>
              <h1>Sign in to continue</h1>
              <p className="auth-description">Enter your details to return to AI Commerce.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Email Field */}
            <div className="auth-field-group">
              <label className="auth-label">Email address</label>
              <div className="auth-input-wrap">
                <Mail size={18} className="auth-input-icon" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="auth-field-group">
              <label className="auth-label">Password</label>
              <div className="auth-input-wrap">
                <Lock size={18} className="auth-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="auth-options">
              <label className="auth-checkbox">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span className="auth-checkbox-visual">
                  {remember && <Check size={12} />}
                </span>
                <span>Remember me</span>
              </label>
              <a href="#" className="auth-link-secondary">Forgot password?</a>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="auth-error" role="alert">
                <span className="auth-error-icon">!</span>
                <div className="auth-error-content">
                  <strong>Sign in failed</strong>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="auth-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* Demo Access */}
          <div className="auth-demo">
            <span>Demo access</span>
            <small>Customer: customer@example.com · test123</small>
          </div>

          {/* Footer */}
          <p className="auth-footer">
            Don't have an account?{' '}
            <Link to="/register" className="auth-link">
              Create an account
            </Link>
          </p>
        </div>
      </div>

      <div className="auth-visual-section" aria-label="AI Commerce shopping experience">
        <img className="auth-visual-image" src="/images/premium-auth-commerce.svg" alt="AI Commerce products and smart shopping technology" />
        <div className="auth-visual-overlay">
          <span className="auth-visual-kicker">AI Commerce</span>
          <p className="auth-visual-tagline">Discover. Compare. Buy smarter.</p>
        </div>
      </div>
    </main>
  )
}
