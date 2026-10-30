import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, useLocation } from 'react-router-dom'
import App from './App'
import AdminApp from './admin/AdminApp'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Client errors (missing configuration, unauthorised sessions, validation
      // failures) do not become successful by retrying.
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status
        // Configuration gaps (missing admin database, unauthenticated session)
        // will not resolve through a blind retry.
        if (status === 503) return false
        if (typeof status === 'number' && status >= 400 && status < 500) return false
        return failureCount < 1
      },
    },
  },
})

function Root() {
  const location = useLocation()
  // Platform administration is a separate shell and API surface. It must not
  // inherit the merchant workspace cookie or merchant navigation.
  const isAdmin = location.pathname === '/admin' || location.pathname.startsWith('/admin/')
  return isAdmin ? <AdminApp /> : <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
