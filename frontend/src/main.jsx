import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider, SignedIn, SignedOut, SignIn, SignUp } from '@clerk/clerk-react'
import './styles/app.css'
import App from './App.jsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY (set it in frontend/.env.local)')
}

// On-site sign-in / sign-up. `routing="virtual"` keeps the flow in-memory so it never
// navigates away to Clerk's hosted Account Portal, and our own toggle (not Clerk's
// redirecting link) switches between the two — so everything stays on this domain.
function AuthGate() {
  const [mode, setMode] = useState('signIn')
  return (
    <div className="auth-gate">
      <h1 className="auth-gate__brand">midWife</h1>
      <p className="auth-gate__tagline">helping give birth to your plans</p>
      {mode === 'signIn'
        ? <SignIn routing="virtual" />
        : <SignUp routing="virtual" />}
      <button
        type="button"
        className="auth-gate__switch"
        onClick={() => setMode(m => (m === 'signIn' ? 'signUp' : 'signIn'))}
      >
        {mode === 'signIn' ? 'New here? Create an account' : 'Already have an account? Sign in'}
      </button>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <SignedOut>
        <AuthGate />
      </SignedOut>
      <SignedIn>
        <App />
      </SignedIn>
    </ClerkProvider>
  </StrictMode>,
)
