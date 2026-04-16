import { StrictMode, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { UserProvider } from './contexts/UserContext.tsx'
import { SignalRProvider } from './contexts/SignalRContext.tsx'
import { AuthGate } from './components/AuthGate.tsx'
import type { User } from './services/api.ts'

function Root() {
  const [userId, setUserId] = useState<string | null>(null)

  const handleUserAuthenticated = useCallback((user: User) => {
    setUserId(user.userId)
  }, [])

  return (
    <AuthGate onUserAuthenticated={handleUserAuthenticated}>
      {userId && (
        <UserProvider userId={userId}>
          <SignalRProvider>
            <App />
          </SignalRProvider>
        </UserProvider>
      )}
    </AuthGate>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
