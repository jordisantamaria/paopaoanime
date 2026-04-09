"use client";

import { useState, useMemo, useTransition } from "react";
import { useSession } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { AnimeEntry, PlatformId } from "@/lib/types";
import { RecentEpisode, getRecentEpisodes } from "@/lib/episodes";
import { PlatformFilter } from "@/components/platform-filter";
import { toggleDrop } from "@/actions/drops";
import { useTranslations, useLocale } from "next-intl";
import { getDisplayTitle } from "@/lib/localized";

const NON_WEEKLY_FORMATS = new Set(["MOVIE", "OVA", "SPECIAL", "MUSIC"]);

/** Returns the best (lowest) rank among an anime's platforms in the user's preference list.
 *  Platforms not in preferences get Infinity so they sort last. */
function bestPlatformRank(animePlatforms: string[], preferences: PlatformId[]): number {
  let best = Infinity;
  for (const p of animePlatforms) {
    const idx = preferences.indexOf(p as PlatformId);
    if (idx !== -1 && idx < best) best = idx;
  }
  return best;
}

type HomeContentProps = {
  animeList: AnimeEntry[];
  droppedSlugs?: string[];
  initialEpisodes?: RecentEpisode[];
  platformPreferences?: PlatformId[];
};

export function HomeContent({ animeList, droppedSlugs: initialDropped = [], initialEpisodes = [], platformPreferences = [] }: HomeContentProps) {
  const { data: session } = useSession();
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([]);
  const [droppedSlugs, setDroppedSlugs] = useState<Set<string>>(new Set(initialDropped));
  const [pending, startTransition] = useTransition();
  const t = useTranslations("home");
  const tFormats = useTranslations("formats");
  const locale = useLocale();

  // Recalculate episodes when platform filter changes
  const episodes = useMemo(() => {
    if (selectedPlatforms.length === 0) return initialEpisodes;
    return getRecentEpisodes(animeList, new Date(), selectedPlatforms);
  }, [animeList, selectedPlatforms, initialEpisodes]);

  const allPlatforms = [
    ...new Set(animeList.flatMap((a) => a.platforms)),
  ] as PlatformId[];

  function handleDrop(slug: string) {
    setDroppedSlugs((prev) => {
      const next = new Set(prev);
      next.add(slug);
      return next;
    });
    startTransition(async () => {
      await toggleDrop(slug);
    });
  }

  // Recent episodes - exclude theater-only anime (but include anime with no platforms yet)
  const isTheaterOnly = (anime: AnimeEntry) =>
    anime.platforms.length > 0 && anime.platforms.every((p) => p === "theater");

  const filteredEpisodes = episodes.filter(
    (ep) => !isTheaterOnly(ep.anime) && !droppedSlugs.has(ep.anime.slug)
  );
  const seen = new Set<string>();
  const deduplicatedEpisodes = filteredEpisodes
    .filter((ep) => {
      if (seen.has(ep.anime.slug)) return false;
      seen.add(ep.anime.slug);
      return true;
    });

  // Episodes are already sorted by airedAt from the server
  const sortedEpisodes = deduplicatedEpisodes.slice(0, 20);

  // Latest anime — `now` is intentionally re-created each render for freshness
  const latestAnime = useMemo(() => {
    const now = new Date();
    const filtered = animeList
      .filter((a) => {
        const start = new Date(a.startDate + "T00:00:00+09:00");
        if (start > now || droppedSlugs.has(a.slug)) return false;
        if (selectedPlatforms.length === 0) return true;
        return a.platforms.some((p) => selectedPlatforms.includes(p as PlatformId));
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate));

    // Apply platform preference sorting when no filter is active
    if (platformPreferences.length > 0 && selectedPlatforms.length === 0) {
      filtered.sort((a, b) => {
        const aRank = bestPlatformRank(a.platforms, platformPreferences);
        const bRank = bestPlatformRank(b.platforms, platformPreferences);
        if (aRank !== bRank) return aRank - bRank;
        return b.startDate.localeCompare(a.startDate);
      });
    }

    return filtered.slice(0, 20);
  }, [animeList, droppedSlugs, selectedPlatforms, platformPreferences]);

  function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return t("daysAgo", { count: diffDays });
    if (diffHours > 0) return t("hoursAgo", { count: diffHours });
    return t("streaming");
  }

  return (
    <div>
      <div className="mb-4">
        <PlatformFilter
          available={allPlatforms}
          selected={selectedPlatforms}
          onChange={setSelectedPlatforms}
          preferences={platformPreferences}
        />
      </div>

      <h2 className="mb-4 text-xl font-bold">{t("latestEpisodes")}</h2>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {sortedEpisodes.map((ep) => (
          <div key={ep.anime.slug} className="relative group">
            <Link
              href={`/anime/${ep.anime.slug}`}
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
                    {t("noImage")}
                  </div>
                )}
                <span className="absolute top-1.5 left-1.5 rounded-sm bg-accent px-1 py-px text-xs font-bold text-white">
                  {ep.anime.batchRelease ? t("batchEpisode", { ep: ep.episode }) : t("episode", { ep: ep.episode })}
                </span>
              </div>
              <div className="mt-1.5">
                <h3 className="line-clamp-1 text-sm font-bold text-text-primary group-hover:text-accent">
                  {getDisplayTitle(ep.anime, locale)}
                </h3>
                <p className="text-xs text-text-muted">
                  {formatRelativeTime(ep.airedAt)}
                </p>
              </div>
            </Link>
            {session?.user && (
              <button
                onClick={() => handleDrop(ep.anime.slug)}
                className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 cursor-pointer"
                title={t("hideTitle")}
              >
                &times;
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-12 mb-4 border-t border-border pt-8">
        <h2 className="text-xl font-bold">{t("latestAnime")}</h2>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {latestAnime.map((anime) => {
          const formatLabel =
            anime.format && anime.format !== "TV" && anime.format !== "TV_SHORT"
              ? tFormats(anime.format)
              : null;

          return (
            <Link
              key={anime.slug}
              href={`/anime/${anime.slug}`}
              className="group"
            >
              <div className="relative overflow-hidden rounded border border-border">
                {anime.image ? (
                  <img
                    src={anime.image}
                    alt={anime.title}
                    className="aspect-[3/4] w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex aspect-[3/4] w-full items-center justify-center bg-bg-card text-xs text-text-muted">
                    {t("noImage")}
                  </div>
                )}
                {formatLabel && (
                  <span className="absolute top-1.5 left-1.5 rounded bg-yellow-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
                    {formatLabel}
                  </span>
                )}
              </div>
              <div className="mt-1.5">
                <h3 className="line-clamp-1 text-sm font-bold text-text-primary group-hover:text-accent">
                  {getDisplayTitle(anime, locale)}
                </h3>
                <p className="text-xs text-text-muted">{anime.startDate}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
