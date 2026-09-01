import { useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Bot, Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { addToCart, getCart, getOrders, getUserProfile, updateUserProfile } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Assistant, CartPage, Checkout, OrderDashboard, ProductDetails, Products, ShopHome, SimplePage } from './ShopPages'

function ProfilePage() {
  const { auth } = useAuth()
  const [profile, setProfile] = useState({
    fullName: auth?.profile?.fullName || auth?.name || '',
    phone: auth?.profile?.phone || '',
    email: auth?.profile?.email || auth?.email || '',
    street: auth?.profile?.street || '',
    building: auth?.profile?.building || '',
    landmark: auth?.profile?.landmark || '',
    city: auth?.profile?.city || '',
    state: auth?.profile?.state || '',
    pincode: auth?.profile?.pincode || '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getUserProfile().then((data) => {
      if (!active) return
      setProfile({
        fullName: data?.fullName || auth?.name || '',
        phone: data?.phone || '',
        email: data?.email || auth?.email || '',
        street: data?.street || '',
        building: data?.building || '',
        landmark: data?.landmark || '',
        city: data?.city || '',
        state: data?.state || '',
        pincode: data?.pincode || '',
      })
    }).catch(() => {})
    return () => { active = false }
  }, [auth?.email, auth?.name])

  const handleChange = (key, value) => setProfile((current) => ({ ...current, [key]: value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const saved = await updateUserProfile(profile)
      setProfile({
        fullName: saved.fullName || '',
        phone: saved.phone || '',
        email: saved.email || '',
        street: saved.street || '',
        building: saved.building || '',
        landmark: saved.landmark || '',
        city: saved.city || '',
        state: saved.state || '',
        pincode: saved.pincode || '',
      })
      setMessage('Your delivery details have been saved.')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="section"><div className="section-heading"><div><p className="eyebrow">Your account</p><h1>Delivery profile</h1></div></div><div className="checkout-panel"><form onSubmit={handleSubmit} className="form-grid profile-form"><input value={profile.fullName} onChange={(e) => handleChange('fullName', e.target.value)} placeholder="Full name" required /><input value={profile.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="Phone number" required /><input className="wide" value={profile.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="Email address" required /><input className="wide" value={profile.street} onChange={(e) => handleChange('street', e.target.value)} placeholder="Street / Building / Landmark" required /><input value={profile.building} onChange={(e) => handleChange('building', e.target.value)} placeholder="Building / flat" /><input value={profile.landmark} onChange={(e) => handleChange('landmark', e.target.value)} placeholder="Landmark" /><input value={profile.city} onChange={(e) => handleChange('city', e.target.value)} placeholder="City" required /><input value={profile.state} onChange={(e) => handleChange('state', e.target.value)} placeholder="State" required /><input value={profile.pincode} onChange={(e) => handleChange('pincode', e.target.value)} placeholder="Pincode" required />{error && <div className="login-error wide" role="alert"><span>!</span><div><strong>Profile update failed</strong><p>{error}</p></div></div>}{message && <div className="notice success-note wide">{message}</div>}<button className="button primary wide" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save delivery details'}</button></form></div></section>
}

export default function CustomerShop() {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [cart, setCart] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { getCart().then(setCart).catch(() => {}) }, [])
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleAdd = async (product, quantity = 1) => {
    try {
      const updated = await addToCart(product._id, quantity)
      setCart(updated)
      setToast(`${product.name} added to your cart`)
    } catch (error) {
      setToast(error.response?.data?.error?.message || 'Could not add that product')
    }
    window.setTimeout(() => setToast(''), 2800)
  }

  return (
    <div className="shop-app">
      <header className="shop-nav"><div className="nav-inner"><button className="mobile-menu icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu">{menuOpen ? <X /> : <Menu />}</button><Link to="/shop" className="brand"><span><Bot size={21} /></span> AI Commerce</Link><nav className={`main-nav ${menuOpen ? 'open' : ''}`}><Link to="/shop">Home</Link><Link to="/shop/products">Products</Link><Link to="/shop/products?category=Electronics">Categories</Link><Link to="/shop/ai-assistant">AI Assistant</Link><Link to="/shop/deals">Deals</Link></nav><div className="nav-actions"><Link to="/shop/products" className="nav-search"><Search size={18} /><span>Search products</span></Link><Link className="icon-button" to="/shop/wishlist" aria-label="Wishlist"><Heart size={19} /></Link><Link className="cart-button" to="/shop/cart" aria-label="Cart"><ShoppingBag size={19} /><b>{cart?.items?.length || 0}</b></Link><Link to="/shop/profile" className="profile-menu"><User size={17} /><span>{auth?.name?.split(' ')[0] || 'Account'}</span></Link><button className="profile-logout" onClick={handleLogout}>Log out</button></div></div></header>
      <main><Routes><Route index element={<ShopHome onAdd={handleAdd} />} /><Route path="products" element={<Products onAdd={handleAdd} />} /><Route path="products/:id" element={<ProductDetails onAdd={handleAdd} />} /><Route path="cart" element={<CartPage cart={cart} setCart={setCart} onAdd={handleAdd} />} /><Route path="ai-assistant" element={<Assistant onAdd={handleAdd} onNotify={setToast} />} /><Route path="checkout" element={<Checkout cart={cart} />} /><Route path="orders" element={<OrderDashboard />} /><Route path="wishlist" element={<SimplePage eyebrow="Saved for later" title="Wishlist" />} /><Route path="profile" element={<ProfilePage />} /><Route path="deals" element={<OrderDashboard />} /></Routes></main>
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </div>
  )
}
