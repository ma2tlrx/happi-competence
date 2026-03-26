import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'

/* ── Sentry — Error Tracking ─────────────────────────────────────── */
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.2,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false })],
  });
}

/* ── PostHog — Analytics ─────────────────────────────────────────── */
if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    autocapture: true,
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
