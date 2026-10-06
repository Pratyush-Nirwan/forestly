export default function NotFoundPage() {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-gradient-to-br from-[#07150d] via-[#0d2719] to-[#08170e] text-white select-none">
      {/* Soft radial ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(168,216,120,0.12),transparent_70%)]" />

      <div className="relative z-10 max-w-md w-full text-center flex flex-col items-center">
        {/* Lost compass / tree icon */}
        <div className="mb-6 relative flex items-center justify-center">
          <div className="text-6xl drop-shadow-[0_8px_24px_rgba(168,216,120,0.3)]">🧭</div>
        </div>

        <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#a8d878] mb-2">
          404 Error
        </p>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
          Lost in the Woods
        </h1>
        <p className="text-xs sm:text-sm text-[#d4e4cc]/70 mb-8 max-w-sm leading-relaxed">
          The forest path you’re looking for doesn’t exist or has moved deeper into the wilderness.
        </p>

        {/* Action Button */}
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl bg-[#a8d878] py-3.5 px-6 text-sm font-bold text-[#0d1711] transition hover:bg-[#bcf08b] active:scale-95 shadow-lg shadow-[#a8d878]/25"
        >
          <span>Return to Your Forest</span>
          <span>→</span>
        </a>

        <div className="mt-10 flex items-center gap-4 text-xs text-[#d4e4cc]/40">
          <a href="/privacy" className="hover:text-white transition">Privacy</a>
          <span>•</span>
          <a href="/terms" className="hover:text-white transition">Terms</a>
          <span>•</span>
          <a href="/demo" className="hover:text-white transition">Demo Grove</a>
        </div>
      </div>
    </div>
  )
}
