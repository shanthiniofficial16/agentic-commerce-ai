import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, Bot, ClipboardList, LogOut, Package, Plus, Wallet } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const panels = [
  { title: 'Products', text: 'Manage the catalogue stored in MongoDB.', icon: Package, to: '/merchant/products', action: 'Open catalogue' },
  { title: 'Analytics', text: 'Review sales, conversion, and recommendation performance.', icon: BarChart3, to: '/merchant/analytics', action: 'View analytics' },
  { title: 'Payments', text: 'Monitor payment records and settlement status.', icon: Wallet, to: '/merchant/payments', action: 'View payments' },
  { title: 'Audit trail', text: 'Inspect agent and system actions for your store.', icon: ClipboardList, to: '/merchant/audit', action: 'Open audit log' },
]

export default function MerchantDashboard() {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate('/login') }
  return <div className="merchant-app"><header className="merchant-nav"><Link to="/merchant/dashboard" className="brand"><span><Bot size={21} /></span> AI Commerce <small>Merchant</small></Link><div><span>{auth?.name}</span><button onClick={handleLogout} aria-label="Log out"><LogOut size={17} /></button></div></header><main className="merchant-main"><div className="merchant-heading"><div><p className="eyebrow">Merchant workspace</p><h1>Good morning, {auth?.name?.split(' ')[0] || 'there'}.</h1><p>Everything you need to run a sharper, more intelligent catalogue.</p></div><Link className="button primary" to="/merchant/products"><Plus size={17} /> Add product</Link></div><div className="merchant-metrics"><div><span>Revenue</span><strong>₹0</strong><small>Connect orders to see live data</small></div><div><span>Orders</span><strong>0</strong><small>No completed orders yet</small></div><div><span>Catalogue</span><strong>49</strong><small>Products in MongoDB</small></div><div><span>AI influence</span><strong>0%</strong><small>Recommendations are ready</small></div></div><div className="merchant-panels">{panels.map(({ title, text, icon: Icon, to, action }) => <Link to={to} className="merchant-panel" key={title}><Icon size={21} /><h2>{title}</h2><p>{text}</p><strong>{action} →</strong></Link>)}</div></main></div>
}
