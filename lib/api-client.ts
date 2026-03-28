// API Client for making consistent HTTP requests with auth headers

interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '')
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('accessToken')
  }

  private getHeaders(customHeaders?: Record<string, string>) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    }

    const token = this.getAuthToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    return headers
  }

  async request<T = any>(
    path: string,
    options?: RequestInit & { params?: Record<string, string> }
  ): Promise<ApiResponse<T>> {
    try {
      const url = new URL(`${this.baseUrl}${path}`)

      if (options?.params) {
        Object.entries(options.params).forEach(([key, value]) => {
          url.searchParams.append(key, value)
        })
      }

      const response = await fetch(url.toString(), {
        ...options,
        headers: this.getHeaders(options?.headers as Record<string, string>),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          error: data.error || 'An error occurred',
        }
      }

      return { data }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }
    }
  }

  async get<T = any>(
    path: string,
    params?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'GET', params })
  }

  async post<T = any>(
    path: string,
    body?: any
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async put<T = any>(
    path: string,
    body?: any
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async patch<T = any>(
    path: string,
    body?: any
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async delete<T = any>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'DELETE' })
  }
}

export const apiClient = new ApiClient()
