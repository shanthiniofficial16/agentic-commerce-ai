import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Lock, Mail, User, Phone, MapPin, Check } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('CUSTOMER')
  const [phone, setPhone] = useState('')
  const [street, setStreet] = useState('')
  const [building, setBuilding] = useState('')
  const [landmark, setLandmark] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [pincode, setPincode] = useState('')
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
      const payload = {
        name,
        email,
        password,
        role,
        fullName: name,
      }

      if (role === 'CUSTOMER') {
        payload.phone = phone
        payload.street = street
        payload.building = building
        payload.landmark = landmark
        payload.city = city
        payload.state = state
        payload.pincode = pincode
      }

      const response = await axios.post('/api/auth/register', payload)
      const { user, token } = response.data.data

      login(user, token)

      if (user.role === 'MERCHANT') {
        navigate('/merchant/dashboard')
      } else {
        navigate('/shop')
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Registration failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      {/* Left Panel - Form */}
      <div className="auth-form-section">
        <div className="auth-form-container">
          <div className="auth-header">
            <Link to="/register" className="auth-logo">
              <span className="auth-logo-mark">⚡</span>
              <strong>AI Commerce</strong>
            </Link>
            <div className="auth-header-text">
              <p className="auth-subtitle">Welcome to AI Commerce</p>
              <h1>Create your account</h1>
              <p className="auth-description">Join AI Commerce and let AI make shopping simpler.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Full Name Field */}
            <div className="auth-field-group">
              <label className="auth-label">Full name</label>
              <div className="auth-input-wrap">
                <User size={18} className="auth-input-icon" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                  required
                />
              </div>
            </div>

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
                  placeholder="Create a password"
                  autoComplete="new-password"
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

            {/* Role Selection */}
            <div className="auth-field-group">
              <label className="auth-label">I am joining as</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="auth-select"
              >
                <option value="CUSTOMER">Customer - Shop & Buy</option>
                <option value="MERCHANT">Merchant - Sell Products</option>
              </select>
            </div>

            {/* Address Fields - Only for Customers */}
            {role === 'CUSTOMER' && (
              <>
                {/* Phone Field */}
                <div className="auth-field-group">
                  <label className="auth-label">Phone number</label>
                  <div className="auth-input-wrap">
                    <Phone size={18} className="auth-input-icon" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>

                {/* Street Address */}
                <div className="auth-field-group">
                  <label className="auth-label">Delivery address</label>
                  <div className="auth-input-wrap">
                    <MapPin size={18} className="auth-input-icon" />
                    <input
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Street / house no. / colony"
                      autoComplete="street-address"
                      required
                    />
                  </div>
                </div>

                {/* Building & Landmark */}
                <div className="auth-address-fields">
                  <div className="auth-field-group">
                    <label className="auth-label">Building</label>
                    <div className="auth-input-wrap">
                      <input
                        type="text"
                        value={building}
                        onChange={(e) => setBuilding(e.target.value)}
                        placeholder="Building / flat"
                        autoComplete="address-line2"
                      />
                    </div>
                  </div>
                  <div className="auth-field-group">
                    <label className="auth-label">Landmark</label>
                    <div className="auth-input-wrap">
                      <input
                        type="text"
                        value={landmark}
                        onChange={(e) => setLandmark(e.target.value)}
                        placeholder="Nearby landmark"
                        autoComplete="address-line3"
                      />
                    </div>
                  </div>
                </div>

                {/* City, State, Pincode */}
                <div className="auth-address-fields">
                  <div className="auth-field-group">
                    <label className="auth-label">City</label>
                    <div className="auth-input-wrap">
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City"
                        autoComplete="address-level2"
                        required
                      />
                    </div>
                  </div>
                  <div className="auth-field-group">
                    <label className="auth-label">State</label>
                    <div className="auth-input-wrap">
                      <input
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="State"
                        autoComplete="address-level1"
                        required
                      />
                    </div>
                  </div>
                  <div className="auth-field-group">
                    <label className="auth-label">Pincode</label>
                    <div className="auth-input-wrap">
                      <input
                        type="text"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        placeholder="6-digit pincode"
                        autoComplete="postal-code"
                        required
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Error Alert */}
            {error && (
              <div className="auth-error" role="alert">
                <span className="auth-error-icon">!</span>
                <div className="auth-error-content">
                  <strong>Registration failed</strong>
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
                  Creating account...
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="auth-footer">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="auth-visual-section" aria-label="AI Commerce shopping experience">
        <img className="auth-visual-image" src="/images/premium-auth-commerce.svg" alt="AI Commerce products and smart shopping technology" />
        <div className="auth-visual-overlay">
          <span className="auth-visual-kicker">AI Commerce</span>
          <p className="auth-visual-tagline">Shop smarter with AI.</p>
        </div>
      </div>
    </main>
  )
}
