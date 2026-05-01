"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { AnimeEntry, PlatformId } from "@/lib/types";
import { getRecentEpisodes } from "@/lib/episodes";
import { platforms, getPlatformSearchUrl } from "@/lib/platforms";
import { useWatchedEpisodes } from "@/lib/use-watched-episodes";

interface EpisodeListProps {
  anime: AnimeEntry;
}

export function EpisodeList({ anime }: EpisodeListProps) {
  const tEpisodes = useTranslations("episodes");
  const tPlatforms = useTranslations("platforms");
  const { watched, loaded, setWatched, toggle } = useWatchedEpisodes(anime.slug);

  const { episodes, latestAired } = useMemo(() => {
    const total = anime.episodes;
    const start = anime.episodeStart ?? 1;
    if (!total || total < 1) {
      return { episodes: [] as number[], latestAired: null as number | null };
    }
    const list: number[] = [];
    for (let i = 0; i < total; i++) list.push(start + i);

    let latest: number | null = null;
    if (anime.batchRelease) {
      latest = list[list.length - 1] ?? null;
    } else {
      const recent = getRecentEpisodes([anime]);
      if (recent.length > 0) latest = recent[0].episode;
    }
    return { episodes: list, latestAired: latest };
  }, [anime]);

  if (episodes.length === 0) return null;

  const animePlatforms = anime.platforms;

  return (
    <div className="mt-5 border-t border-border pt-4">
      <h2 className="mb-3 text-xs font-bold text-text-muted">
        {tEpisodes("title")}
      </h2>

      <ul className="divide-y divide-border rounded border border-border bg-bg-card">
        {episodes.map((ep) => {
          const isWatched = watched.has(ep);
          const isAired = latestAired === null ? true : ep <= latestAired;
          const isLatest = latestAired !== null && ep === latestAired;

          return (
            <li
              key={ep}
              className={`flex flex-wrap items-center gap-2 px-3 py-2 ${
                isAired ? "" : "opacity-60"
              }`}
            >
              <button
                type="button"
                onClick={() => loaded && toggle(ep)}
                disabled={!loaded}
                aria-label={
                  isWatched
                    ? tEpisodes("markUnwatched", { ep })
                    : tEpisodes("markWatched", { ep })
                }
                className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border transition-colors ${
                  isWatched
                    ? "bg-accent border-accent text-white"
                    : "border-border bg-bg-card-hover hover:border-accent"
                }`}
              >
                {isWatched && (
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              <span
                className={`min-w-12 text-sm font-bold ${
                  isLatest ? "text-accent" : "text-text-primary"
                }`}
              >
                {tEpisodes("episode", { ep })}
              </span>

              {isLatest && !anime.batchRelease && (
                <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                  {tEpisodes("latest")}
                </span>
              )}

              {animePlatforms.length > 0 && (
                <div className="ml-auto flex flex-wrap items-center gap-1">
                  {animePlatforms.map((pid) => {
                    const p = platforms[pid];
                    if (!p) return null;
                    return (
                      <a
                        key={pid}
                        href={getPlatformSearchUrl(pid, anime.title)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          if (loaded && !isWatched) setWatched(ep, true);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-border bg-bg-card-hover px-1.5 py-0.5 text-[11px] font-bold transition-colors hover:text-accent hover:border-accent"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        {tPlatforms(pid as PlatformId)}
                      </a>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
