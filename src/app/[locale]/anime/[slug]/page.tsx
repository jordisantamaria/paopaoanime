import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getDisplayTitle, getDisplaySynopsis } from "@/lib/localized";
import { BackButton } from "@/components/back-button";
import { getAnimeBySlug, getAnimeData } from "@/lib/data";
import { AnimeEntry } from "@/lib/types";
import { platforms, getPlatformSearchUrl } from "@/lib/platforms";
import { CurrentEpisode } from "@/components/current-episode";
import { AnimeTrailer } from "@/components/trailer-player";


export async function generateStaticParams() {
  const data = await getAnimeData();
  return data.map((anime) => ({ slug: anime.slug }));
}

export default async function AnimeDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const anime = await getAnimeBySlug(slug);

  if (!anime) notFound();

  const bannerSrc = anime.banner || anime.image;

  const [tAnime, tDays, tFormats, tPlatforms, locale] = await Promise.all([
    getTranslations("anime"),
    getTranslations("days"),
    getTranslations("formats"),
    getTranslations("platforms"),
    getLocale(),
  ]);

  const displaySynopsis = getDisplaySynopsis(anime, locale);

  return (
    <div>
      <BackButton />

      <div className="mt-3 rounded bg-bg-card border border-border overflow-hidden">
        {anime.trailer && anime.image ? (
          <AnimeTrailer
            trailerId={anime.trailer}
            title={anime.title}
            posterSrc={anime.image}
            bannerSrc={bannerSrc}
            footer={displaySynopsis ? <Synopsis text={displaySynopsis} label={tAnime("synopsis")} /> : undefined}
          >
            <AnimeInfo anime={anime} tAnime={tAnime} tDays={tDays} tFormats={tFormats} tPlatforms={tPlatforms} locale={locale} />
          </AnimeTrailer>
        ) : (
          <>
            {/* Mobile: banner */}
            {bannerSrc && (
              <div className="sm:hidden">
                <img
                  src={bannerSrc}
                  alt={anime.title}
                  className={`w-full object-cover ${anime.banner ? "aspect-video" : "aspect-video object-top"}`}
                />
              </div>
            )}
            <div className="p-4 sm:p-5">
              <div className="flex gap-4 sm:gap-5">
                {anime.image && (
                  <div className="hidden sm:block shrink-0">
                    <img src={anime.image} alt={anime.title} className="h-72 w-48 rounded object-cover" />
                  </div>
                )}
                <AnimeInfo anime={anime} tAnime={tAnime} tDays={tDays} tFormats={tFormats} tPlatforms={tPlatforms} locale={locale} />
              </div>
              {displaySynopsis && <Synopsis text={displaySynopsis} label={tAnime("synopsis")} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface AnimeInfoProps {
  anime: AnimeEntry;
  tAnime: Awaited<ReturnType<typeof getTranslations<"anime">>>;
  tDays: Awaited<ReturnType<typeof getTranslations<"days">>>;
  tFormats: Awaited<ReturnType<typeof getTranslations<"formats">>>;
  tPlatforms: Awaited<ReturnType<typeof getTranslations<"platforms">>>;
  locale: string;
}

function AnimeInfo({ anime, tAnime, tDays, tFormats, tPlatforms, locale }: AnimeInfoProps) {
  // EN: romaji as main title, Japanese + English as subtitles
  // JA: Japanese as main title, romaji + English as subtitles
  const mainTitle = locale === "en"
    ? (anime.titleRomaji || anime.title)
    : anime.title;
  const subtitles: string[] = [];
  if (locale === "en") {
    subtitles.push(anime.title); // Japanese subtitle
    if (anime.titleEnglish) subtitles.push(anime.titleEnglish);
  } else {
    if (anime.titleRomaji) subtitles.push(anime.titleRomaji);
    if (anime.titleEnglish) subtitles.push(anime.titleEnglish);
  }

  return (
    <div className="flex-1 min-w-0">
      <h1 className="text-base sm:text-xl font-bold">{mainTitle}</h1>
      {subtitles.length > 0 && (
        <p className="text-xs sm:text-sm text-text-muted">
          {subtitles.join("　")}
        </p>
      )}

      <table className="mt-3 sm:mt-4 text-sm">
        <tbody className="[&_td]:py-1 [&_td]:pr-4 sm:[&_td]:pr-6 [&_td:first-child]:text-text-muted [&_td:last-child]:font-bold">
          <tr>
            <td>{tAnime("day")}</td>
            <td>{anime.day} ({tDays(anime.day as "月" | "火" | "水" | "木" | "金" | "土" | "日")})</td>
          </tr>
          <CurrentEpisode anime={anime} />
          <tr>
            <td>{tAnime("deliveryTime")}</td>
            <td className="font-mono text-accent">{anime.time ?? tAnime("tbd")}</td>
          </tr>
          <tr>
            <td>{tAnime("startDate")}</td>
            <td>{anime.startDate}</td>
          </tr>
          <tr>
            <td>{tAnime("type")}</td>
            <td>{anime.type === "見放題" ? tAnime("subscription") : tAnime("rental")}</td>
          </tr>
          {anime.format && (
            <tr>
              <td>{tAnime("format")}</td>
              <td>{tFormats(anime.format as "TV" | "TV_SHORT" | "MOVIE" | "OVA" | "SPECIAL" | "ONA" | "MUSIC")}</td>
            </tr>
          )}
          {anime.episodes && (
            <tr>
              <td>{tAnime("episodeCount", { count: anime.episodes })}</td>
              <td>{anime.episodes}</td>
            </tr>
          )}
          {anime.studio && (
            <tr>
              <td>{tAnime("studio")}</td>
              <td>{anime.studio}</td>
            </tr>
          )}
        </tbody>
      </table>

      {anime.genres && anime.genres.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {anime.genres.map((g) => (
            <span
              key={g}
              className="rounded-sm bg-bg-card-hover border border-border px-2 py-0.5 text-xs text-text-secondary"
            >
              {g}
            </span>
          ))}
        </div>
      )}

      {anime.platforms.length > 0 && (
        <div className="mt-4">
          <span className="text-xs text-text-muted">{tAnime("available")}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {anime.platforms.map((pid) => {
              const p = platforms[pid];
              return (
                <a
                  key={pid}
                  href={getPlatformSearchUrl(pid, anime.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded border border-border bg-bg-card px-2.5 py-1 text-xs sm:text-sm sm:px-3 sm:py-1.5 font-bold transition-colors hover:text-accent hover:border-accent"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  {tPlatforms(pid as "dmmtv" | "netflix" | "abema" | "amazon" | "danime" | "disney" | "unext" | "theater")}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Synopsis({ text, label }: { text: string; label: string }) {
  return (
    <div className="mt-5 border-t border-border pt-4">
      <h2 className="mb-2 text-xs font-bold text-text-muted">{label}</h2>
      <p className="text-sm leading-relaxed text-text-secondary">{text}</p>
    </div>
  );
}
