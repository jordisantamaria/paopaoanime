import { notFound } from "next/navigation";
import Link from "next/link";
import { getAnimeBySlug, getAnimeData, DAY_LABELS } from "@/lib/data";
import { platforms, getPlatformSearchUrl } from "@/lib/platforms";

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

  return (
    <div>
      <Link
        href="/"
        className="mb-4 inline-block text-sm text-accent hover:text-accent-hover"
      >
        &larr; スケジュールに戻る
      </Link>

      <div className="rounded bg-bg-card border border-border p-5">
        <div className="flex flex-col gap-5 sm:flex-row">
          {anime.image ? (
            <img
              src={anime.image}
              alt={anime.title}
              className="h-72 w-48 rounded object-cover"
            />
          ) : (
            <div className="flex h-72 w-48 items-center justify-center rounded bg-bg-card text-text-muted">
              画像なし
            </div>
          )}

          <div className="flex-1">
            <h1 className="text-xl font-bold">{anime.title}</h1>
            {anime.titleRomaji && (
              <p className="text-sm text-text-secondary">{anime.titleRomaji}</p>
            )}
            {anime.titleEnglish && (
              <p className="text-xs text-text-muted">{anime.titleEnglish}</p>
            )}

            <table className="mt-4 text-sm">
              <tbody className="[&_td]:py-1 [&_td]:pr-6 [&_td:first-child]:text-text-muted [&_td:last-child]:font-bold">
                <tr>
                  <td>曜日</td>
                  <td>{anime.day} ({DAY_LABELS[anime.day]})</td>
                </tr>
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
              <div className="mt-1 flex flex-wrap gap-2">
                {anime.platforms.map((pid) => {
                  const p = platforms[pid];
                  return (
                    <a
                      key={pid}
                      href={getPlatformSearchUrl(pid, anime.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded border border-border bg-bg-card px-3 py-1.5 text-sm font-bold transition-colors hover:text-accent hover:border-accent"
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
        </div>

        {anime.synopsis && (
          <div className="mt-5 border-t border-border pt-4">
            <h2 className="mb-2 text-xs font-bold text-text-muted">あらすじ</h2>
            <p className="text-sm leading-relaxed text-text-secondary">
              {anime.synopsis}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
