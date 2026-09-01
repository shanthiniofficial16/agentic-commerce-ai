import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, Bot, ClipboardList, LogOut, Package, Plus, Wallet, TrendingUp } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getMerchantAnalytics } from '../services/api'

const panels = [
  { title: 'Products', text: 'Manage the catalogue stored in MongoDB.', icon: Package, to: '/merchant/products', action: 'Open catalogue' },
  { title: 'Analytics', text: 'Review sales, conversion, and recommendation performance.', icon: BarChart3, to: '/merchant/analytics', action: 'View analytics' },
  { title: 'Payments', text: 'Monitor payment records and settlement status.', icon: Wallet, to: '/merchant/payments', action: 'View payments' },
  { title: 'Audit trail', text: 'Inspect agent and system actions for your store.', icon: ClipboardList, to: '/merchant/audit', action: 'Open audit log' },
]

/**
 * MerchantDashboard - Main merchant interface with AI revenue analytics
 * 
 * Features:
 * - Primary KPI cards showing total, original, and AI-generated revenue
 * - Recommendation metrics including conversion rates
 * - Cross-sell vs upsell revenue breakdown
 * - Dynamic loading states
 * - INR currency formatting
 * - Responsive grid layout
 * 
 * Data Source: GET /api/merchant/analytics (authenticated)
 */
export default function MerchantDashboard() {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Fetch analytics on component mount
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const data = await getMerchantAnalytics()
        setAnalytics(data)
      } catch (error) {
        console.error('Failed to load analytics:', error)
      } finally {
        setLoading(false)
      }
    }
    loadAnalytics()
  }, [])

  // Format helpers for currency (₹) and percentages
  const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`

  return (
    <div className="merchant-app">
      <header className="merchant-nav">
        <Link to="/merchant/dashboard" className="brand">
          <span><Bot size={21} /></span> AI Commerce <small>Merchant</small>
        </Link>
        <div>
          <span>{auth?.name}</span>
          <button onClick={handleLogout} aria-label="Log out">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <main className="merchant-main">
        <div className="merchant-heading">
          <div>
            <p className="eyebrow">Merchant workspace</p>
            <h1>Good morning, {auth?.name?.split(' ')[0] || 'there'}.</h1>
            <p>Everything you need to run a sharper, more intelligent catalogue.</p>
          </div>
          <Link className="button primary" to="/merchant/products">
            <Plus size={17} /> Add product
          </Link>
        </div>

        {/* Primary KPI Cards: Total, Original, AI Revenue + Uplift */}
        <div className="merchant-metrics">
          {!loading && analytics ? (
            <>
              <div>
                <span>Total Revenue</span>
                <strong>{formatCurrency(analytics.totalSuccessfulRevenue)}</strong>
                <small>{analytics.totalSuccessfulOrders} orders completed</small>
              </div>
              <div>
                <span>Original Revenue</span>
                <strong>{formatCurrency(analytics.originalCustomerRevenue)}</strong>
                <small>Customer selections only</small>
              </div>
              <div>
                <span>AI Revenue</span>
                <strong>{formatCurrency(analytics.aiIncrementalRevenue)}</strong>
                <small style={{ color: analytics.aiIncrementalRevenue > 0 ? '#10b981' : '#6b7280' }}>
                  <TrendingUp size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  {formatPercent(analytics.aiRevenueContributionPercentage)} of total
                </small>
              </div>
              <div>
                <span>AI Revenue Uplift</span>
                <strong>{formatPercent(analytics.aiRevenueContributionPercentage)}</strong>
                <small>vs original customer value</small>
              </div>
            </>
          ) : (
            <>
              <div>
                <span>Revenue</span>
                <strong>—</strong>
                <small>Loading...</small>
              </div>
              <div>
                <span>Orders</span>
                <strong>—</strong>
                <small>Loading...</small>
              </div>
              <div>
                <span>Catalogue</span>
                <strong>49</strong>
                <small>Products in MongoDB</small>
              </div>
              <div>
                <span>AI influence</span>
                <strong>—</strong>
                <small>Loading...</small>
              </div>
            </>
          )}
        </div>

        {/* Recommendation & AI Revenue Breakdown Cards */}
        {!loading && analytics && (
          <div className="merchant-metrics" style={{ marginTop: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <small style={{ color: '#6b7280' }}>Recommendations</small>
              <p style={{ fontSize: '18px', fontWeight: '600', margin: '8px 0' }}>
                {analytics.recommendationsShown}
              </p>
              <small style={{ color: '#6b7280' }}>shown</small>
            </div>
            <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <small style={{ color: '#6b7280' }}>Accepted</small>
              <p style={{ fontSize: '18px', fontWeight: '600', margin: '8px 0' }}>
                {analytics.recommendationsAccepted}
              </p>
              <small style={{ color: '#6b7280' }}>conversion {formatPercent(analytics.recommendationConversionRate)}</small>
            </div>
            <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <small style={{ color: '#6b7280' }}>Cross-sell</small>
              <p style={{ fontSize: '18px', fontWeight: '600', margin: '8px 0' }}>
                {formatCurrency(analytics.crossSellRevenue)}
              </p>
              <small style={{ color: '#6b7280' }}>revenue generated</small>
            </div>
            <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <small style={{ color: '#6b7280' }}>Upsell</small>
              <p style={{ fontSize: '18px', fontWeight: '600', margin: '8px 0' }}>
                {formatCurrency(analytics.upsellRevenue)}
              </p>
              <small style={{ color: '#6b7280' }}>incremental</small>
            </div>
          </div>
        )}

        {/* Dashboard Navigation Panels */}
        <div className="merchant-panels">
          {panels.map(({ title, text, icon: Icon, to, action }) => (
            <Link to={to} className="merchant-panel" key={title}>
              <Icon size={21} />
              <h2>{title}</h2>
              <p>{text}</p>
              <strong>{action} →</strong>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
