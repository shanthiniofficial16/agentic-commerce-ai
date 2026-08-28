import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Bot, Check, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles, User } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('CUSTOMER')
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
      const response = await axios.post('/api/auth/register', { name, email, password, role })
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
    <section className="login-form-panel"><div className="login-card"><div className="login-card-header"><p className="login-kicker">Create your account</p><h2>Start your smarter journey</h2><p>Set up your AI Commerce account in a few seconds.</p></div><form onSubmit={handleSubmit} noValidate><label className="login-label" htmlFor="register-name">Full name</label><div className="login-input-wrap"><User size={18} /><input id="register-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" autoComplete="name" required /></div><label className="login-label" htmlFor="register-email">Email address</label><div className="login-input-wrap"><Mail size={18} /><input id="register-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" autoComplete="email" required /></div><label className="login-label" htmlFor="register-password">Password</label><div className="login-input-wrap"><Lock size={18} /><input id="register-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" autoComplete="new-password" minLength={6} required /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><label className="login-label" htmlFor="account-role">I am joining as</label><select id="account-role" className="login-select" value={role} onChange={(e) => setRole(e.target.value)}><option value="CUSTOMER">Customer</option><option value="MERCHANT">Merchant</option></select>{error && <div className="login-error" role="alert"><span>!</span><div><strong>Account creation failed</strong><p>{error}</p></div></div>}<button type="submit" className="login-submit" disabled={loading}>{loading ? <><span className="login-spinner" /> Creating account...</> : <>Create account <ArrowRight size={17} /></>}</button></form><p className="login-register">Already have an account? <Link to="/login">Sign in <ArrowRight size={14} /></Link></p><div className="login-trust"><ShieldCheck size={15} /> Secure authentication <span>•</span> Protected commerce environment</div></div></section>
  </main>
}
