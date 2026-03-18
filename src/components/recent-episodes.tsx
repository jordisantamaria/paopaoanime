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
    <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {episodes.map((ep) => (
        <Link
          key={`${ep.anime.slug}-${ep.episode}`}
          href={`/anime/${ep.anime.slug}`}
          className="group"
        >
          <div className="relative overflow-hidden rounded border border-border">
            {ep.anime.image ? (
              <img
                src={ep.anime.image}
                alt={ep.anime.title}
                className="aspect-[3/4] w-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center bg-bg-card text-xs text-text-muted">
                画像なし
              </div>
            )}

            {/* Episode badge - top left */}
            <span className="absolute top-1.5 left-1.5 rounded-sm bg-accent px-1 py-px text-xs font-bold text-white">
              第{ep.episode}話
            </span>

            {/* Platform - top right */}
            <div className="absolute top-1.5 right-1.5 flex gap-0.5">
              {ep.anime.platforms.slice(0, 2).map((pid) => (
                <span
                  key={pid}
                  className="rounded-sm bg-black/50 px-1 py-px text-[10px] font-bold text-white"
                >
                  {platforms[pid].name}
                </span>
              ))}
            </div>
          </div>

          {/* Info below image */}
          <div className="mt-1.5">
            <h3 className="line-clamp-1 text-sm font-bold text-text-primary group-hover:text-accent">
              {ep.anime.title}
            </h3>
            <p className="text-xs text-text-muted">
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
