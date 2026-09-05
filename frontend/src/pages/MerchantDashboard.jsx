import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bot, CheckCircle2, ClipboardList, CreditCard, LogOut, Package, Plus, Sparkles, TrendingUp, Wallet, XCircle } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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

function RevenueTrendTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return <div className="chart-tip"><strong>{label} 2026</strong><span><i style={{ background: entry.color }} />{entry.name}: {money(entry.value)}</span></div>
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
  const [error, setError] = useState('')

  const loadAnalytics = () => {
    setLoading(true)
    setError('')
    let mounted = true
    getMerchantAnalytics().then((data) => {
      if (mounted) setAnalytics(data)
    }).catch((requestError) => {
      if (mounted) setError(requestError.response?.data?.error?.message || requestError.message || 'Analytics could not be loaded.')
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }

  useEffect(() => loadAnalytics(), [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const growth = analytics?.aiRevenueGrowthPercentage || 0
  const comparison = analytics?.revenueComparison || []
  const comparisonData = comparison.length ? comparison : [{ label: 'No orders', revenueWithoutAi: 0, revenueWithAi: 0 }]
  const trendData = Array.from({ length: 9 }, (_, index) => {
    const period = `2026-${String(index + 1).padStart(2, '0')}`
    const month = comparison.find((entry) => entry.period === period)
    return {
      label: new Date(Date.UTC(2026, index, 1)).toLocaleDateString('en-US', { month: 'short' }),
      fullLabel: new Date(Date.UTC(2026, index, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      upsellRevenue: Number(month?.monthlyUpsellRevenue || 0),
      crossSellRevenue: Number(month?.monthlyCrossSellRevenue || 0),
    }
  })
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

    <main className="merchant-main dashboard-main">
      <div className="dashboard-header">
        <div className="dashboard-header-content">
          <p className="dashboard-eyebrow"><Bot size={16} /> Merchant Dashboard</p>
          <h1>Monitor sales performance</h1>
          <p className="dashboard-subtitle">Measure the revenue impact of your AI Agent on every transaction.</p>
        </div>
        <div className="dashboard-header-actions">
          <span className="data-status"><i /> Live commerce data</span>
          <Link className="button primary" to="/merchant/products"><Plus size={17} /> Add product</Link>
        </div>
      </div>

      {loading && <div className="command-loading"><div /><div /><div /><div /></div>}
      {error && <div className="merchant-empty"><XCircle size={24} /><h2>Analytics unavailable</h2><p>{error}</p><button className="button outline" type="button" onClick={loadAnalytics}>Try again</button></div>}
      {!loading && !error && analytics && <>
        
        {/* AI REVENUE IMPACT HERO */}
        <section className="ai-revenue-hero">
          <div className="hero-primary">
            <div className="hero-metric-large">
              <span className="hero-label">Additional Revenue Generated by AI</span>
              <strong className="hero-value">{money(analytics.aiIncrementalRevenue)}</strong>
              <span className="hero-growth">{percent(growth)} growth from AI</span>
            </div>
          </div>
          <div className="hero-supporting">
            <div className="hero-metric">
              <span>Total Revenue</span>
              <strong>{money(analytics.totalSuccessfulRevenue)}</strong>
              <small>{number(analytics.totalSuccessfulOrders)} orders</small>
            </div>
            <div className="hero-metric">
              <span>Revenue Before AI</span>
              <strong>{money(analytics.revenueBeforeAi)}</strong>
              <small>Baseline</small>
            </div>
            <div className="hero-metric">
              <span>Revenue After AI</span>
              <strong>{money(analytics.revenueAfterAi)}</strong>
              <small>With AI contribution</small>
            </div>
          </div>
        </section>

        {/* AI REVENUE IMPACT KPI CARDS */}
        <section className="dashboard-section">
          <h2 className="section-title">Revenue Impact Overview</h2>
          <div className="kpi-grid">
            <Metric label="Average Order Value Before AI" value={money(analytics.averageOrderValueBeforeAi)} detail="Per successful order" />
            <Metric label="Average Order Value After AI" value={money(analytics.averageOrderValueAfterAi)} detail="Per successful order" icon={TrendingUp} tone="positive" />
            <Metric label="AI Revenue Growth %" value={percent(growth)} detail="Compared with baseline" icon={TrendingUp} tone="positive" />
            <Metric label="AI-assisted Orders" value={number(analytics.aiAssistedOrders)} detail={`${percent(analytics.aiConversionRate)} of paid orders`} icon={Bot} tone="positive" />
          </div>
        </section>

        {/* REVENUE IMPACT CHART */}
        <section className="dashboard-section">
          <h2 className="section-title">Revenue Impact of AI</h2>
          <div className="chart-container large-chart">
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={comparisonData} margin={{ top: 16, right: 28, left: 12, bottom: 12 }}>
                <CartesianGrid stroke="#e4ebe7" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#708078', fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} tick={{ fill: '#708078', fontSize: 12 }} />
                <Tooltip content={<ChartTip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 18 }} />
                <Line type="monotone" dataKey="revenueWithoutAi" name="Revenue Without AI" stroke="#9ba9a2" strokeWidth={2.5} dot={{ r: 3, fill: '#9ba9a2' }} />
                <Line type="monotone" dataKey="revenueWithAi" name="Revenue With AI" stroke="#1f6b4b" strokeWidth={3} dot={{ r: 4, fill: '#1f6b4b' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* AI AGENT PERFORMANCE */}
        <section className="dashboard-section">
          <h2 className="section-title">AI Agent Performance</h2>
          <div className="kpi-grid">
            <Metric label="Recommendations Made" value={number(analytics.recommendationsShown)} detail="Total shown to customers" icon={Bot} />
            <Metric label="Recommendations Accepted" value={number(analytics.recommendationsAccepted)} detail={`${percent(analytics.recommendationConversionRate)} conversion rate`} icon={CheckCircle2} tone="positive" />
            <Metric label="Revenue per AI Order" value={money(analytics.averageAiRevenuePerAiAssistedOrder)} detail="Additional value per order" icon={TrendingUp} tone="positive" />
            <Metric label="AI Assisted Orders" value={number(analytics.aiAssistedOrders)} detail={`${percent(analytics.aiConversionRate)} of paid orders`} icon={Bot} tone="positive" />
          </div>
        </section>

        {/* UPSELL VS CROSS-SELL */}
        <section className="dashboard-section">
          <h2 className="section-title">Upsell vs Cross-sell Analytics</h2>
          <div className="chart-grid">
            <div className="chart-container">
              <h3>Monthly Upsell Revenue</h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="upsellRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef8354" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#ef8354" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e4ebe7" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#708078', fontSize: 11 }} />
                  <YAxis tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} tick={{ fill: '#708078', fontSize: 11 }} />
                  <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload.fullLabel} content={<RevenueTrendTip />} />
                  <Area type="monotone" dataKey="upsellRevenue" name="Upsell Revenue" stroke="#ef8354" strokeWidth={2} fill="url(#upsellRevenueFill)" dot={{ r: 2, fill: '#ef8354' }} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-container">
              <h3>Monthly Cross-sell Revenue</h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="crossSellRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82a0" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3b82a0" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e4ebe7" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#708078', fontSize: 11 }} />
                  <YAxis tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} tick={{ fill: '#708078', fontSize: 11 }} />
                  <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload.fullLabel} content={<RevenueTrendTip />} />
                  <Area type="monotone" dataKey="crossSellRevenue" name="Cross-sell Revenue" stroke="#3b82a0" strokeWidth={2} fill="url(#crossSellRevenueFill)" dot={{ r: 2, fill: '#3b82a0' }} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="kpi-grid" style={{ marginTop: '24px' }}>
            <Metric label="Upsell Revenue" value={money(analytics.upsellRevenue)} detail="Upgrade value" icon={ArrowUpRight} tone="orange" />
            <Metric label="Cross-sell Revenue" value={money(analytics.crossSellRevenue)} detail="Complementary value" icon={Sparkles} tone="blue" />
            <Metric label="Upsells Accepted" value={number(analytics.upsellRecommendationsAccepted)} detail="Upgrade recommendations" icon={ArrowUpRight} tone="orange" />
            <Metric label="Cross-sells Accepted" value={number(analytics.crossSellRecommendationsAccepted)} detail="Accessory recommendations" icon={Sparkles} tone="blue" />
          </div>
        </section>

        {/* PAYMENT HEALTH */}
        <section className="dashboard-section">
          <h2 className="section-title">Payment Health</h2>
          <div className="payment-grid">
            <div className="payment-summary">
              <div className="payment-summary-head">
                <CreditCard size={21} />
                <span>Successful Razorpay Payments</span>
              </div>
              <strong>{number(analytics.successfulRazorpayPayments)}</strong>
              <p>{analytics.successfulPaymentRate === null ? 'Payment rate unavailable until attempts are recorded.' : `${percent(analytics.successfulPaymentRate)} successful payment rate`}</p>
              <div className="payment-bar">
                <span style={{ width: `${analytics.successfulPaymentRate || 0}%` }} />
              </div>
              <div className="payment-revenue">
                <span>Revenue through Razorpay</span>
                <strong>{money(analytics.razorpayRevenue)}</strong>
              </div>
            </div>
            <div className="payment-status">
              <div>
                <CheckCircle2 size={18} />
                <span>Successful</span>
                <strong>{number(analytics.successfulRazorpayPayments)}</strong>
              </div>
              <div>
                <XCircle size={18} />
                <span>Failed</span>
                <strong>{number(analytics.failedRazorpayPayments)}</strong>
              </div>
              <div>
                <XCircle size={18} />
                <span>Cancelled</span>
                <strong>{number(analytics.cancelledRazorpayPayments)}</strong>
              </div>
            </div>
          </div>
        </section>

        {/* MERCHANT TOOLS */}
        <section className="dashboard-section">
          <h2 className="section-title">Merchant Tools</h2>
          <div className="merchant-panels command-actions">
            {quickActions.map(({ title, text, icon: Icon, to, action }) => (
              <Link to={to} className="merchant-panel" key={title}>
                <Icon size={21} />
                <h2>{title}</h2>
                <p>{text}</p>
                <strong>{action} <ArrowUpRight size={14} /></strong>
              </Link>
            ))}
          </div>
        </section>
      </>}
    </main>
  </div>
}
