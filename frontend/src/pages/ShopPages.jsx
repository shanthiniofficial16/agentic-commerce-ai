const cartItemPrice = (item) => Number(item.price ?? item.productId?.price ?? 0)

const cartItemsSubtotal = (items) => items.reduce((sum, item) => sum + cartItemPrice(item) * Number(item.quantity || 0), 0)

const orderItemId = (item) => String(item.productId?._id || item.productId || item.id || item._id)

const mergeOrderItems = (previewItems, cartItems) => {
  const merged = [...(previewItems || [])]
  for (const cartItem of cartItems || []) {
    const existing = merged.find((item) => orderItemId(item) === orderItemId(cartItem))
    if (existing) {
      existing.quantity = cartItem.quantity
      existing.price = cartItem.price ?? existing.price ?? cartItem.productId?.price
    } else {
      merged.push(cartItem)
    }
  }
  return merged
}

const orderItemsTotal = (items) => items.reduce((sum, item) => sum + cartItemPrice(item) * Number(item.quantity || 0), 0)

export function Assistant({ onAdd, onNotify, onCartChange }) {
  const navigate = useNavigate()
  const location = useLocation()
  const contextProduct = location.state?.product
  const [messages, setMessages] = useState([{ role: 'agent', text: contextProduct ? `I can help you understand ${contextProduct.name}. What would you like to know?` : 'Hi! I can help you find products, compare options, check availability, manage your cart, and help with orders.' }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [orderPreview, setOrderPreview] = useState(null)
  const [crossSellItems, setCrossSellItems] = useState([])
  const [crossSellMessage, setCrossSellMessage] = useState('')
  const [selectedCrossSell, setSelectedCrossSell] = useState(null)

  const handleCrossSellAdd = async (product) => {
    if (selectedCrossSell?.id === (product.id || product._id)) return
    try {
      setBusy(true)
      const updatedCart = await addToCart(product.id || product._id, 1, 'ai_cross_sell')
      onCartChange?.(updatedCart)
      setOrderPreview((preview) => {
        if (!preview) return preview
        const items = mergeOrderItems(preview.items || [{ ...preview.product, productId: preview.product.id, quantity: preview.quantity }], updatedCart.items)
        return { ...preview, items, total: orderItemsTotal(items) }
      })
      setSelectedCrossSell({ id: product.id || product._id, merchantId: updatedCart.merchantId })
      setCrossSellItems((items) => items.filter((item) => (item.id || item._id) !== (product.id || product._id)))
      setMessages((items) => [...items, { role: 'agent', text: `Added ${product.name} to your cart. Your updated total is ${money(updatedCart?.total || 0)}.` }])
    } catch (error) {
      setMessages((items) => [...items, { role: 'agent', text: error.response?.data?.error?.message || `I couldn’t add ${product.name} to the cart right now.` }])
    } finally {
      setBusy(false)
    }
  }
  const send = async (event) => {
    event.preventDefault()
    if (!input.trim() || busy) return
    const text = input.trim()
    setInput('')
    setMessages((items) => [...items, { role: 'user', text }])
    setBusy(true)
    try {
      const result = await sendAgentMessage(text, sessionId || undefined, undefined, contextProduct?._id)
      const nextSessionId = result?.sessionId || sessionId || undefined
      if (nextSessionId) setSessionId(nextSessionId)

      const isCheckoutStage = Boolean(result?.orderPreview || result?.pendingConfirmation)
      setOrderPreview(result?.orderPreview || null)
      const nextCrossSell = Array.isArray(result?.crossSell) ? result.crossSell : []
      setCrossSellItems(isCheckoutStage ? nextCrossSell : [])
      if (isCheckoutStage && nextCrossSell.length && selectedCrossSell?.id !== (nextCrossSell[0].id || nextCrossSell[0]._id)) {
        const updatedCart = await addToCart(nextCrossSell[0].id || nextCrossSell[0]._id, 1, 'ai_cross_sell')
        onCartChange?.(updatedCart)
        setOrderPreview((preview) => {
          if (!preview) return preview
          const items = mergeOrderItems(preview.items || [{ ...preview.product, productId: preview.product.id, quantity: preview.quantity }], updatedCart.items)
          return { ...preview, items, total: orderItemsTotal(items) }
        })
        setSelectedCrossSell({ id: nextCrossSell[0].id || nextCrossSell[0]._id, merchantId: updatedCart.merchantId })
      }
      setCrossSellMessage(isCheckoutStage && nextCrossSell.length ? <><span>COMPLETE YOUR SETUP</span><button className="button outline cross-sell-skip" onClick={skipCrossSell}>Skip</button></> : '')
      setMessages((items) => [...items, {
        role: 'agent',
        text: typeof result?.message === 'string' && result.message.trim() ? result.message : 'I could not generate a response for that request.',
        products: Array.isArray(result?.products) ? result.products : [],
        action: result?.viewOrderPath ? { label: 'View My Order', path: result.viewOrderPath } : null,
      }])
    } catch (error) {
      setMessages((items) => [...items, { role: 'agent', text: error.response?.data?.error?.message || error.message || 'Sorry, I could not connect to the shopping assistant right now.' }])
    } finally { setBusy(false) }
  }
    const placeOrder = async () => {
      setBusy(true);
      try {
        setMessages((items) => [...items, { role: 'agent', text: 'Proceeding to secure payment.' }]);
        const result = await confirmAgentOrder(sessionId);
        const paymentSession = result?.paymentSession || null;
        if (!paymentSession?.razorpayOrderId || !paymentSession?.keyId) {
          throw new Error('No secure payment session was created for this order.')
        }

        await loadRazorpayScript()

        const razorpayInstance = new window.Razorpay({
          key: paymentSession.keyId,
          amount: paymentSession.amount,
          currency: paymentSession.currency || 'INR',
          order_id: paymentSession.razorpayOrderId,
          name: 'AI Commerce',
          description: 'Secure order payment',
          handler: async (razorpayResponse) => {
            try {
              const verification = await verifyRazorpayPayment({
                sessionId,
                internalOrderId: paymentSession.internalOrderId || paymentSession.paymentId || undefined,
                razorpay_order_id: razorpayResponse.razorpay_order_id,
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_signature: razorpayResponse.razorpay_signature,
              })

              if (verification?.success) {
                setOrderPreview(null)
                setMessages((items) => [...items, { role: 'agent', text: `Payment successful. Your order has been confirmed.\nOrder ID: ${verification?.data?.order?.id || 'created'}` }]);
                if (verification?.data?.order) {
                  onNotify?.(`🎉 Order placed successfully! ${verification.data.order.productName || 'Order'} · ₹${Number(verification.data.order.total || 0).toLocaleString('en-IN')} · Expected delivery: ${new Date(verification.data.order.estimatedDeliveryDate || Date.now()).toLocaleDateString('en-US', { dateStyle: 'long' })}`)
                }
              } else {
                setMessages((items) => [...items, { role: 'agent', text: verification?.error?.message || 'Payment verification failed. Your order remains pending.' }]);
              }
            } catch (error) {
              setMessages((items) => [...items, { role: 'agent', text: error.response?.data?.error?.message || 'Payment verification failed. Please try again.' }]);
            } finally {
              setBusy(false)
            }
          },
          prefill: {
            name: orderPreview?.profile?.fullName || '',
            email: orderPreview?.profile?.email || '',
            contact: orderPreview?.profile?.phone || '',
          },
          theme: { color: '#0f766e' },
          modal: {
            ondismiss: () => {
              setMessages((items) => [...items, { role: 'agent', text: 'Payment was cancelled. Your order remains unpaid.' }]);
              setBusy(false)
            },
          },
        })

        razorpayInstance.on('payment.failed', (failure) => {
          const paymentError = failure?.error || {};
          const details = [paymentError.error_code || paymentError.code ? `Code: ${paymentError.error_code || paymentError.code}` : '', paymentError.error_description || paymentError.description ? `Description: ${paymentError.error_description || paymentError.description}` : '', paymentError.error_reason || paymentError.reason ? `Reason: ${paymentError.error_reason || paymentError.reason}` : '', paymentError.error_step || paymentError.step ? `Step: ${paymentError.error_step || paymentError.step}` : ''].filter(Boolean).join(' | ');
          console.error('Razorpay payment failed', paymentError);
          setMessages((items) => [...items, { role: 'agent', text: details || 'Payment failed. Please try again.' }]);
          setBusy(false)
        })

        razorpayInstance.open()
      } catch (error) {
        setMessages((items) => [...items, { role: 'agent', text: error.response?.data?.error?.message || error.message || 'I could not place that order.' }]);
        setBusy(false)
      }
    }
    const skipCrossSell = async () => {
      if (!selectedCrossSell) return setCrossSellItems([])
      try {
        setBusy(true)
        const updatedCart = await removeFromCart(selectedCrossSell.id, selectedCrossSell.merchantId)
        onCartChange?.(updatedCart)
        setOrderPreview((preview) => {
          if (!preview) return preview
          const items = preview.items.filter((item) => orderItemId(item) !== String(selectedCrossSell.id))
          return { ...preview, items, total: orderItemsTotal(items) }
        })
        setSelectedCrossSell(null)
        setCrossSellItems([])
      } catch (error) {
        setMessages((items) => [...items, { role: 'agent', text: error.response?.data?.error?.message || 'I could not skip the recommended product right now.' }])
      } finally {
        setBusy(false)
      }
    }
    const cancelOrder = async () => { await cancelAgentOrder(sessionId); setOrderPreview(null); setMessages((items) => [...items, { role: 'agent', text: 'The order preview has been cancelled.' }]) }
    return <section className="agent-page"><div className="agent-header"><button className="back-link agent-back" onClick={() => navigate(-1)}><ArrowRight size={16} /> Back to Store</button><div><p className="eyebrow"><Bot size={14} /> AI shopping assistant</p><h1>Find your next favourite.</h1></div><span className="agent-status"><i /> Online / Ready</span></div><div className="agent-layout"><div className="agent-intro"><span className="assistant-avatar"><Bot size={28} /></span><p className="eyebrow">Personal shopping intelligence</p><h2>Ask. Discover.<br /><em>Buy better.</em></h2><p className="muted">Search the live catalogue, compare products, check stock, or manage your cart.</p>{contextProduct && <div className="agent-context"><small>Currently viewing</small><strong>{contextProduct.name}</strong><span>{money(contextProduct.price)}</span></div>}</div><div className="chat-window agent-chat"><div className="chat-messages">{messages.map((message, index) => <div className={`message ${message.role}`} key={`${index}-${message.text}`}><span>{message.role === 'agent' ? <Bot size={15} /> : 'You'}</span><p>{message.text}</p>{message.products?.length > 0 && <div className="chat-products">{message.products.map((product) => <article className="chat-product" key={product.id}><img src={imageFor(product)} alt={product.name} /><div><Link to={`/shop/products/${product.id}`}><strong>{product.name}</strong></Link><p>{money(product.price)}</p><button className="add-button" onClick={() => onAdd({ ...product, _id: product.id })}>Add to cart</button></div></article>)}</div>}</div>)}{!orderPreview && crossSellItems.length > 0 && <div className="cross-sell-panel"><div className="cross-sell-header">{crossSellMessage || 'Recommended for your laptop'}</div><div className="cross-sell-grid">{crossSellItems.map((item) => <article className="cross-sell-card" key={item.id || item._id}><img src={imageFor(item)} alt={item.name} /><div className="cross-sell-card-body"><h4>{item.name}</h4><p className="cross-sell-price">{money(item.price)}</p><p className="cross-sell-benefit">{item.benefit || item.reason || 'Useful for everyday productivity.'}</p><button className="add-button" onClick={() => handleCrossSellAdd(item)} disabled={busy}>Add to cart</button></div></article>)}</div></div>}{orderPreview && <div className="confirmation-shelf"><div className="confirmation-product-card"><div className="confirmation-product-head">Recommended item</div><div className="confirmation-product-inner"><img src={imageFor(orderPreview.product || { name: 'Selected item', category: 'Electronics' })} alt={orderPreview.product?.name || 'Selected item'} /><div className="confirmation-product-copy"><h4>{orderPreview.product?.name || 'Selected item'}</h4><p className="cross-sell-price">{money(orderPreview.product?.price || orderPreview.total || 0)}</p><p className="cross-sell-benefit">Delivery: {orderPreview.profile?.fullName || 'Customer'} · {orderPreview.profile?.address || 'Address on file'}</p></div></div></div>{crossSellItems.length > 0 && <div className="cross-sell-panel confirmation-cross-sell"><div className="cross-sell-header">{crossSellMessage || 'Recommended for your laptop'}</div><div className="cross-sell-grid">{crossSellItems.map((item) => <article className="cross-sell-card" key={item.id || item._id}><img src={imageFor(item)} alt={item.name} /><div className="cross-sell-card-body"><h4>{item.name}</h4><p className="cross-sell-price">{money(item.price)}</p><p className="cross-sell-benefit">{item.benefit || item.reason || 'Useful for everyday productivity.'}</p><button className="add-button" onClick={() => handleCrossSellAdd(item)} disabled={busy}>Add to cart</button></div></article>)}</div></div>}</div>}{orderPreview && <div className="order-preview"><strong>Order Summary</strong>{(orderPreview.items || [{ ...orderPreview.product, productId: orderPreview.product.id, quantity: orderPreview.quantity }]).map((item) => <span key={orderItemId(item)}>{item.productName || item.name || item.productId?.name || 'Product'} × {item.quantity} · {money(cartItemPrice(item) * Number(item.quantity || 0))}</span>)}<span>Delivery: {orderPreview.profile.fullName}</span><span>{orderPreview.profile.address}, {orderPreview.profile.city}</span><b>Total: {money(orderItemsTotal(orderPreview.items || [{ ...orderPreview.product, productId: orderPreview.product.id, quantity: orderPreview.quantity }]))}</b><button className="button primary" onClick={placeOrder} disabled={busy}>Place Order</button><button className="button outline" onClick={cancelOrder} disabled={busy}>Cancel</button></div>}{busy && <div className="message agent typing"><span><Bot size={15} /></span><p>Thinking<span className="typing-dots">...</span></p></div>}</div><div className="suggestions">{['Find a laptop under ₹70,000', 'Show me the best headphones', 'What can you help me with?'].map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}</button>)}</div><form className="chat-form" onSubmit={send}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask anything about products..." disabled={busy} /><button className="button primary" aria-label="Send" disabled={busy}><ArrowRight size={18} /></button></form></div></div></section>
}
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Bot, Check, ChevronDown, Heart, Minus, Plus, Search, ShoppingBag, Sparkles, Star, Trash2, Truck, X } from 'lucide-react'
import { addToCart, cancelAgentOrder, confirmAgentOrder, createRazorpayOrder, getCart, getCheckoutRecommendation, getOrders, getProduct, getProducts, getUserProfile, removeFromCart, sendAgentMessage, updateCartItem, verifyRazorpayPayment } from '../services/api'
import '../Agent.css'

