import * as React from 'react';
import { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Safe Service Worker Registration
(async () => {
  try {
    const pwa = await import('virtual:pwa-register');
    if (pwa && pwa.registerSW) {
      pwa.registerSW({ immediate: true });
    }
  } catch (e) {
    console.warn('PWA Service Worker registration skipped:', e);
  }
})();

// ErrorBoundary defined early to catch all subsequent errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('App crash caught by ErrorBoundary:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', background: '#fff', color: '#333', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ margin: '0 0 1rem', fontWeight: 900 }}>Ứng dụng gặp sự cố khởi động</h2>
          <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #eee', width: '100%', maxWidth: '500px', overflow: 'auto', marginBottom: '2rem' }}>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#c00', fontSize: '0.9rem' }}>{this.state.error.toString()}</p>
            <pre style={{ margin: '1rem 0 0', fontSize: '0.7rem', color: '#666', textAlign: 'left', opacity: 0.7 }}>{this.state.error.stack}</pre>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => { localStorage.clear(); indexedDB.deleteDatabase('POSMTrackerDB'); window.location.reload(); }}
              style={{ background: '#000', color: '#fff', border: 'none', padding: '1rem 2rem', borderRadius: '2rem', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
            >
              🗑️ XÓA CACHE & THỬ LẠI
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ background: '#eee', color: '#333', border: 'none', padding: '1rem 2rem', borderRadius: '2rem', fontWeight: 900, cursor: 'pointer' }}
            >
              🔄 TẢI LẠI TRANG
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy load the whole App to isolate its evaluation context
const App = lazy(() => import('./App.jsx'));

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <Suspense fallback={
          <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
            <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
            <p style={{ fontWeight: 900, color: '#64748b', fontSize: '0.8rem', letterSpacing: '0.1em' }}>KHỞI ĐỘNG HỆ THỐNG...</p>
          </div>
        }>
          <App />
        </Suspense>
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  console.error("Critical Failure: Root element not found in DOM.");
}
