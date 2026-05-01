"use client";

import { useEffect, useState } from "react";
import { AnimeEntry } from "@/lib/types";
import { getRecentEpisodes } from "@/lib/episodes";
import { useTranslations } from "next-intl";
import { useWatchedEpisodes } from "@/lib/use-watched-episodes";

export function CurrentEpisode({ anime }: { anime: AnimeEntry }) {
  const [episode, setEpisode] = useState<number | null>(null);
  const t = useTranslations("anime");
  const tEpisodes = useTranslations("episodes");
  const { watched, loaded, toggle } = useWatchedEpisodes(anime.slug);

  useEffect(() => {
    // Movies/OVAs/Specials don't have weekly episodes
    if (anime.format && !["TV", "TV_SHORT", "ONA"].includes(anime.format)) return;

    if (anime.batchRelease) return; // all episodes available from start

    const episodes = getRecentEpisodes([anime]);
    if (episodes.length > 0) {
      setEpisode(episodes[0].episode);
    }
  }, [anime]);

  if (anime.batchRelease) {
    return (
      <tr>
        <td>{t("deliveryFormat")}</td>
        <td className="text-accent">{t("batchRelease")}</td>
      </tr>
    );
  }

  if (episode === null) return null;

  const isWatched = watched.has(episode);

  return (
    <tr>
      <td>{t("currentEpisode")}</td>
      <td>
        <button
          type="button"
          onClick={() => loaded && toggle(episode)}
          disabled={!loaded}
          aria-label={
            isWatched
              ? tEpisodes("markUnwatched", { ep: episode })
              : tEpisodes("markWatched", { ep: episode })
          }
          className={`inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
            isWatched ? "text-text-muted line-through" : "text-accent"
          }`}
        >
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-sm border ${
              isWatched
                ? "bg-accent border-accent text-white"
                : "border-border bg-bg-card-hover"
            }`}
          >
            {isWatched && (
              <svg
                viewBox="0 0 16 16"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          {t("episode", { ep: episode })}
        </button>
      </td>
    </tr>
  );
}
