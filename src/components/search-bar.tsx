"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AnimeEntry } from "@/lib/types";

export function SearchBar({ animeList }: { animeList: AnimeEntry[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const results =
    query.length >= 1
      ? animeList
          .filter((a) => {
            const q = query.toLowerCase();
            return (
              a.title.toLowerCase().includes(q) ||
              a.titleRomaji?.toLowerCase().includes(q) ||
              a.titleEnglish?.toLowerCase().includes(q)
            );
          })
          .slice(0, 8)
      : [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        placeholder="検索..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-32 sm:w-44 rounded bg-white/20 px-3 py-1.5 text-xs text-white placeholder-white/60 outline-none focus:bg-white/30 focus:w-48 transition-all"
      />

      {open && results.length > 0 && (
        <div className="absolute top-full right-0 mt-1 w-72 rounded border border-border bg-bg-card shadow-lg z-50">
          {results.map((a) => (
            <Link
              key={a.slug}
              href={`/anime/${a.slug}`}
              onClick={() => {
                setOpen(false);
                setQuery("");
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg-card-hover"
            >
              {a.image && (
                <img
                  src={a.image}
                  alt={a.title}
                  className="h-8 w-6 rounded-sm object-cover"
                />
              )}
              <span className="truncate text-text-primary">{a.title}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
