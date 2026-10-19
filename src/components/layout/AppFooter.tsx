import Image from "next/image";

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto m-1 md:mx-8 md:mb-4 py-3 md:px-6 px-3 rounded-2xl border backdrop-blur-sm transition-all duration-300 bg-white/80 border-[var(--border)] text-[var(--text-lo)] shadow-xl shadow-slate-200/30 dark:bg-[#131417]/50 dark:shadow-black/30">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mx-auto">
        {/* Left: brand + city credits */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1 text-sm text-[var(--text-lo)]">
          <span className="opacity-60">© {year}</span>
          <span className="font-semibold text-[var(--text-hi)]">Growthpad Consulting Group.</span>
          <span className="opacity-60 text-xs flex items-center gap-1">
            Made with ♡ in
            <span className="relative inline-block group">
              <span className="cursor-default">Nairobi</span>
              <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 scale-90 transition-all duration-300 ease-out group-hover:-top-7 group-hover:opacity-100 group-hover:scale-100">
                <Image src="/assets/images/kenya.gif" alt="Kenya" width={20} height={20} className="w-5 h-5 rounded-sm shadow" unoptimized />
              </span>
            </span>
            {" x "}
            <span className="relative inline-block group">
              <span className="cursor-default">Accra</span>
              <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 scale-90 transition-all duration-300 ease-out group-hover:-top-7 group-hover:opacity-100 group-hover:scale-100">
                <Image src="/assets/images/ghana.gif" alt="Ghana" width={20} height={20} className="w-5 h-5 rounded-sm shadow" unoptimized />
              </span>
            </span>
          </span>
        </div>

        {/* Right: links */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <a href="https://kazi.growthpad.africa" className="hover:text-[#f05d23] transition-colors">Kazi</a>
          <div className="h-3 w-px bg-[var(--border)]" />
          <a href="https://growthpad.africa" target="_blank" rel="noopener noreferrer" className="hover:text-[#f05d23] transition-colors">Website</a>
          <div className="h-3 w-px bg-[var(--border)]" />
          <a href="mailto:support@growthpad.africa" className="hover:text-[#f05d23] transition-colors">Support</a>
        </div>
      </div>
    </footer>
  );
}
