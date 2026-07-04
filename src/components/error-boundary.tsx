'use client'

import { Component } from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-red-900/40 bg-red-950/20 p-6 text-center">
          <p className="text-sm font-medium text-red-300">Something went wrong</p>
          <p className="mt-1 text-xs text-red-400/70">
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 rounded-full border border-white/10 px-4 py-1.5 text-xs text-white/50 hover:text-white/70"
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
