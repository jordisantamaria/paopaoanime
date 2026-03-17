import Link from "next/link";
import { AnimeEntry } from "@/lib/types";
import { platforms } from "@/lib/platforms";

export function AnimeCard({ anime }: { anime: AnimeEntry }) {
  return (
    <Link
      href={`/anime/${anime.slug}`}
      className="group flex items-center gap-3 rounded bg-bg-card border border-border p-2.5 transition-colors hover:bg-bg-card-hover hover:border-border-hover"
    >
      {anime.image ? (
        <img
          src={anime.image}
          alt={anime.title}
          className="h-14 w-10 rounded-sm object-cover"
        />
      ) : (
        <div className="flex h-14 w-10 items-center justify-center rounded-sm bg-bg-card text-[10px] text-text-muted">
          N/A
        </div>
      )}

      <div className="flex-1 min-w-0">
        <h3 className="truncate text-sm font-bold text-text-primary group-hover:text-accent">
          {anime.title}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="font-mono font-bold text-accent">
            {anime.time ?? "未定"}
          </span>
          {anime.platforms.map((pid) => (
            <span key={pid} className="text-text-muted">
              {platforms[pid].name}
            </span>
          ))}
          {anime.type === "レンタル" && (
            <span className="text-orange-500 font-bold">レンタル</span>
          )}
        </div>
      </div>
    </Link>
  );
}
