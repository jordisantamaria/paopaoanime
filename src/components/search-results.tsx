"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimeEntry } from "@/lib/types";

export function SearchResults({ animeList }: { animeList: AnimeEntry[] }) {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const results = q.length >= 1
    ? animeList.filter((a) => {
        const query = q.toLowerCase();
        return (
          a.title.toLowerCase().includes(query) ||
          a.titleRomaji?.toLowerCase().includes(query) ||
          a.titleEnglish?.toLowerCase().includes(query)
        );
      })
    : [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">
        「{q}」の検索結果
        <span className="ml-2 text-sm font-normal text-text-muted">
          {results.length}件
        </span>
      </h1>

      {results.length === 0 ? (
        <p className="text-text-muted">該当するアニメが見つかりませんでした。</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {results.map((a) => (
            <Link key={a.slug} href={`/anime/${a.slug}`} className="group">
              <div className="overflow-hidden rounded border border-border">
                {a.image ? (
                  <img
                    src={a.image}
                    alt={a.title}
                    className="aspect-[3/4] w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex aspect-[3/4] w-full items-center justify-center bg-bg-card text-xs text-text-muted">
                    画像なし
                  </div>
                )}
              </div>
              <div className="mt-1.5">
                <h3 className="line-clamp-1 text-sm font-bold text-text-primary group-hover:text-accent">
                  {a.title}
                </h3>
                {a.titleRomaji && (
                  <p className="text-xs text-text-muted truncate">{a.titleRomaji}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
