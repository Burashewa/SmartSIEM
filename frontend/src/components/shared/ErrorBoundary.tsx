import { Component, type ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-[#0a0a0f]">
          <div className="bg-[#0f0f17] border border-[#1f1f2e] p-8 text-center">
            <h2 className="text-xl text-white">Something went wrong</h2>
            <p className="text-sm text-gray-400 mt-2">
              Refresh the page and try again.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
