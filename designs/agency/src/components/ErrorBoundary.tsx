import { Component, type ErrorInfo, type ReactNode } from 'react';
import './button.css';
import './ebound.css';

/**
 * A screen that fails shows what went wrong, with a way back, instead of an empty page. Back to the screen
 * tries the same screen again; Start again opens the prototype afresh from Sign in.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('GSP prototype: a screen failed', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="ebound" role="alert">
        <div className="ebound__card">
          <h1 className="ebound__title">This screen didn’t open</h1>
          <p className="ebound__text">Something in the prototype failed while showing it. Send Claude what it says below, then go back or start again.</p>
          <pre className="ebound__msg">{`${error.name}: ${error.message}\n${(error.stack ?? '').split('\n').slice(1, 6).join('\n')}`}</pre>
          <div className="ebound__acts">
            <button type="button" className="btn btn--secondary" onClick={() => this.setState({ error: null })}>
              Back to the screen
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                try {
                  window.history.replaceState(null, '', window.location.pathname);
                } catch {
                  /* ignore */
                }
                window.location.reload();
              }}
            >
              Start again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
