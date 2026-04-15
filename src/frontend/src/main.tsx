import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { UserProvider } from './contexts/UserContext.tsx'
import { SignalRProvider } from './contexts/SignalRContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserProvider>
      <SignalRProvider>
        <App />
      </SignalRProvider>
    </UserProvider>
  </StrictMode>,
)
