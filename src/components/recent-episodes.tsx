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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {episodes.map((ep) => (
        <Link
          key={`${ep.anime.slug}-${ep.episode}`}
          href={`/anime/${ep.anime.slug}`}
          className="group relative overflow-hidden rounded border border-border bg-bg-card transition-shadow hover:shadow-md"
        >
          {ep.anime.image ? (
            <img
              src={ep.anime.image}
              alt={ep.anime.title}
              className="aspect-[3/4] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[3/4] w-full items-center justify-center bg-bg-card text-xs text-text-muted">
              画像なし
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

          {/* Platform - top right */}
          <div className="absolute top-1.5 right-1.5">
            {ep.anime.platforms.slice(0, 1).map((pid) => (
              <span
                key={pid}
                className="rounded-sm bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white"
              >
                {platforms[pid].name}
              </span>
            ))}
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-2.5">
            <span className="mb-1.5 inline-block rounded-sm bg-accent px-1 py-px text-xs font-bold text-white">
              第{ep.episode}話
            </span>
            <h3 className="line-clamp-2 text-base font-bold leading-tight text-white drop-shadow-lg">
              {ep.anime.title}
            </h3>
            <p className="mt-1 text-xs text-white/70">
              {formatRelativeTime(ep.airedAt)}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}日前`;
  if (diffHours > 0) return `${diffHours}時間前`;
  return "配信中";
}
