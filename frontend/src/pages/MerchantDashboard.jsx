import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, Bot, ClipboardList, LogOut, Package, Plus, TrendingUp, ArrowUp, Wallet } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getMerchantAnalytics } from '../services/api'

const quickActions = [
  { title: 'Products', text: 'Manage the catalogue stored in MongoDB.', icon: Package, to: '/merchant/products', action: 'Open catalogue' },
  { title: 'Analytics', text: 'Review sales, conversion, and recommendation performance.', icon: BarChart3, to: '/merchant/analytics', action: 'View analytics' },
  { title: 'Payments', text: 'Monitor payment records and settlement status.', icon: Wallet, to: '/merchant/payments', action: 'View payments' },
  { title: 'Audit trail', text: 'Inspect agent and system actions for your store.', icon: ClipboardList, to: '/merchant/audit', action: 'Open audit log' },
]

export default function MerchantDashboard() {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const loadAnalytics = async () => {
      try {
        const data = await getMerchantAnalytics()
        if (mounted) {
          setAnalytics(data)
        }
      } catch (error) {
        console.error('Failed to load analytics:', error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadAnalytics()

    return () => {
      mounted = false
    }
  }, [])

  const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`

  const maxRevenue = analytics ? Math.max(analytics.originalCustomerRevenue || 0, analytics.aiIncrementalRevenue || 0, 1) : 1
  const revenueBar = (value) => Math.max((value / maxRevenue) * 100, 8)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="merchant-app">
      <header className="merchant-nav">
        <Link to="/merchant/dashboard" className="brand">
          <span><Bot size={20} /></span>
          AI Commerce
          <small>Merchant</small>
        </Link>

        <div>
          <span>{auth?.name || 'Merchant'}</span>
          <button onClick={handleLogout} aria-label="Log out" title="Log out">
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

        {!loading && analytics ? (
          <>
            <section className="merchant-section">
              <div className="merchant-kpi-grid merchant-metrics">
                <div className="merchant-kpi-card">
                  <div className="label">Total Revenue</div>
                  <div className="value">{formatCurrency(analytics.totalSuccessfulRevenue)}</div>
                  <div className="meta">{analytics.totalSuccessfulOrders} orders completed</div>
                </div>

                <div className="merchant-kpi-card">
                  <div className="label">Orders Completed</div>
                  <div className="value">{analytics.totalSuccessfulOrders}</div>
                  <div className="meta">Successful transactions</div>
                </div>

                <div className="merchant-kpi-card">
                  <div className="label">Original Revenue</div>
                  <div className="value">{formatCurrency(analytics.originalCustomerRevenue)}</div>
                  <div className="meta">Customer selections only</div>
                </div>

                <div className="merchant-kpi-card">
                  <div className="label">AI Incremental Revenue</div>
                  <div className="value">{formatCurrency(analytics.aiIncrementalRevenue)}</div>
                  <div className="meta positive">
                    <ArrowUp size={14} />
                    {formatPercent(analytics.aiRevenueContributionPercentage)} of total
                  </div>
                </div>

                <div className="merchant-kpi-card">
                  <div className="label">AI Revenue Uplift</div>
                  <div className="value">{formatPercent(analytics.aiRevenueContributionPercentage)}</div>
                  <div className="meta">vs original customer value</div>
                </div>
              </div>
            </section>

            <section className="merchant-section">
              <h2 className="merchant-section-title">AI Commerce Performance</h2>
              <div className="merchant-performance-grid">
                <div className="merchant-performance-card">
                  <span className="label">Recommendations</span>
                  <div className="value">{analytics.recommendationsShown}</div>
                  <div className="subvalue">shown to customers</div>
                </div>

                <div className="merchant-performance-card">
                  <span className="label">Accepted</span>
                  <div className="value">{analytics.recommendationsAccepted}</div>
                  <div className="subvalue">conversion {formatPercent(analytics.recommendationConversionRate)}</div>
                </div>

                <div className="merchant-performance-card">
                  <span className="label">Cross-sell Revenue</span>
                  <div className="value">{formatCurrency(analytics.crossSellRevenue)}</div>
                  <div className="subvalue">from accessories</div>
                </div>

                <div className="merchant-performance-card revenue-boost">
                  <span className="label">Upsell Revenue</span>
                  <div className="value">{formatCurrency(analytics.upsellRevenue)}</div>
                  <div className="subvalue">from upgrades</div>
                </div>
              </div>
            </section>

            <section className="merchant-section merchant-two-col">
              <div className="merchant-revenue-chart">
                <h2 className="merchant-section-title">Revenue Breakdown</h2>
                <div className="merchant-revenue-bars">
                  <div className="merchant-revenue-bar">
                    <div className="merchant-revenue-bar-label">Original</div>
                    <div className="merchant-revenue-bar-visual">
                      <div
                        className="merchant-revenue-bar-inner"
                        style={{ height: `${revenueBar(analytics.originalCustomerRevenue)}%`, background: 'linear-gradient(180deg, #6c7772, #8a9399)' }}
                      />
                    </div>
                    <div className="value">{formatCurrency(analytics.originalCustomerRevenue)}</div>
                  </div>

                  <div className="merchant-revenue-bar">
                    <div className="merchant-revenue-bar-label">AI</div>
                    <div className="merchant-revenue-bar-visual">
                      <div
                        className="merchant-revenue-bar-inner"
                        style={{ height: `${revenueBar(analytics.aiIncrementalRevenue)}%`, background: 'linear-gradient(180deg, #1f6b4b, #2d8659)' }}
                      />
                    </div>
                    <div className="value">{formatCurrency(analytics.aiIncrementalRevenue)}</div>
                  </div>

                  <div className="merchant-revenue-bar">
                    <div className="merchant-revenue-bar-label">Total</div>
                    <div className="merchant-revenue-bar-visual">
                      <div
                        className="merchant-revenue-bar-inner"
                        style={{ height: '100%', background: 'linear-gradient(180deg, #536bca, #5f7cff)' }}
                      />
                    </div>
                    <div className="value">{formatCurrency(analytics.totalSuccessfulRevenue)}</div>
                  </div>
                </div>
              </div>

              <div className="merchant-comparison">
                <h2 className="merchant-section-title">Cross-Sell vs Upsell</h2>
                <div className="merchant-comparison-row">
                  <div className="merchant-comparison-item">
                    <div className="type">Cross-Sell</div>
                    <div className="metric">
                      <span className="metric-label">Revenue</span>
                      <span className="metric-value">{formatCurrency(analytics.crossSellRevenue)}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Accepted</span>
                      <span className="metric-value">{Math.max(0, analytics.recommendationsAccepted || 0)}</span>
                    </div>
                  </div>

                  <div className="merchant-comparison-item">
                    <div className="type">Upsell</div>
                    <div className="metric">
                      <span className="metric-label">Revenue</span>
                      <span className="metric-value">{formatCurrency(analytics.upsellRevenue)}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Accepted</span>
                      <span className="metric-value">{Math.max(0, analytics.recommendationsAccepted || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="merchant-section">
              <h2 className="merchant-section-title">Top AI Revenue Drivers</h2>

              <div style={{ marginBottom: '36px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#18211f', marginBottom: '16px' }}>Top Cross-Sell Products</h3>
                {analytics.crossSellRevenue > 0 ? (
                  <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <table className="merchant-drivers-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>AI Type</th>
                          <th>Original Value</th>
                          <th>Additional Revenue</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="product-name">Accessories (Aggregated)</td>
                          <td><span className="ai-type cross-sell">Cross-Sell</span></td>
                          <td>—</td>
                          <td>{formatCurrency(analytics.crossSellRevenue)}</td>
                          <td>{formatCurrency(analytics.crossSellRevenue)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="merchant-empty">
                    <p>No cross-sell revenue generated yet.</p>
                  </div>
                )}
              </div>

              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#18211f', marginBottom: '16px' }}>Top Upsell Products</h3>
                {analytics.upsellRevenue > 0 ? (
                  <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <table className="merchant-drivers-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>AI Type</th>
                          <th>Original Value</th>
                          <th>Additional Revenue</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="product-name">Upgrades (Aggregated)</td>
                          <td><span className="ai-type upsell">Upsell</span></td>
                          <td>—</td>
                          <td>{formatCurrency(analytics.upsellRevenue)}</td>
                          <td>{formatCurrency(analytics.upsellRevenue)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="merchant-empty">
                    <p>No upsell revenue generated yet.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="merchant-section">
              <h2 className="merchant-section-title">Quick Actions</h2>
              <div className="merchant-panels">
                {quickActions.map(({ title, text, icon: Icon, to, action }) => (
                  <Link to={to} className="merchant-panel" key={title}>
                    <Icon size={21} />
                    <h2>{title}</h2>
                    <p>{text}</p>
                    <strong>{action} →</strong>
                  </Link>
                ))}
              </div>
            </section>
          </>
        ) : (
          <div className="merchant-section">
            <div className="merchant-kpi-grid merchant-metrics">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="merchant-kpi-card">
                  <div className="label">Loading</div>
                  <div className="value">—</div>
                  <div className="meta">Fetching latest analytics…</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
