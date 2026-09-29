import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div style={{
      minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#090b12', color: '#e2e2ea', padding: '24px',
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Something went wrong</h1>
        <p style={{ fontSize: '14px', color: '#8b8da3', marginBottom: '16px' }}>
          This part of the app hit an error. The rest of the app is still running.
        </p>
        {import.meta.env.DEV ? (
          <pre style={{
            overflowX: 'auto', borderRadius: '8px', padding: '12px',
            background: '#111320', color: '#ff716e', fontSize: '12px',
            textAlign: 'left', marginBottom: '16px'
          }}>
            {error.message || String(error)}
          </pre>
        ) : null}
        <button
          type="button"
          onClick={resetError}
          style={{
            padding: '10px 20px', borderRadius: '10px', border: 'none',
            background: '#6c63ff', color: 'white', fontSize: '13px',
            fontWeight: 600, cursor: 'pointer'
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', toError(error), info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.error !== null && prevProps.resetKey !== this.props.resetKey) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