const categories = ['Electronics', 'Fashion', 'Beauty', 'Home & Kitchen', 'Grocery', 'Sports', 'Books', 'Accessories']
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`
const categoryImages = {
  phone: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
  laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80',
  headphone: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80',
  watch: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
  tablet: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=900&q=80',
  camera: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80',
  monitor: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80',
  keyboard: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80',
  gaming: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80',
  sports: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=900&q=80',
  kitchen: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=900&q=80',
  accessory: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=900&q=80',
}
const imageFor = (product) => {
  if (product?.images?.[0]) return product.images[0]
  const text = `${product?.name || ''} ${product?.subcategory || ''} ${product?.category || ''}`.toLowerCase()
  const key = Object.keys(categoryImages).find((candidate) => text.includes(candidate)) || 'accessory'
  return categoryImages[key]
}
const imageErrorFallback = (event, product) => {
  const fallback = imageFor({ ...product, images: [] })
  if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback
  else event.currentTarget.onerror = null
}

function ProductCard({ product, onAdd }) {
  const [busy, setBusy] = useState(false)
  const sellingPrice = product.price?.sellingPrice || product.price || 0
  const originalPrice = product.price?.mrp || product.originalPrice
  const discount = product.discountPercentage || product.price?.discountPercentage || (originalPrice ? Math.round((1 - sellingPrice / originalPrice) * 100) : 0)
  const handleAdd = async () => { setBusy(true); await onAdd(product); setBusy(false) }
  return <article className="product-card">
    <Link to={`/shop/products/${product._id}`} className="product-image-wrap"><img src={imageFor(product)} onError={(event) => imageErrorFallback(event, product)} alt={product.name} /><span className="ai-badge"><Sparkles size={13} /> AI pick</span><button className="icon-button wishlist" aria-label="Add to wishlist" onClick={(event) => event.preventDefault()}><Heart size={17} /></button></Link>
    <div className="product-card-body"><p className="eyebrow">{product.category}</p><Link to={`/shop/products/${product._id}`}><h3>{product.name}</h3></Link><div className="rating"><Star size={15} fill="currentColor" /> {product.ratings?.average || product.rating || '4.6'} <span>({product.ratings?.count || product.reviewCount || 0})</span></div><div className="price-row"><strong>{money(sellingPrice)}</strong>{originalPrice && <><del>{money(originalPrice)}</del><span className="discount">{discount}% off</span></>}</div><button className="add-button" onClick={handleAdd} disabled={busy || product.stock < 1}>{busy ? 'Adding...' : product.stock < 1 ? 'Out of stock' : 'Add to cart'}</button></div>
  </article>
}

export function ShopHome({ onAdd }) {
  const [products, setProducts] = useState([])
  const [state, setState] = useState('loading')
  useEffect(() => { getProducts({ limit: 8 }).then((data) => { setProducts(data.products); setState('ready') }).catch(() => setState('error')) }, [])
  return <div>
    <section className="hero"><div><p className="eyebrow light"><Sparkles size={15} /> Intelligence for every cart</p><h1>Shop smarter<br /><em>with AI.</em></h1><p className="hero-copy">Find things you will love, with recommendations that understand how you shop.</p><div className="hero-actions"><Link className="button primary" to="/shop/products">Explore products <ArrowRight size={17} /></Link><Link className="button ghost" to="/shop/ai-assistant"><Bot size={17} /> Ask the assistant</Link></div></div><div className="hero-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="robot-mark"><Bot size={76} strokeWidth={1.2} /></div><span className="floating-note note-one">Good match <Check size={14} /></span><span className="floating-note note-two"><Sparkles size={14} /> Personalised</span></div></section>
    <section className="section"><div className="section-heading"><div><p className="eyebrow">Browse by mood</p><h2>What are you looking for?</h2></div><Link to="/shop/products" className="text-link">View all <ArrowRight size={16} /></Link></div><div className="category-grid">{categories.map((category, index) => <Link key={category} to={`/shop/products?category=${encodeURIComponent(category)}`} className={`category-tile tile-${index % 4}`}><span>{['◈', '◌', '✦', '⌂', '◍', '△', '▤', '◇'][index]}</span><strong>{category}</strong><ArrowRight size={16} /></Link>)}</div></section>
    <section className="section featured"><div className="section-heading"><div><p className="eyebrow">Curated for you</p><h2>Recommended products</h2></div><Link to="/shop/products" className="text-link">See the collection <ArrowRight size={16} /></Link></div>{state === 'loading' && <div className="product-grid">{[1, 2, 3, 4].map((item) => <div className="skeleton" key={item} />)}</div>}{state === 'error' && <div className="notice error-state">Connect to the API to load your catalogue.</div>}{state === 'ready' && !products.length && <div className="notice">Your catalogue is empty. Add products in the merchant dashboard.</div>}{products.length > 0 && <div className="product-grid">{products.map((product) => <ProductCard key={product._id} product={product} onAdd={onAdd} />)}</div>}</section>
  </div>
}

export function Products({ onAdd }) {
  const queryCategory = new URLSearchParams(window.location.search).get('category') || ''
  const [filters, setFilters] = useState({ search: '', category: queryCategory, sort: 'relevance' })
  const [products, setProducts] = useState([])
  const [state, setState] = useState('loading')
  useEffect(() => { setState('loading'); getProducts({ search: filters.search || undefined, category: filters.category || undefined, limit: 50 }).then((data) => { setProducts(data.products); setState('ready') }).catch(() => setState('error')) }, [filters.search, filters.category])
  const shown = useMemo(() => [...products].sort((a, b) => filters.sort === 'low' ? a.price - b.price : filters.sort === 'high' ? b.price - a.price : filters.sort === 'rating' ? (b.rating || 0) - (a.rating || 0) : 0), [products, filters.sort])
  return <section className="section catalog"><div className="catalog-heading"><div><p className="eyebrow">The catalogue</p><h1>Find your next favourite.</h1><p className="muted">Search naturally, filter quickly, and let AI narrow it down.</p></div><Link className="ai-search" to="/shop/ai-assistant"><Bot size={17} /> Search with AI</Link></div><div className="catalog-toolbar"><label className="search-field"><Search size={18} /><input placeholder="Try ‘wireless headphones under 5000’" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label><select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select><select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="relevance">Relevance</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="rating">Highest rated</option></select></div>{state === 'loading' && <div className="product-grid">{[1, 2, 3, 4, 5, 6].map((item) => <div className="skeleton" key={item} />)}</div>}{state === 'error' && <div className="notice error-state">We could not reach the catalogue. Check that the backend and MongoDB are running.</div>}{state === 'ready' && !shown.length && <div className="empty-state"><ShoppingBag size={32} /><h2>No products found</h2><p>Try another search or browse every category.</p><button className="button secondary" onClick={() => setFilters({ search: '', category: '', sort: 'relevance' })}>Clear filters</button></div>}{shown.length > 0 && <div className="product-grid">{shown.map((product) => <ProductCard key={product._id} product={product} onAdd={onAdd} />)}</div>}</section>
}

export function ProductDetails({ onAdd }) { const { id } = useParams(); const [product, setProduct] = useState(null); const [state, setState] = useState('loading'); const [quantity, setQuantity] = useState(1); useEffect(() => { getProduct(id).then((item) => { setProduct(item); setState('ready') }).catch(() => setState('error')) }, [id]); if (state === 'loading') return <div className="section"><div className="detail-loading" /></div>; if (state === 'error' || !product) return <div className="section empty-state"><X size={32} /><h2>Product unavailable</h2><Link className="button secondary" to="/shop/products">Back to products</Link></div>; return <section className="section product-detail"><Link className="back-link" to="/shop/products">← Back to products</Link><div className="detail-layout"><div className="detail-image"><img src={imageFor(product)} alt={product.name} /></div><div className="detail-copy"><p className="eyebrow">{product.category}</p><h1>{product.name}</h1><div className="rating large"><Star size={18} fill="currentColor" /> {product.rating || '4.6'} <span>{product.reviewCount || 0} reviews</span></div><div className="detail-price">{money(product.price)} <span>Inclusive of all taxes</span></div><p className="detail-description">{product.description || 'Thoughtfully selected for quality, value, and everyday performance.'}</p><div className="stock"><span /> {product.stock > 0 ? `${product.stock} available today` : 'Out of stock'}</div><div className="quantity"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button><strong>{quantity}</strong><button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}><Plus size={16} /></button></div><div className="detail-actions"><button className="button primary" disabled={!product.stock} onClick={() => onAdd(product, quantity)}>Add to cart</button><button className="button outline"><Heart size={17} /> Wishlist</button></div><div className="insight"><div className="insight-icon"><Sparkles size={18} /></div><div><strong>Why AI recommends this</strong><p>Highly rated by similar shoppers and a strong match for your recent browsing.</p></div></div></div></div></section> }

export function CartPage({ cart, setCart, onAdd }) { const navigate = useNavigate(); const [state, setState] = useState('loading'); useEffect(() => { getCart().then((value) => { setCart(value); setState('ready') }).catch(() => setState('error')) }, [setCart]); const items = cart?.items || []; const subtotal = cartItemsSubtotal(items) || Number(cart?.subtotal || 0); const total = subtotal - Number(cart?.discount || 0); const change = async (item, quantity) => { const value = await updateCartItem(item.productId._id, quantity, cart.merchantId); setCart(value) }; const remove = async (item) => setCart(await removeFromCart(item.productId._id, cart.merchantId)); if (state === 'loading') return <div className="section"><div className="detail-loading" /></div>; if (state === 'error') return <div className="section empty-state"><ShoppingBag size={32} /><h2>Your cart needs a connection</h2><p>Sign in and make sure the backend is running.</p></div>; return <section className="section cart-page"><div className="section-heading"><div><p className="eyebrow">Your selection</p><h1>Shopping cart</h1></div><span className="cart-count">{items.length} items</span></div>{!items.length ? <div className="empty-state"><ShoppingBag size={38} /><h2>Your cart is waiting for something amazing.</h2><Link className="button primary" to="/shop/products">Continue shopping</Link></div> : <div className="cart-layout"><div className="cart-items">{items.map((item) => <div className="cart-item" key={item.productId._id}><img src={imageFor(item.productId)} alt={item.productId.name} /><div className="cart-item-copy"><Link to={`/shop/products/${item.productId._id}`}><h3>{item.productId.name}</h3></Link><p>{item.productId.category}</p><strong>{money(item.price)}</strong><div className="quantity"><button onClick={() => item.quantity > 1 ? change(item, item.quantity - 1) : remove(item)}><Minus size={15} /></button><b>{item.quantity}</b><button onClick={() => change(item, item.quantity + 1)}><Plus size={15} /></button></div></div><button className="icon-button" onClick={() => remove(item)} aria-label="Remove product"><Trash2 size={17} /></button></div>)}<div className="cart-ai"><Sparkles size={21} /><div><strong>Smart savings</strong><p>Complete your setup with accessories selected by the AI assistant.</p></div><Link to="/shop/ai-assistant">Explore <ArrowRight size={15} /></Link></div></div><aside className="summary"><h2>Order summary</h2><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Delivery</span><strong className="free">FREE</strong></div><div><span>AI member saving</span><strong>-₹0</strong></div><hr /><div className="total"><span>Total</span><strong>{money(total)}</strong></div><button className="button primary full" onClick={() => navigate('/shop/checkout')}>Proceed to checkout <ArrowRight size={16} /></button><p className="secure"><Truck size={15} /> Secure checkout · Razorpay ready</p></aside></div>}</section> }

export function LegacyAssistant({ onAdd }) { const [messages, setMessages] = useState([{ role: 'agent', text: 'Hi! I can help you find products, compare options, and build a better cart. What are you shopping for?' }]); const [input, setInput] = useState(''); const [busy, setBusy] = useState(false); const [sessionId, setSessionId] = useState(''); const send = async (event) => { event.preventDefault(); if (!input.trim() || busy) return; const text = input.trim(); setInput(''); setMessages((items) => [...items, { role: 'user', text }]); setBusy(true); try { const result = await sendAgentMessage(text, sessionId || undefined); setSessionId(result.sessionId); setMessages((items) => [...items, { role: 'agent', text: result.message, products: result.products || [] }]); } catch (error) { setMessages((items) => [...items, { role: 'agent', text: error.response?.data?.error?.message || 'I could not reach the shopping assistant. Please try again.' }]); } finally { setBusy(false); } }; return <section className="section assistant"><div className="assistant-intro"><span className="assistant-avatar"><Bot size={28} /></span><p className="eyebrow">Your shopping intelligence</p><h1>Ask, discover,<br /><em>buy better.</em></h1><p className="muted">Try “laptop for programming under ₹70,000” or “what goes well with my cart?”</p></div><div className="chat-window"><div className="chat-messages">{messages.map((message, index) => <div className={`message ${message.role}`} key={index}><span>{message.role === 'agent' ? <Bot size={15} /> : 'You'}</span><p>{message.text}</p>{message.products?.length > 0 && <div className="chat-products">{message.products.map((product) => <article className="chat-product" key={product.id}><img src={imageFor(product)} alt={product.name} /><div><Link to={`/shop/products/${product.id}`}><strong>{product.name}</strong></Link><p>{money(product.price)}</p><button className="add-button" onClick={() => onAdd({ ...product, _id: product.id })}>Add to cart</button></div></article>)}</div>}</div>)}</div>{busy && <div className="message agent"><span><Bot size={15} /></span><p>Searching the live catalogue...</p></div>}<div className="suggestions">{['Laptop under ₹70,000', 'Best headphones', 'Gift for my brother'].map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}</button>)}</div><form className="chat-form" onSubmit={send}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask anything about the catalogue..." disabled={busy} /><button className="button primary" aria-label="Send" disabled={busy}><ArrowRight size={18} /></button></form></div></section> }

const loadRazorpayScript = () => new Promise((resolve, reject) => {
  if (window.Razorpay) return resolve(true)

  const script = document.createElement('script')
  script.src = 'https://checkout.razorpay.com/v1/checkout.js'
  script.async = true
  script.onload = () => resolve(true)
  script.onerror = () => reject(new Error('Unable to load Razorpay checkout'))
  document.body.appendChild(script)
})

export function Checkout({ cart, onCartChange }) {
  const navigate = useNavigate()
  const [checkoutCart, setCheckoutCart] = useState(cart)
  const [step, setStep] = useState(1)
  const [done, setDone] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [recommendation, setRecommendation] = useState(null)
  const [recommendationChecked, setRecommendationChecked] = useState(false)
  const [profile, setProfile] = useState({ fullName: '', email: '', phone: '' })

  useEffect(() => { setCheckoutCart(cart) }, [cart])

  useEffect(() => {
    let active = true
    getUserProfile().then((data) => {
      if (!active) return
      setProfile({
        fullName: data?.fullName || data?.name || '',
        email: data?.email || '',
        phone: data?.phone || '',
      })
    }).catch(() => {})
    return () => { active = false }
  }, [])

  const handleCheckout = async () => {
    if (!checkoutCart || !checkoutCart.items?.length) {
      setError('Your cart is empty. Add an item before checkout.')
      return
    }

    setError('')
    setProcessing(true)

    try {
      if (!recommendationChecked) {
        const result = await getCheckoutRecommendation(checkoutCart.merchantId)
        setRecommendation(result.recommendation || null)
        setRecommendationChecked(true)
        setProcessing(false)
        return
      }

      await loadRazorpayScript()
      const response = await createRazorpayOrder(checkoutCart.merchantId)
      const payload = response?.data
      if (!payload || !payload.keyId || !payload.razorpayOrderId) {
        throw new Error('The payment session could not be created. Please try again.')
      }

      const options = {
        key: payload.keyId,
        amount: payload.amount,
        currency: payload.currency,
        name: 'AI Commerce',
        description: 'Secure order payment',
        order_id: payload.razorpayOrderId,
        handler: async (razorpayResponse) => {
          try {
            const verification = await verifyRazorpayPayment({
              internalOrderId: payload.internalOrderId,
              razorpay_order_id: razorpayResponse.razorpay_order_id,
              razorpay_payment_id: razorpayResponse.razorpay_payment_id,
              razorpay_signature: razorpayResponse.razorpay_signature,
            })

            if (verification?.success) {
              setDone(true)
              return
            }

            setError(verification?.error?.message || 'Payment verification failed. Please try again.')
          } catch (err) {
            setError(err.response?.data?.error?.message || 'Payment verification failed. Please try again.')
          } finally {
            setProcessing(false)
          }
        },
        prefill: {
          name: profile.fullName,
          email: profile.email,
          contact: profile.phone,
        },
        theme: { color: '#0f766e' },
        modal: {
          ondismiss: () => {
            setError('Payment was cancelled. Your order remains unpaid.')
            setProcessing(false)
          },
        },
      }

      const razorpayInstance = new window.Razorpay(options)
      razorpayInstance.on('payment.failed', (failure) => {
        const paymentError = failure?.error || {}
        const details = [
          paymentError.error_code || paymentError.code ? `Code: ${paymentError.error_code || paymentError.code}` : '',
          paymentError.error_description || paymentError.description ? `Description: ${paymentError.error_description || paymentError.description}` : '',
          paymentError.error_reason || paymentError.reason ? `Reason: ${paymentError.error_reason || paymentError.reason}` : '',
          paymentError.error_step || paymentError.step ? `Step: ${paymentError.error_step || paymentError.step}` : '',
        ].filter(Boolean).join(' | ')
        console.error('Razorpay payment failed', paymentError)
        setError(details || 'Payment failed. Please try again.')
        setProcessing(false)
      })
      razorpayInstance.open()
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Unable to start the secure payment flow.')
      setProcessing(false)
    }
  }

  const acceptRecommendation = async () => {
    if (!recommendation) return
    setProcessing(true)
    setError('')
    try {
      const updatedCart = await addToCart(recommendation.id, 1, 'ai_cross_sell')
      setCheckoutCart(updatedCart)
      onCartChange?.(updatedCart)
      setRecommendation(null)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not add the recommendation to your cart.')
    } finally {
      setProcessing(false)
    }
  }

  if (done) {
    return (
      <section className="section confirmation">
        <div className="success-mark"><Check size={30} /></div>
        <p className="eyebrow">Order confirmed</p>
        <h1>That’s a great choice.</h1>
        <p>Payment successful. Your order has been confirmed.</p>
        <Link className="button primary" to="/shop/orders">Track order <ArrowRight size={16} /></Link>
      </section>
    )
  }

  return (
    <section className="section checkout">
      <div className="checkout-steps">
        {['Address', 'Delivery', 'Payment'].map((label, index) => (
          <button
            key={label}
            className={step === index + 1 ? 'active' : step > index + 1 ? 'complete' : ''}
            onClick={() => setStep(index + 1)}
          >
            <span>{step > index + 1 ? <Check size={14} /> : index + 1}</span>
            {label}
          </button>
        ))}
      </div>

      <div className="checkout-panel">
        <p className="eyebrow">Step {step} of 3</p>
        <h1>
          {step === 1 ? 'Where should we deliver?' : step === 2 ? 'Choose your delivery' : 'How would you like to pay?'}
        </h1>

        {step === 1 && (
          <div className="form-grid">
            <input value={profile.fullName} readOnly placeholder="Full name" />
            <input value={profile.phone} readOnly placeholder="Phone number" />
            <input className="wide" value={profile.email} readOnly placeholder="Email address" />
            <input className="wide" value="Delivery details from your saved profile" readOnly />
          </div>
        )}

        {step === 2 && (
          <div className="delivery-options">
            <label>
              <input type="radio" defaultChecked name="delivery" />
              <span>
                <strong>Standard delivery</strong>
                <small>Arrives in 3–5 business days · Free</small>
              </span>
            </label>
            <label>
              <input type="radio" name="delivery" />
              <span>
                <strong>Express delivery</strong>
                <small>Arrives tomorrow · ₹149</small>
              </span>
            </label>
          </div>
        )}

                {step === 3 && (
          <div className="delivery-options">
            <label>
              <input type="radio" defaultChecked name="payment" />
              <span>
                <strong>Razorpay</strong>
                <small>UPI, cards and net banking</small>
              </span>
            </label>
            <label>
              <input type="radio" name="payment" />
              <span>
                <strong>Cash on delivery</strong>
                <small>Pay when your order arrives</small>
              </span>
            </label>
          </div>
        )}

        <div className="checkout-summary">
          {(checkoutCart?.items || []).map((item) => {
            const product = item.productId || {}
            const productId = product._id || item.productId || item._id
            const price = Number(item.price || product.price || 0)
            return <div className="line" key={productId}><span>{product.name || item.productName || 'Product'} × {item.quantity}</span><strong>{money(price * Number(item.quantity || 0))}</strong></div>
          })}
          <div className="line"><span>Subtotal</span><strong>{money(checkoutCart?.subtotal || checkoutCart?.total || 0)}</strong></div>
          <div className="line"><span>Shipping</span><strong>Free</strong></div>
          <div className="line total"><span>Total</span><strong>{money(checkoutCart?.total || 0)}</strong></div>
        </div>

        {recommendation && <div className="cross-sell-panel"><div className="cross-sell-header"><span>Recommended for your order</span></div><div className="cross-sell-grid"><article className="cross-sell-card"><img src={imageFor(recommendation)} alt={recommendation.name} /><div className="cross-sell-card-body"><h4>{recommendation.name}</h4><p className="cross-sell-price">{money(recommendation.price)}</p><p className="cross-sell-benefit">{recommendation.benefit || recommendation.reason || 'A useful addition to your order.'}</p><button className="button primary" onClick={acceptRecommendation} disabled={processing}>Add to cart</button><button className="button outline" onClick={() => setRecommendation(null)} disabled={processing}>Continue without it</button></div></article></div></div>}

        {error && <div className="notice error-state" style={{ marginTop: '18px' }}>{error}</div>}

        <div className="checkout-summary">
          {step < 3 ? (
            <button className="button primary" onClick={() => setStep(step + 1)}>Continue</button>
          ) : (
            <button className="button primary" onClick={handleCheckout} disabled={processing}>
              {processing ? 'Processing...' : recommendation ? 'Choose an option above' : 'Proceed to secure payment'}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

const orderStages = ['Order Placed', 'Payment Confirmed', 'Preparing to Ship', 'Shipped', 'Out for Delivery', 'Delivered']
const stageForOrder = (status) => status === 'DELIVERED' ? 5 : status === 'SHIPPED' ? 3 : status === 'OUT_FOR_DELIVERY' ? 4 : status === 'PAID' ? 1 : 2

export function OrderDashboard() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getOrders().then((data) => setOrders(data || [] )).catch(() => setOrders([])).finally(() => setLoading(false))
  }, [])

  if (loading) return <section className="section simple-page"><p className="eyebrow">Your journey</p><h1>Orders</h1><div className="empty-state"><Sparkles size={32} /><h2>Loading your orders…</h2></div></section>

  if (!orders.length) return <section className="section simple-page"><p className="eyebrow">Your journey</p><h1>Orders</h1><div className="empty-state"><Sparkles size={32} /><h2>No orders yet</h2><p>Your completed orders will appear here after checkout.</p></div></section>

  return <section className="section simple-page"><p className="eyebrow">Your journey</p><h1>Orders</h1><div className="cart-items" style={{ display: 'grid', gap: '16px' }}>{orders.map((order) => { const currentStage = stageForOrder(order.status); return <div className="cart-item" key={order.id}>{order.productImage && <img src={order.productImage} alt={order.product} /> }<div className="cart-item-copy"><h3>{order.product}</h3><p>Quantity: {order.quantity}</p><strong>{money(order.total)}</strong><p>Payment: {order.paymentStatus} · Order status: {order.status}</p><p>Placed: {new Date(order.createdAt).toLocaleDateString('en-IN')}</p>{order.estimatedDeliveryDate && <p>Expected delivery: {new Date(order.estimatedDeliveryDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>}{order.delivery && <p>Delivery: {order.delivery.address || `${order.delivery.city}, ${order.delivery.state}`}</p>}<div className="order-timeline" aria-label={`Order progress: ${order.status}`}>{orderStages.map((stage, index) => <div className={`order-timeline-step ${index < currentStage ? 'complete' : index === currentStage ? 'current' : ''}`} key={stage}><span>{index < currentStage ? '✓' : index === currentStage ? '●' : '○'}</span><small>{stage}</small></div>)}</div></div></div> })}</div></section>
}

export function SimplePage({ title, eyebrow, children }) { return <section className="section simple-page"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children || <div className="empty-state"><Sparkles size={32} /><h2>Personal space, ready for your next order.</h2><p>Your saved items, order history, and preferences will appear here.</p></div>}</section> }
