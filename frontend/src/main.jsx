import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider, SignedIn, SignedOut, SignIn } from '@clerk/clerk-react'
import './styles/app.css'
import App from './App.jsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY (set it in frontend/.env.local)')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      {/* Signed out: show Clerk's sign-in / sign-up card and nothing else. */}
      <SignedOut>
        <div className="auth-gate">
          <h1 className="auth-gate__brand">midWife</h1>
          <p className="auth-gate__tagline">helping give birth to your plans</p>
          <SignIn routing="hash" />
        </div>
      </SignedOut>
      {/* Signed in: the real app mounts (it can assume a logged-in user). */}
      <SignedIn>
        <App />
      </SignedIn>
    </ClerkProvider>
  </StrictMode>,
)
