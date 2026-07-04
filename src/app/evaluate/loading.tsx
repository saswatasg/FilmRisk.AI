export default function EvaluateLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-emerald-400" />
        <p className="mt-3 text-xs text-white/30">Loading evaluate...</p>
      </div>
    </div>
  )
}
