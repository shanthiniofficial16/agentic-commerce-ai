import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bot, CheckCircle2, ClipboardList, CreditCard, LogOut, Package, Plus, Sparkles, TrendingUp, Wallet, XCircle } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../hooks/useAuth'
import { createProduct, getMerchantAnalytics } from '../services/api'

const quickActions = [
  { title: 'Products', text: 'Manage your catalogue.', icon: Package, to: '/merchant/products', action: 'Open catalogue' },
  { title: 'Payments', text: 'Monitor payment records.', icon: Wallet, to: '/merchant/payments', action: 'View payments' },
  { title: 'Audit trail', text: 'Inspect agent actions.', icon: ClipboardList, to: '/merchant/audit', action: 'Open audit log' },
]

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const percent = (value) => `${Number(value || 0).toFixed(1)}%`
const number = (value) => Number(value || 0).toLocaleString('en-IN')

function Metric({ label, value, detail, icon: Icon, tone = 'default' }) {
  return <article className={`command-metric ${tone}`}>
    <div className="command-metric-top"><span>{label}</span>{Icon && <Icon size={18} />}</div>
    <strong>{value}</strong>
    {detail && <small>{detail}</small>}
  </article>
}

function SectionHeading({ eyebrow, title, detail }) {
  return <div className="command-section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{detail && <span>{detail}</span>}</div>
}

function EmptyChart({ text = 'Not enough successful transaction data yet.' }) {
  return <div className="chart-empty"><Activity size={22} /><span>{text}</span></div>
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tip"><strong>{label}</strong>{payload.map((entry) => <span key={entry.dataKey}><i style={{ background: entry.color }} />{entry.name}: {money(entry.value)}</span>)}</div>
}

function ProductCreator({ auth, onBack }) {
  const [form, setForm] = useState({ name: '', description: '', category: '', price: '', stock: '', images: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await createProduct({ ...form, price: Number(form.price), stock: Number(form.stock), images: form.images ? [form.images] : [] })
      setForm({ name: '', description: '', category: '', price: '', stock: '', images: '' })
      setSaved(true)
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'The product could not be added.')
    } finally {
      setSaving(false)
    }
  }

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value })

  return <main className="merchant-main product-creator-page">
    <button className="back-link" onClick={onBack}>← Back to command center</button>
    <div className="product-creator-heading"><div><p className="eyebrow"><Package size={14} /> Agent catalogue</p><h1>Add a product</h1><p>Make a real product available to your AI Agent and customers.</p></div><span className="data-status"><i /> Writes directly to MongoDB</span></div>
    <form className="product-creator-form" onSubmit={submit}>
      <div className="creator-form-intro"><Sparkles size={22} /><strong>Give the agent something useful to sell.</strong><span>Products added here become available to the live catalogue and agent recommendations.</span></div>
      <label>Product name<input required value={form.name} onChange={update('name')} placeholder="e.g. Studio Wireless Headphones" /></label>
      <label>Category<input required value={form.category} onChange={update('category')} placeholder="e.g. Electronics" /></label>
      <label>Price (INR)<input required min="0" type="number" value={form.price} onChange={update('price')} placeholder="0" /></label>
      <label>Stock quantity<input required min="0" type="number" value={form.stock} onChange={update('stock')} placeholder="0" /></label>
      <label className="creator-wide">Image URL<input type="url" value={form.images} onChange={update('images')} placeholder="https://..." /></label>
      <label className="creator-wide">Description<textarea rows="4" value={form.description} onChange={update('description')} placeholder="Describe the product for shoppers and the AI Agent." /></label>
      {saved && <div className="creator-success"><CheckCircle2 size={17} /> Product added to the live catalogue.</div>}
      {error && <div className="creator-error"><XCircle size={17} /> {error}</div>}
      <div className="creator-actions"><button type="button" className="button outline" onClick={onBack}>Cancel</button><button type="submit" className="button primary" disabled={saving}><Plus size={17} /> {saving ? 'Adding product...' : 'Add product'}</button></div>
    </form>
  </main>
}

