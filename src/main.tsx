import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

type Props = { children: ReactNode };
type State = { error: Error | null };

class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('JARVIS frontend error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="jarvis-shell">
          <section className="auth-screen">
            <div className="auth-card">
              <div className="orb">!</div>
              <span className="eyebrow">JARVIS FRONTEND ERROR</span>
              <h1>The interface hit an error</h1>
              <p>
                The JARVIS interface loaded, but one of its components failed to start.
                Refresh the page and try again.
              </p>
              <small>{this.state.error.message || 'Unknown frontend error'}</small>
              <button className="security-primary" onClick={() => window.location.reload()}>
                Reload JARVIS
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
