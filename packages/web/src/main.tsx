import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { LanguageProvider } from './i18n'
import { ClerkProviderWrapper, AuthGate } from './lib/clerk'
import { queryClient } from './queryClient'
import { ToastProvider } from './components/Toast'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProviderWrapper>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <ToastProvider>
            <AuthGate>
              {/* basename = Vite's BASE_URL ('/Urlaub/' in the Pages build,
                  '/' in dev) so routing stays under the deployed subpath. */}
              <BrowserRouter basename={import.meta.env.BASE_URL}>
                <App />
              </BrowserRouter>
            </AuthGate>
          </ToastProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ClerkProviderWrapper>
  </React.StrictMode>
)
