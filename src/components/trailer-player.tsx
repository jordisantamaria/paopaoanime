"use client";

import { ReactNode, useState } from "react";

function TrailerModal({ trailerId, title, onClose }: { trailerId: string; title: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[80vw] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-sm font-bold cursor-pointer"
          >
            閉じる ✕
          </button>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-lg">
          <iframe
            src={`https://www.youtube.com/embed/${trailerId}?autoplay=1`}
            title={`${title} PV`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Full anime detail trailer section.
 * Renders mobile banner (full-width, outside padding) + desktop poster (inside flex).
 * Both are always in the DOM (CSS hidden), sharing one modal state.
 * Children = the info column, rendered next to the poster in the flex.
 */
export function AnimeTrailer({ trailerId, title, posterSrc, bannerSrc, children, footer }: {
  trailerId: string;
  title: string;
  posterSrc?: string;
  bannerSrc?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const play = () => setOpen(true);

  return (
    <>
      {/* Mobile: full-width banner - outside padding */}
      <button onClick={play} className="sm:hidden relative w-full cursor-pointer">
        <img
          src={bannerSrc || posterSrc || `https://img.youtube.com/vi/${trailerId}/hqdefault.jpg`}
          alt={title}
          className="w-full aspect-video object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-7 w-7 ml-1">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
          PV
        </span>
      </button>

      {/* Content area with padding */}
      <div className="p-4 sm:p-5">
        <div className="flex gap-4 sm:gap-5">
          {/* Desktop: poster column */}
          <div className="hidden sm:block shrink-0">
            <button onClick={play} className="relative group cursor-pointer">
              <img
                src={posterSrc}
                alt={title}
                className="h-72 w-48 rounded object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors rounded">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-6 w-6 ml-0.5">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
              <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                PV
              </span>
            </button>
            <button
              onClick={play}
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover font-bold cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M8 5v14l11-7z" />
              </svg>
              PVを再生
            </button>
          </div>

          {/* Info column */}
          {children}
        </div>
        {footer}
      </div>

      {/* Shared modal */}
      {open && <TrailerModal trailerId={trailerId} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}
