"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimeEntry } from "@/lib/types";
import { RecentEpisode, getRecentEpisodes } from "@/lib/episodes";
import { platforms } from "@/lib/platforms";

export function RecentEpisodes({ animeList }: { animeList: AnimeEntry[] }) {
  const [episodes, setEpisodes] = useState<RecentEpisode[]>([]);

  useEffect(() => {
    setEpisodes(getRecentEpisodes(animeList).slice(0, 20));
  }, [animeList]);

  if (episodes.length === 0) return null;

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Latest Episodes</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {episodes.map((ep) => (
          <Link
            key={`${ep.anime.slug}-${ep.episode}`}
            href={`/anime/${ep.anime.slug}`}
            className="group relative overflow-hidden rounded-lg border border-border bg-bg-card transition-all hover:border-border-hover hover:shadow-lg hover:shadow-accent/10"
          >
            {ep.anime.image ? (
              <img
                src={ep.anime.image}
                alt={ep.anime.title}
                className="aspect-[3/4] w-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center bg-bg-secondary text-xs text-text-muted">
                No image
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1c2e]/95 via-[#1a1c2e]/20 to-transparent" />

            {/* Platform badge - top right */}
            <div className="absolute top-2 right-2 flex gap-1">
              {ep.anime.platforms.map((pid) => {
                const p = platforms[pid];
                return (
                  <span
                    key={pid}
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm"
                    style={{
                      backgroundColor: p.color + "cc",
                      color: "#fff",
                    }}
                  >
                    {p.name}
                  </span>
                );
              })}
            </div>

            {/* Title + episode + time - bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <span className="mb-1.5 inline-block rounded-md bg-accent px-2 py-0.5 text-xs font-bold text-white">
                EP {ep.episode}
              </span>
              <h3 className="line-clamp-2 text-sm font-bold leading-snug text-white drop-shadow-lg">
                {ep.anime.title}
              </h3>
              <p className="mt-1 text-xs text-text-secondary">
                {formatRelativeTime(ep.airedAt)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return "Just aired";
}
