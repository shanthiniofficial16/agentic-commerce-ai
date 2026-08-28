import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Bot, Check, CreditCard, Eye, EyeOff, Lock, Mail, ShieldCheck, ShoppingBag, Sparkles, TrendingUp } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'

const features = [
  { icon: Sparkles, title: 'Intelligent shopping', text: 'Understand intent and recommend what customers actually need.' },
  { icon: TrendingUp, title: 'Revenue growth', text: 'Turn relevant upsells and cross-sells into larger, happier carts.' },
  { icon: ShieldCheck, title: 'Secure transactions', text: 'Keep every payment action validated, gated, and auditable.' },
]

function FlowNode({ icon: Icon, label, active }) {
  return <div className={`login-flow-node ${active ? 'active' : ''}`}><span><Icon size={16} /></span><small>{label}</small></div>
}

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
      if (response.data.success) {
        login(response.data.data.user, response.data.data.token)
        navigate(response.data.data.user.role === 'MERCHANT' ? '/merchant/dashboard' : '/shop')
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return <main className="login-page homepage-auth-page">
    <section className="login-brand-panel">
      <div className="login-grid-pattern" />
      <div className="login-brand-content">
        <Link to="/login" className="login-brand"><span><Bot size={23} /></span><strong>AI Commerce</strong></Link>
        <div className="login-brand-copy"><p className="login-kicker"><span /> AI-powered shopping &amp; analytics</p><h1>Welcome back.<br />Shop <em>smarter.</em></h1><p>Your personalised commerce experience is waiting, with recommendations and discovery built around you.</p></div>
        <div className="login-features">{features.map(({ icon: Icon, title, text }) => <div className="login-feature" key={title}><span className="login-feature-icon"><Icon size={17} /></span><div><strong>{title}</strong><p>{text}</p></div></div>)}</div>
        <div className="login-flow"><p>From intent to order</p><div className="login-flow-track"><FlowNode icon={ShoppingBag} label="Customer" active /><i /><FlowNode icon={Bot} label="AI agent" /><i /><FlowNode icon={Sparkles} label="Product" /><i /><FlowNode icon={CreditCard} label="Payment" /><i /><FlowNode icon={Check} label="Order" /></div></div>
      </div>
      <div className="login-orb orb-one" /><div className="login-orb orb-two" /><div className="login-orb orb-three" />
    </section>
    <section className="login-form-panel"><div className="login-card"><div className="login-card-header"><p className="login-kicker">Welcome back</p><h2>Sign in to continue</h2><p>Enter your details to return to AI Commerce.</p></div><form onSubmit={handleSubmit} noValidate><label className="login-label" htmlFor="email">Email address</label><div className="login-input-wrap"><Mail size={18} /><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" autoComplete="email" required /></div><div className="login-label-row"><label className="login-label" htmlFor="password">Password</label><span>Required</span></div><div className="login-input-wrap"><Lock size={18} /><input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><div className="login-options"><label><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span className="fake-checkbox">{remember && <Check size={12} />}</span> Remember me</label><span className="disabled-link" title="Password reset is not configured yet">Forgot password?</span></div>{error && <div className="login-error" role="alert"><span>!</span><div><strong>Unable to sign in</strong><p>{error}</p></div></div>}<button type="submit" className="login-submit" disabled={loading}>{loading ? <><span className="login-spinner" /> Signing in...</> : <>Sign in <ArrowRight size={17} /></>}</button></form><div className="login-demo"><span>Demo access</span><small>Customer: customer@example.com · test123</small><small>Merchant: merchant@example.com · test123</small></div><p className="login-register">Don't have an account? <Link to="/register">Create an account <ArrowRight size={14} /></Link></p><div className="login-trust"><ShieldCheck size={15} /> Secure authentication <span>•</span> Protected commerce environment</div></div></section>
  </main>
}
