import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] caught rendering error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', backgroundColor: '#0A0A12',
          color: '#EEE', fontFamily: 'system-ui, sans-serif', padding: 32,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎹</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#CC8833' }}>
            {this.props.fallbackMessage || 'Something went wrong'}
          </h2>
          <p style={{ color: '#888', fontSize: 14, maxWidth: 400, textAlign: 'center', marginTop: 8 }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering.'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              marginTop: 20, padding: '10px 24px', borderRadius: 8,
              border: 'none', backgroundColor: '#CC8833', color: '#FFF',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            ← Back to Library
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
