'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: string
  name: string
  phone: string
  email?: string
  role: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  accessToken: string | null
  login: (user: User, accessToken: string, refreshToken: string) => void
  logout: () => void
  register: (user: User, accessToken: string, refreshToken: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const storedToken = localStorage.getItem('accessToken')
    
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser))
      setAccessToken(storedToken)
    }
    setIsLoading(false)
  }, [])

  const login = (newUser: User, token: string, refreshToken: string) => {
    setUser(newUser)
    setAccessToken(token)
    localStorage.setItem('user', JSON.stringify(newUser))
    localStorage.setItem('accessToken', token)
    localStorage.setItem('refreshToken', refreshToken)
  }

  const register = (newUser: User, token: string, refreshToken: string) => {
    login(newUser, token, refreshToken)
  }

  const logout = () => {
    setUser(null)
    setAccessToken(null)
    localStorage.removeItem('user')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        accessToken,
        login,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
