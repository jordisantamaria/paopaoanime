"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimeEntry, PlatformId } from "@/lib/types";
import { RecentEpisode, getRecentEpisodes } from "@/lib/episodes";
import { PlatformFilter } from "@/components/platform-filter";

export function RecentEpisodes({ animeList }: { animeList: AnimeEntry[] }) {
  const [episodes, setEpisodes] = useState<RecentEpisode[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([]);

  useEffect(() => {
    setEpisodes(getRecentEpisodes(animeList));
  }, [animeList]);

  // Get all available platforms
  const allPlatforms = [
    ...new Set(animeList.flatMap((a) => a.platforms)),
  ] as PlatformId[];

  // Filter and deduplicate
  const filtered = episodes.filter((ep) => {
    if (selectedPlatforms.length === 0) return true;
    return ep.anime.platforms.some((p) =>
      selectedPlatforms.includes(p as PlatformId)
    );
  });

  // Deduplicate by anime slug (keep most recent)
  const seen = new Set<string>();
  const deduplicated = filtered.filter((ep) => {
    if (seen.has(ep.anime.slug)) return false;
    seen.add(ep.anime.slug);
    return true;
  }).slice(0, 20);

  return (
    <div>
      <div className="mb-4">
        <PlatformFilter
          available={allPlatforms}
          selected={selectedPlatforms}
          onChange={setSelectedPlatforms}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {deduplicated.map((ep) => (
          <Link
            key={ep.anime.slug}
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
                {ep.anime.batchRelease ? `全${ep.episode}話` : `第${ep.episode}話`}
              </span>
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
