import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Bot, Check, Eye, EyeOff, Lock, Mail, MapPin, Phone, ShieldCheck, Sparkles, User } from 'lucide-react'
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
      const response = await axios.post('/api/auth/register', {
        name,
        email,
        password,
        role,
        fullName: name,
        phone,
        street,
        building,
        landmark,
        city,
        state,
        pincode,
      })
      if (response.data.success) {
        login(response.data.data.user, response.data.data.token)
        navigate(response.data.data.user.role === 'MERCHANT' ? '/merchant/dashboard' : '/shop')
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return <main className="login-page register-page">
    <section className="login-brand-panel"><div className="login-grid-pattern" /><div className="login-brand-content"><Link to="/login" className="login-brand"><span><Bot size={23} /></span><strong>AI Commerce</strong></Link><div className="login-brand-copy"><p className="login-kicker"><span /> Start with better commerce</p><h1>Build your<br /><em>next chapter.</em></h1><p>Join an intelligent commerce platform built for discovery, connection, and measurable growth.</p></div><div className="login-features"><div className="login-feature"><span className="login-feature-icon"><Sparkles size={17} /></span><div><strong>Personalised by design</strong><p>Make every customer interaction feel considered and useful.</p></div></div><div className="login-feature"><span className="login-feature-icon"><Check size={17} /></span><div><strong>One connected experience</strong><p>Bring shopping, payments, and insight into one place.</p></div></div><div className="login-feature"><span className="login-feature-icon"><ShieldCheck size={17} /></span><div><strong>Ready to grow</strong><p>Start with a secure foundation for your commerce journey.</p></div></div></div></div><div className="login-orb orb-one" /><div className="login-orb orb-two" /><div className="login-orb orb-three" /></section>
    <section className="login-form-panel"><div className="login-card"><div className="login-card-header"><p className="login-kicker">Create your account</p><h2>Start your smarter journey</h2><p>Set up your AI Commerce account in a few seconds.</p></div><form onSubmit={handleSubmit} noValidate><label className="login-label" htmlFor="register-name">Full name</label><div className="login-input-wrap"><User size={18} /><input id="register-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" autoComplete="name" required /></div><label className="login-label" htmlFor="register-email">Email address</label><div className="login-input-wrap"><Mail size={18} /><input id="register-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" autoComplete="email" required /></div><label className="login-label" htmlFor="register-password">Password</label><div className="login-input-wrap"><Lock size={18} /><input id="register-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" autoComplete="new-password" minLength={6} required /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><label className="login-label" htmlFor="account-role">I am joining as</label><select id="account-role" className="login-select" value={role} onChange={(e) => setRole(e.target.value)}><option value="CUSTOMER">Customer</option><option value="MERCHANT">Merchant</option></select>{role === 'CUSTOMER' && (<><label className="login-label" htmlFor="register-phone">Phone number</label><div className="login-input-wrap"><Phone size={18} /><input id="register-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" autoComplete="tel" required /></div><label className="login-label" htmlFor="register-street">Delivery address</label><div className="login-input-wrap"><MapPin size={18} /><input id="register-street" type="text" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Street / house no. / colony" autoComplete="street-address" required /></div><div className="login-grid-cols"><div><label className="login-label" htmlFor="register-building">Building</label><div className="login-input-wrap"><input id="register-building" type="text" value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="Building / flat" autoComplete="address-line2" /></div></div><div><label className="login-label" htmlFor="register-landmark">Landmark</label><div className="login-input-wrap"><input id="register-landmark" type="text" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Nearby landmark" autoComplete="address-line3" /></div></div></div><div className="login-grid-cols"><div><label className="login-label" htmlFor="register-city">City</label><div className="login-input-wrap"><input id="register-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" autoComplete="address-level2" required /></div></div><div><label className="login-label" htmlFor="register-state">State</label><div className="login-input-wrap"><input id="register-state" type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="State" autoComplete="address-level1" required /></div></div></div><label className="login-label" htmlFor="register-pincode">Pincode</label><div className="login-input-wrap"><input id="register-pincode" type="text" value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="6-digit pincode" autoComplete="postal-code" required /></div></>)}{error && <div className="login-error" role="alert"><span>!</span><div><strong>Account creation failed</strong><p>{error}</p></div></div>}<button type="submit" className="login-submit" disabled={loading}>{loading ? <><span className="login-spinner" /> Creating account...</> : <>Create account <ArrowRight size={17} /></>}</button></form><p className="login-register">Already have an account? <Link to="/login">Sign in <ArrowRight size={14} /></Link></p><div className="login-trust"><ShieldCheck size={15} /> Secure authentication <span>•</span> Protected commerce environment</div></div></section>
  </main>
}
