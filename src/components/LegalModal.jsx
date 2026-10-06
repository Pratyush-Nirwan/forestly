export default function LegalModal({ type = 'privacy', onClose }) {
  const isPrivacy = type === 'privacy'

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 select-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative flex flex-col w-full max-w-2xl max-h-[85vh] rounded-3xl forest-panel border border-white/10 text-white overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#102016]/90 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{isPrivacy ? '🔒' : '📜'}</span>
            <div>
              <h2 className="text-lg font-bold text-[#eef8ea]">
                {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
              </h2>
              <p className="text-xs text-[#a3c4b1]">
                {isPrivacy ? '100% On-Device, Zero Trackers' : 'Terms of Use & License'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar text-sm text-[#dce9d6]/80 space-y-5 leading-relaxed text-left">
          {isPrivacy ? (
            <>
              <section>
                <h3 className="font-bold text-white text-base mb-1.5 flex items-center gap-2">
                  <span className="text-[#a8d878]">1.</span> 100% Local, On-Device Storage
                </h3>
                <p>
                  Forestly is built with privacy as its foundational design principle. All of your habits, completion histories, island customization, points, and inventory are stored <strong>strictly on your local device</strong> using standard browser <code className="bg-black/30 px-1.5 py-0.5 rounded text-[#a8d878] text-xs">localStorage</code>.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-white text-base mb-1.5 flex items-center gap-2">
                  <span className="text-[#a8d878]">2.</span> No Tracking Cookies or Ad Pixels
                </h3>
                <p>
                  We do not use advertising cookies, analytics pixels, or profiling identifiers. We do not sell, rent, or monetize your data. Because no tracking or non-essential cookies are utilized, your browsing experience is completely unmonitored.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-white text-base mb-1.5 flex items-center gap-2">
                  <span className="text-[#a8d878]">3.</span> Zero Server Data Transmission
                </h3>
                <p>
                  Your habit records are never transmitted to any cloud servers or external databases. Your personal data remains on your machine and cannot be accessed by anyone else unless you physically share your device.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-white text-base mb-1.5 flex items-center gap-2">
                  <span className="text-[#a8d878]">4.</span> Your Right to Delete (Complete Erasure)
                </h3>
                <p>
                  You retain full ownership of your records. You can delete and purge all data at any time directly through the <strong>Settings → Danger Zone → Hold to Delete</strong> button, or by clearing your browser site storage.
                </p>
              </section>
            </>
          ) : (
            <>
              <section>
                <h3 className="font-bold text-white text-base mb-1.5 flex items-center gap-2">
                  <span className="text-[#a8d878]">1.</span> Agreement & License
                </h3>
                <p>
                  By accessing and using Forestly, you agree to these Terms of Service. Forestly is provided to you as a personal, gamified productivity tool to visualize and cultivate positive daily habits.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-white text-base mb-1.5 flex items-center gap-2">
                  <span className="text-[#a8d878]">2.</span> No Medical or Healthcare Warranty
                </h3>
                <p>
                  Forestly is a motivational habit-tracking app. It is not intended to provide medical, psychological, or clinical treatment advice.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-white text-base mb-1.5 flex items-center gap-2">
                  <span className="text-[#a8d878]">3.</span> Availability & Disclaimer
                </h3>
                <p>
                  Forestly is provided on an "as is" and "as available" basis without warranties of any kind. Since data is kept locally in browser storage, clearing browser cache or running in Incognito/Private mode may reset your progress.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-white text-base mb-1.5 flex items-center gap-2">
                  <span className="text-[#a8d878]">4.</span> Intellectual Property
                </h3>
                <p>
                  All 3D models, procedural shaders, branding, and graphics of Forestly are protected by applicable intellectual property rights.
                </p>
              </section>
            </>
          )}

          <div className="pt-3 border-t border-white/10 text-xs text-[#d4e4cc]/50">
            Last updated: October 2026 • Forestly
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 bg-[#102016]/90 px-6 py-3 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#a8d878] px-5 py-2 text-xs font-bold text-[#0d1711] hover:bg-[#bcf08b] transition active:scale-95 shadow-sm"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  )
}
