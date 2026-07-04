'use client'

export default function EvaluateError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="mx-auto max-w-md rounded-xl border border-red-900/40 bg-red-950/20 p-8 text-center">
        <p className="text-sm font-medium text-red-300">Evaluation page error</p>
        <p className="mt-2 text-xs text-red-400/70">
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-full border border-white/10 bg-transparent px-5 py-2 text-xs text-white/50 transition-all duration-200 hover:border-white/20 hover:text-white/70"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
