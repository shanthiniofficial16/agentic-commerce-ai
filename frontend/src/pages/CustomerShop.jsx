import { useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Bot, Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { addToCart, getCart } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Assistant, CartPage, Checkout, ProductDetails, Products, ShopHome, SimplePage } from './ShopPages'

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
      <header className="shop-nav"><div className="nav-inner"><button className="mobile-menu icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu">{menuOpen ? <X /> : <Menu />}</button><Link to="/shop" className="brand"><span><Bot size={21} /></span> AI Commerce</Link><nav className={`main-nav ${menuOpen ? 'open' : ''}`}><Link to="/shop">Home</Link><Link to="/shop/products">Products</Link><Link to="/shop/products?category=Electronics">Categories</Link><Link to="/shop/ai-assistant">AI Assistant</Link><Link to="/shop/deals">Deals</Link></nav><div className="nav-actions"><Link to="/shop/products" className="nav-search"><Search size={18} /><span>Search products</span></Link><Link className="icon-button" to="/shop/wishlist" aria-label="Wishlist"><Heart size={19} /></Link><Link className="cart-button" to="/shop/cart" aria-label="Cart"><ShoppingBag size={19} /><b>{cart?.items?.length || 0}</b></Link><div className="profile-menu"><User size={17} /><span>{auth?.name?.split(' ')[0] || 'Account'}</span><button onClick={handleLogout}>Log out</button></div></div></div></header>
      <main><Routes><Route index element={<ShopHome onAdd={handleAdd} />} /><Route path="products" element={<Products onAdd={handleAdd} />} /><Route path="products/:id" element={<ProductDetails onAdd={handleAdd} />} /><Route path="cart" element={<CartPage cart={cart} setCart={setCart} onAdd={handleAdd} />} /><Route path="ai-assistant" element={<Assistant onAdd={handleAdd} />} /><Route path="checkout" element={<Checkout cart={cart} />} /><Route path="orders" element={<SimplePage eyebrow="Your journey" title="Orders" />} /><Route path="wishlist" element={<SimplePage eyebrow="Saved for later" title="Wishlist" />} /><Route path="profile" element={<SimplePage eyebrow="Your account" title="Profile" />} /><Route path="deals" element={<SimplePage eyebrow="Limited time" title="Deals" />} /></Routes></main>
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </div>
  )
}
