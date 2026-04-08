import { Link } from "@/i18n/navigation";
import { AnimeEntry } from "@/lib/types";
import { getTranslations, getLocale } from "next-intl/server";
import { getDisplayTitle } from "@/lib/localized";

export async function AnimeCard({ anime }: { anime: AnimeEntry }) {
  const t = await getTranslations("anime");
  const tPlatforms = await getTranslations("platforms");
  const locale = await getLocale();

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
          {getDisplayTitle(anime, locale)}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="font-mono font-bold text-accent">
            {anime.time ?? t("tbd")}
          </span>
          {anime.platforms.map((pid) => (
            <span key={pid} className="text-text-muted">
              {tPlatforms(pid)}
            </span>
          ))}
          {anime.type === "レンタル" && (
            <span className="text-orange-500 font-bold">{t("rental")}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