export default function MerchantDashboard() {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true
    getMerchantAnalytics().then((data) => {
      if (mounted) setAnalytics(data)
    }).catch(() => {
      if (mounted) setError(true)
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const growth = analytics?.aiRevenueGrowthPercentage || 0
  const comparison = analytics?.revenueComparison || []
  const comparisonData = comparison.length ? comparison : [{ label: 'No orders', revenueWithoutAi: 0, revenueWithAi: 0 }]
  const mix = analytics ? [
    { name: 'Upsell', value: analytics.upsellRevenue, color: '#ef8354' },
    { name: 'Cross-sell', value: analytics.crossSellRevenue, color: '#3b82a0' },
  ].filter((entry) => entry.value > 0) : []

  if (location.pathname === '/merchant/products') return <div className="merchant-app command-center"><header className="merchant-nav command-nav"><Link to="/merchant/dashboard" className="brand"><span><Bot size={20} /></span>AI Commerce<small>Merchant</small></Link><div className="command-user"><span>{auth?.name || 'Merchant'}</span><button onClick={() => { logout(); navigate('/login') }} aria-label="Log out" title="Log out"><LogOut size={17} /></button></div></header><ProductCreator auth={auth} onBack={() => navigate('/merchant/dashboard')} /></div>

  return <div className="merchant-app command-center">
    <header className="merchant-nav command-nav">
      <Link to="/merchant/dashboard" className="brand"><span><Bot size={20} /></span>AI Commerce<small>Merchant</small></Link>
      <div className="command-user"><span>{auth?.name || 'Merchant'}</span><button onClick={handleLogout} aria-label="Log out" title="Log out"><LogOut size={17} /></button></div>
    </header>

    <main className="merchant-main command-main">
      <div className="command-heading">
        <div><p className="eyebrow"><Sparkles size={14} /> Merchant command center</p><h1>Revenue, with intelligence.</h1><p>See exactly how your AI Agent is turning intent into incremental growth.</p></div>
        <div className="command-heading-actions"><span className="data-status"><i /> Live commerce data</span><Link className="button primary" to="/merchant/products"><Plus size={17} /> Add product</Link></div>
      </div>

      {loading && <div className="command-loading"><div /><div /><div /><div /></div>}
      {error && <div className="merchant-empty"><XCircle size={24} /><h2>Analytics unavailable</h2><p>We could not load the merchant data. Check that the backend is running.</p></div>}
      {!loading && !error && analytics && <>
        <section className="impact-section">
          <div className="impact-copy"><p className="eyebrow light"><Bot size={15} /> AI Revenue Impact</p><h2>Your agent is<br /><em>earning its keep.</em></h2><p>Every accepted recommendation is measured against the original customer purchase value.</p><div className="impact-callout"><span>🚀</span><div><strong>Your AI Agent generated {money(analytics.aiIncrementalRevenue)} additional revenue</strong><small>Your revenue increased by {percent(growth)} with AI</small></div></div></div>
          <div className="impact-total"><span>Total successful revenue</span><strong>{money(analytics.totalSuccessfulRevenue)}</strong><small>{number(analytics.totalSuccessfulOrders)} paid orders</small><div className="impact-spark"><span style={{ height: `${analytics.totalSuccessfulRevenue ? (analytics.aiIncrementalRevenue / analytics.totalSuccessfulRevenue) * 100 : 0}%` }} /><span style={{ height: `${analytics.totalSuccessfulRevenue ? (analytics.revenueAfterAi / analytics.totalSuccessfulRevenue) * 100 : 0}%` }} /><span style={{ height: analytics.totalSuccessfulRevenue ? '100%' : '0%' }} /></div></div>
        </section>

        <section className="command-section impact-metrics-section">
          <SectionHeading eyebrow="The impact, in numbers" title="Before AI. After AI." detail="Successful paid orders only" />
          <div className="command-metric-grid seven"><Metric label="Total Revenue" value={money(analytics.totalSuccessfulRevenue)} detail={`${number(analytics.totalSuccessfulOrders)} orders`} icon={Wallet} tone="dark" /><Metric label="Revenue Before AI" value={money(analytics.revenueBeforeAi)} detail="Original customer value" icon={ArrowDownRight} /><Metric label="Revenue After AI" value={money(analytics.revenueAfterAi)} detail="With AI contribution" icon={ArrowUpRight} tone="positive" /><Metric label="Additional Revenue" value={money(analytics.aiIncrementalRevenue)} detail="AI-generated uplift" icon={Sparkles} tone="positive" /><Metric label="AI Revenue Growth" value={percent(growth)} detail="Compared with baseline" icon={TrendingUp} tone="positive" /><Metric label="AOV Before AI" value={money(analytics.averageOrderValueBeforeAi)} detail="Per successful order" /><Metric label="AOV After AI" value={money(analytics.averageOrderValueAfterAi)} detail="Per successful order" icon={TrendingUp} tone="positive" /></div>
        </section>

        <section className="command-section">
          <SectionHeading eyebrow="Revenue comparison" title="The AI lift over time" detail="Monthly successful revenue" />
          <div className="chart-panel revenue-chart-panel"><ResponsiveContainer width="100%" height={330}><LineChart data={comparisonData} margin={{ top: 12, right: 18, left: 4, bottom: 4 }}><CartesianGrid stroke="#e4ebe7" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#708078', fontSize: 12 }} /><YAxis tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} tick={{ fill: '#708078', fontSize: 12 }} /><Tooltip content={<ChartTip />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 14 }} /><Line type="monotone" dataKey="revenueWithoutAi" name="Revenue Without AI" stroke="#9ba9a2" strokeWidth={3} dot={{ r: 3, fill: '#9ba9a2' }} /><Line type="monotone" dataKey="revenueWithAi" name="Revenue With AI" stroke="#1f6b4b" strokeWidth={3} dot={{ r: 4, fill: '#1f6b4b' }} /></LineChart></ResponsiveContainer></div>
        </section>

        <section className="command-section">
          <SectionHeading eyebrow="AI growth breakdown" title="Where the lift comes from" detail="Incremental revenue from successful orders" />
          <div className="command-metric-grid four"><Metric label="Upsell Revenue" value={money(analytics.upsellRevenue)} detail="Upgrade value" icon={ArrowUpRight} tone="orange" /><Metric label="Cross-sell Revenue" value={money(analytics.crossSellRevenue)} detail="Complementary value" icon={Sparkles} tone="blue" /><Metric label="AI-assisted Orders" value={number(analytics.aiAssistedOrders)} detail={`${percent(analytics.aiConversionRate)} of paid orders`} icon={Bot} tone="positive" /><Metric label="Revenue per AI Order" value={money(analytics.averageAiRevenuePerAiAssistedOrder)} detail="Additional value per order" icon={TrendingUp} /></div>
          <div className="growth-charts"><div className="chart-panel small-chart"><h3>Upsell revenue</h3><ResponsiveContainer width="100%" height={220}><BarChart data={[{ name: analytics.upsellRevenue > 0 ? 'Upsell' : 'No data', revenue: analytics.upsellRevenue }]} layout="vertical" margin={{ top: 8, right: 18, left: 12, bottom: 8 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" hide /><Tooltip formatter={(value) => money(value)} cursor={{ fill: '#fff7f1' }} /><Bar dataKey="revenue" fill="#ef8354" radius={[0, 5, 5, 0]} barSize={42} /></BarChart></ResponsiveContainer></div><div className="chart-panel small-chart"><h3>Cross-sell revenue</h3><ResponsiveContainer width="100%" height={220}><BarChart data={[{ name: analytics.crossSellRevenue > 0 ? 'Cross-sell' : 'No data', revenue: analytics.crossSellRevenue }]} layout="vertical" margin={{ top: 8, right: 18, left: 12, bottom: 8 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" hide /><Tooltip formatter={(value) => money(value)} cursor={{ fill: '#eef7fa' }} /><Bar dataKey="revenue" fill="#3b82a0" radius={[0, 5, 5, 0]} barSize={42} /></BarChart></ResponsiveContainer></div></div>
        </section>

        <section className="command-section split-section">
          <div><SectionHeading eyebrow="Recommendation analytics" title="Acceptance is the signal" detail="Recorded agent actions" /><div className="command-metric-grid three"><Metric label="Upsells Accepted" value={number(analytics.upsellRecommendationsAccepted)} detail="Upgrade recommendations" icon={ArrowUpRight} tone="orange" /><Metric label="Cross-sells Accepted" value={number(analytics.crossSellRecommendationsAccepted)} detail="Accessory recommendations" icon={Sparkles} tone="blue" /><Metric label="Total Accepted" value={number(analytics.recommendationsAccepted)} detail={`${percent(analytics.recommendationConversionRate)} of ${number(analytics.recommendationsShown)} shown`} icon={CheckCircle2} tone="positive" /></div></div>
          <div className="chart-panel recommendation-mix"><h3>Accepted revenue mix</h3>{mix.length ? <ResponsiveContainer width="100%" height={190}><PieChart><Pie data={mix} dataKey="value" nameKey="name" innerRadius={55} outerRadius={78} paddingAngle={4}>{mix.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip formatter={(value) => money(value)} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer> : <EmptyChart text="No accepted AI recommendations yet." />}</div>
        </section>

        <section className="command-section payment-section"><SectionHeading eyebrow="Razorpay analytics" title="Payment health, at a glance" detail="Live payment records" /><div className="payment-grid"><div className="payment-summary"><div className="payment-summary-head"><CreditCard size={21} /><span>Successful Razorpay payments</span></div><strong>{number(analytics.successfulRazorpayPayments)}</strong><p>{analytics.successfulPaymentRate === null ? 'Payment rate unavailable until attempts are recorded.' : `${percent(analytics.successfulPaymentRate)} successful payment rate`}</p><div className="payment-bar"><span style={{ width: `${analytics.successfulPaymentRate || 0}%` }} /></div><div className="payment-revenue"><span>Revenue through Razorpay</span><strong>{money(analytics.razorpayRevenue)}</strong></div></div><div className="payment-status"><div><CheckCircle2 size={18} /><span>Successful</span><strong>{number(analytics.successfulRazorpayPayments)}</strong></div><div><XCircle size={18} /><span>Failed</span><strong>{number(analytics.failedRazorpayPayments)}</strong></div><div><XCircle size={18} /><span>Cancelled</span><strong>{number(analytics.cancelledRazorpayPayments)}</strong></div></div></div></section>

        <section className="command-section"><SectionHeading eyebrow="Merchant tools" title="Keep the momentum" /><div className="merchant-panels command-actions">{quickActions.map(({ title, text, icon: Icon, to, action }) => <Link to={to} className="merchant-panel" key={title}><Icon size={21} /><h2>{title}</h2><p>{text}</p><strong>{action} <ArrowUpRight size={14} /></strong></Link>)}</div></section>
      </>}
    </main>
  </div>
}
