"use client";

import { useState } from "react";

type TrailerLinkProps = {
  trailerId: string;
  title: string;
  variant?: "link" | "poster";
  posterSrc?: string;
};

export function TrailerLink({ trailerId, title, variant = "link", posterSrc }: TrailerLinkProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "poster" ? (
        <button onClick={() => setOpen(true)} className="relative group cursor-pointer">
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
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover font-bold cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M8 5v14l11-7z" />
          </svg>
          PVを再生
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-3xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setOpen(false)}
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
      )}
    </>
  );
}

export function MobileTrailer({
  trailerId,
  title,
  fallbackImage,
}: {
  trailerId: string;
  title: string;
  fallbackImage?: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="aspect-video w-full">
        <iframe
          src={`https://www.youtube.com/embed/${trailerId}?autoplay=1`}
          title={`${title} PV`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }

  return (
    <button onClick={() => setPlaying(true)} className="relative w-full cursor-pointer">
      <img
        src={fallbackImage || `https://img.youtube.com/vi/${trailerId}/hqdefault.jpg`}
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
  );
}
