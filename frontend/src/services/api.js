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

export async function getCart() {
  const response = await api.get('/api/cart')
  return response.data.data.cart
}

export async function addToCart(productId, quantity = 1) {
  const response = await api.post('/api/cart/items', { productId, quantity })
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

export async function updateUserProfile(profile) {
  const response = await api.put('/api/auth/profile', profile)
  return response.data.data
}

export async function sendAgentMessage(message, sessionId, merchantId, currentProductId) {
  const response = await api.post('/api/agent/chat', { message, sessionId, merchantId, currentProductId })
  return response.data.data
}

export async function confirmAgentOrder(sessionId) {
  const response = await api.post('/api/agent/order/confirm', { sessionId })
  return response.data.data.order
}

export async function cancelAgentOrder(sessionId) {
  const response = await api.post('/api/agent/order/cancel', { sessionId })
  return response.data.data
}

export default api
