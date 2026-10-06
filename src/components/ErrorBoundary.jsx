import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('Forestly Caught Error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleSafeReset = () => {
    try {
      sessionStorage.clear()
    } catch {
      // ignore
    }
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-gradient-to-br from-[#06120b] via-[#0b2014] to-[#08170d] text-white select-none">
          {/* Ambient background glows */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(239,68,68,0.1),transparent_65%)]" />

          <div className="relative z-10 max-w-md w-full text-center flex flex-col items-center">
            {/* Storm icon */}
            <div className="mb-6 relative flex items-center justify-center">
              <span className="text-6xl drop-shadow-[0_8px_24px_rgba(239,68,68,0.3)]">🌧️</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
              A Storm Passed Over the Forest
            </h1>
            <p className="text-xs sm:text-sm text-[#d4e4cc]/70 mb-6 leading-relaxed">
              An unexpected render glitch occurred. Don't worry — your habits, streaks, and island progress remain safely stored on your device.
            </p>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mb-4">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 rounded-xl bg-[#a8d878] py-3 px-4 text-xs font-bold text-[#0d1711] transition hover:bg-[#bcf08b] active:scale-95 shadow-md shadow-[#a8d878]/20"
              >
                Reload Forest
              </button>
              <button
                type="button"
                onClick={this.handleSafeReset}
                className="flex-1 rounded-xl border border-white/20 bg-white/10 py-3 px-4 text-xs font-bold text-white transition hover:bg-white/20 active:scale-95"
              >
                Return to Home
              </button>
            </div>

            {/* Collapsible Error Details */}
            {this.state.error && (
              <div className="w-full mt-4 text-left">
                <button
                  type="button"
                  onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
                  className="text-[11px] text-[#a8d878]/80 hover:text-[#a8d878] transition-colors underline mb-2 block mx-auto"
                >
                  {this.state.showDetails ? 'Hide Error Details' : 'View Error Diagnostics'}
                </button>
                {this.state.showDetails && (
                  <div className="rounded-xl border border-white/10 bg-black/40 p-3 max-h-40 overflow-y-auto font-mono text-[10px] text-red-300">
                    <p className="font-bold text-red-400">{this.state.error.toString()}</p>
                    {this.state.errorInfo?.componentStack && (
                      <pre className="mt-2 text-white/50 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
