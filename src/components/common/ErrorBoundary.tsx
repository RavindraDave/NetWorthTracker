import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  routeName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private handleRouteReset = () => {
    this.setState({ hasError: false, error: null });
  };
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in WealthPulse:', error, errorInfo);
  }

  private handleReset = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.routeName) {
        return (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <AlertTriangle size={40} style={{ color: 'var(--accent-red)', marginBottom: '1rem' }} />
            <p className="text-h3" style={{ marginBottom: '0.5rem' }}>
              {this.props.routeName} failed to render.
            </p>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '1.5rem' }}>
              {this.state.error?.message}
            </p>
            <button className="btn btn-outline" onClick={this.handleRouteReset}>
              <RefreshCw size={14} style={{ marginRight: '0.4rem' }} /> Try Again
            </button>
          </div>
        );
      }
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          textAlign: 'center',
          background: 'var(--bg-app)'
        }}>
          <AlertTriangle size={64} style={{ color: 'var(--accent-red)', marginBottom: '1.5rem' }} />
          <h1 className="text-h1" style={{ marginBottom: '1rem' }}>Something went wrong.</h1>
          <p className="text-muted" style={{ maxWidth: '500px', marginBottom: '2rem' }}>
            We're sorry, but an unexpected error occurred. This could be due to corrupted data or a temporary glitch.
          </p>
          <div className="glass-card" style={{ padding: '1rem', marginBottom: '2rem', textAlign: 'left', overflowX: 'auto', maxWidth: '800px', width: '100%' }}>
            <code style={{ color: 'var(--accent-red)', fontSize: '0.85rem' }}>
              {this.state.error?.toString()}
            </code>
          </div>
          <button className="btn btn-primary" onClick={this.handleReset}>
            <RefreshCw size={16} style={{ marginRight: '0.5rem' }} /> Return to Dashboard
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
