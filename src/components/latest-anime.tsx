import Image from "next/image";
import Link from "next/link";
import { AnimeEntry } from "@/lib/types";
import { FORMAT_LABELS } from "@/lib/constants";

const NON_WEEKLY_FORMATS = new Set(["MOVIE", "OVA", "SPECIAL", "MUSIC"]);

export function LatestAnime({ animeList }: { animeList: AnimeEntry[] }) {
  const now = new Date();

  const latest = animeList
    .filter((a) => {
      const start = new Date(a.startDate + "T00:00:00+09:00");
      return start <= now;
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, 20);

  if (latest.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {latest.map((anime) => {
        const isNonWeekly =
          anime.batchRelease ||
          (anime.format && NON_WEEKLY_FORMATS.has(anime.format));
        const formatLabel =
          anime.format && anime.format !== "TV" && anime.format !== "TV_SHORT"
            ? FORMAT_LABELS[anime.format]
            : null;

        return (
          <Link
            key={anime.slug}
            href={`/anime/${anime.slug}`}
            className="group"
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded border border-border">
              {anime.image ? (
                <Image
                  src={anime.image}
                  alt={anime.title}
                  fill
                  sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 200px"
                  className="object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-bg-card text-xs text-text-muted">
                  画像なし
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
                {anime.title}
              </h3>
              <p className="text-xs text-text-muted">
                {anime.startDate}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
