import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { store } from './store/store.js'

// Suppress extension-related errors
window.addEventListener('error', (event) => {
  if (event.message?.includes('Could not establish connection') || 
      event.message?.includes('Receiving end does not exist')) {
    event.preventDefault()
  }
}, true)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Provider>
  </StrictMode>
)
