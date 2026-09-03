import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export async function getProducts(params = {}) {
  const response = await api.get('/api/products', { params })
  return response.data.data
}

export async function getCategories() {
  const response = await api.get('/api/categories')
  return response.data.data.categories
}

export async function getProduct(id) {
  const response = await api.get(`/api/products/${id}`)
  return response.data.data.product
}

export async function createProduct(product) {
  const response = await api.post('/api/products', product)
  return response.data.data.product
}

export async function getCart() {
  const response = await api.get('/api/cart')
  return response.data.data.cart
}

export async function addToCart(productId, quantity = 1, source = 'customer') {
  const response = await api.post('/api/cart/items', { productId, quantity, source })
  return response.data.data.cart
}

export async function updateCartItem(productId, quantity, merchantId) {
  const response = await api.put(`/api/cart/items/${productId}`, { quantity, merchantId })
  return response.data.data.cart
}

export async function removeFromCart(productId, merchantId) {
  const response = await api.delete('/api/cart/items', { data: { productId, merchantId } })
  return response.data.data.cart
}

export async function getUserProfile() {
  const response = await api.get('/api/auth/profile')
  return response.data.data
}

export async function getMerchantAnalytics(startDate = null, endDate = null) {
  const params = {}
  if (startDate) params.startDate = startDate.toISOString().split('T')[0]
  if (endDate) params.endDate = endDate.toISOString().split('T')[0]
  const response = await api.get('/api/merchant/analytics', { params })
  return response.data.data.analytics
}

export async function updateUserProfile(profile) {
  const response = await api.put('/api/auth/profile', profile)
  return response.data.data
}

export async function sendAgentMessage(message, sessionId, merchantId, currentProductId) {
  const response = await api.post('/api/agent/chat', { message, sessionId, merchantId, currentProductId })
  const payload = response?.data ?? {}
  const data = payload.data ?? {}

  if (!data || typeof data !== 'object') {
    throw new Error('Agent response was empty or invalid')
  }

  return data
}

export async function confirmAgentOrder(sessionId) {
  const response = await api.post('/api/agent/order/confirm', { sessionId })
  return response?.data?.data ?? {}
}

export async function cancelAgentOrder(sessionId) {
  const response = await api.post('/api/agent/order/cancel', { sessionId })
  const payload = response?.data ?? {}
  return payload.data ?? {}
}

export async function createRazorpayOrder(merchantId) {
  const response = await api.post('/api/payments/create-order', { merchantId })
  return response.data
}

export async function verifyRazorpayPayment(payload) {
  const response = await api.post('/api/payment/verify', payload)
  return response.data
}

export async function getOrders() {
  const response = await api.get('/api/orders')
  return response.data.data.orders
}

export default api
