import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { getAnimeBySlug, getAnimeData, DAY_LABELS } from "@/lib/data";
import { platforms, getPlatformSearchUrl } from "@/lib/platforms";
import { FORMAT_LABELS } from "@/lib/constants";
import { CurrentEpisode } from "@/components/current-episode";
import { AnimeTrailer } from "@/components/trailer-player";

export function generateStaticParams() {
  return getAnimeData().map((anime) => ({ slug: anime.slug }));
}

export default async function AnimeDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const anime = getAnimeBySlug(slug);

  if (!anime) notFound();

  const bannerSrc = anime.banner || anime.image;

  return (
    <div>
      <BackButton />

      <div className="rounded bg-bg-card border border-border overflow-hidden">
        {anime.trailer && anime.image ? (
          <AnimeTrailer
            trailerId={anime.trailer}
            title={anime.title}
            posterSrc={anime.image}
            bannerSrc={bannerSrc}
            footer={anime.synopsis ? <Synopsis text={anime.synopsis} /> : undefined}
          >
            <AnimeInfo anime={anime} />
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
                <AnimeInfo anime={anime} />
              </div>
              {anime.synopsis && <Synopsis text={anime.synopsis} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AnimeInfo({ anime }: { anime: ReturnType<typeof getAnimeBySlug> & {} }) {
  return (
    <div className="flex-1 min-w-0">
      <h1 className="text-base sm:text-xl font-bold">{anime.title}</h1>
      {anime.titleRomaji && (
        <p className="text-xs sm:text-sm text-text-secondary">{anime.titleRomaji}</p>
      )}
      {anime.titleEnglish && (
        <p className="text-xs text-text-muted">{anime.titleEnglish}</p>
      )}

      <table className="mt-3 sm:mt-4 text-sm">
        <tbody className="[&_td]:py-1 [&_td]:pr-4 sm:[&_td]:pr-6 [&_td:first-child]:text-text-muted [&_td:last-child]:font-bold">
          <tr>
            <td>曜日</td>
            <td>{anime.day} ({DAY_LABELS[anime.day]})</td>
          </tr>
          <CurrentEpisode anime={anime} />
          <tr>
            <td>配信時間</td>
            <td className="font-mono text-accent">{anime.time ?? "未定"}</td>
          </tr>
          <tr>
            <td>配信開始</td>
            <td>{anime.startDate}</td>
          </tr>
          <tr>
            <td>タイプ</td>
            <td>{anime.type}</td>
          </tr>
          {anime.format && (
            <tr>
              <td>形式</td>
              <td>{FORMAT_LABELS[anime.format]}</td>
            </tr>
          )}
          {anime.episodes && (
            <tr>
              <td>話数</td>
              <td>{anime.episodes}話</td>
            </tr>
          )}
          {anime.studio && (
            <tr>
              <td>制作会社</td>
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

      <div className="mt-4">
        <span className="text-xs text-text-muted">視聴可能</span>
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
                {p.name}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Synopsis({ text }: { text: string }) {
  return (
    <div className="mt-5 border-t border-border pt-4">
      <h2 className="mb-2 text-xs font-bold text-text-muted">あらすじ</h2>
      <p className="text-sm leading-relaxed text-text-secondary">{text}</p>
    </div>
  );
}
