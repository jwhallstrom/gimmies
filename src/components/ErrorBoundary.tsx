import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches unhandled React render errors so the user sees a friendly
 * recovery screen instead of a blank white page on mobile.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  private handleReload = () => {
    // Clear any corrupted persisted state that might cause a crash loop
    try {
      const idbReq = indexedDB.deleteDatabase('gimmies-idb');
      idbReq.onsuccess = () => window.location.reload();
      idbReq.onerror = () => window.location.reload();
      // If deleteDatabase hangs, reload after 2 seconds anyway
      setTimeout(() => window.location.reload(), 2000);
    } catch {
      window.location.reload();
    }
  };

  private handleSoftReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#09243F] to-[#0D3762] p-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
            <div className="text-5xl mb-4">⛳</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h1>
            <p className="text-gray-500 text-sm mb-6">
              The app hit an unexpected error. This can happen when running locally without the cloud backend.
            </p>

            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-gray-400 cursor-pointer">Error details</summary>
                <pre className="mt-2 text-[10px] bg-gray-100 p-3 rounded overflow-x-auto whitespace-pre-wrap text-red-600">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="space-y-3">
              <button
                onClick={this.handleSoftReload}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReload}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
              >
                Clear Data & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
