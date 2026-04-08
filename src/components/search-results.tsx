"use client";

import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { AnimeEntry } from "@/lib/types";
import { useTranslations, useLocale } from "next-intl";
import { getDisplayTitle } from "@/lib/localized";

export function SearchResults({ animeList }: { animeList: AnimeEntry[] }) {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const t = useTranslations("search");
  const locale = useLocale();

  function normalize(s: string): string {
    return s.toLowerCase().replace(/[-ー～〜・:：]/g, "").replace(/\s+/g, "");
  }

  const results = q.length >= 1
    ? animeList.filter((a) => {
        const query = normalize(q);
        return (
          normalize(a.title).includes(query) ||
          (a.titleRomaji ? normalize(a.titleRomaji).includes(query) : false) ||
          (a.titleEnglish ? normalize(a.titleEnglish).includes(query) : false)
        );
      })
    : [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">
        {t("results", { query: q })}
        <span className="ml-2 text-sm font-normal text-text-muted">
          {t("count", { count: results.length })}
        </span>
      </h1>

      {results.length === 0 ? (
        <p className="text-text-muted">{t("noResults")}</p>
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
                    {t("noImage")}
                  </div>
                )}
              </div>
              <div className="mt-1.5">
                <h3 className="line-clamp-1 text-sm font-bold text-text-primary group-hover:text-accent">
                  {getDisplayTitle(a, locale)}
                </h3>
                {locale === "en" && (
                  <p className="text-xs text-text-muted truncate">{a.title}</p>
                )}
                {locale === "ja" && a.titleRomaji && (
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
