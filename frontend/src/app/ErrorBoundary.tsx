import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#0a0a0f',
            color: '#fecaca',
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ color: '#fff', marginBottom: '0.5rem' }}>Something went wrong</h1>
          <p style={{ marginBottom: '1rem', color: '#9ca3af' }}>
            The page crashed while loading. Details:
          </p>
          <pre
            style={{
              background: '#1a1a24',
              border: '1px solid #ef4444',
              padding: '1rem',
              borderRadius: '8px',
              overflow: 'auto',
              color: '#fca5a5',
              fontSize: '13px',
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            style={{
              marginTop: '1.5rem',
              padding: '0.6rem 1.2rem',
              background: '#4f46e5',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Go to home
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
