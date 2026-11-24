import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'An unexpected error occurred.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#FFFDF9] border border-[#E5D9C5] rounded-2xl p-6 text-center shadow-sm">
            <h2 className="font-display text-2xl font-bold text-[#7C2D12] mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-[#5C4332] mb-5 leading-relaxed">
              We encountered an issue while communicating with the kitchen service. Please reload and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-[#991B1B] text-[#FFFDF9] text-sm font-semibold rounded-lg hover:bg-[#7F1D1D] transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
