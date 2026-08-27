import React, { createContext, useState, useEffect } from 'react'

export const AuthContextType = createContext()

export function AuthContext({ children }) {
  const [auth, setAuth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('user')
    
    if (token && user) {
      setAuth(JSON.parse(user))
    }
    setLoading(false)
  }, [])

  const login = (user, token) => {
    setAuth(user)
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }

  const logout = () => {
    setAuth(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return (
    <AuthContextType.Provider value={{ auth, loading, login, logout }}>
      {children}
    </AuthContextType.Provider>
  )
}
