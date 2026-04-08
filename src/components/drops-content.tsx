"use client";

import { useState, useTransition, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { AnimeEntry } from "@/lib/types";
import { toggleDrop } from "@/actions/drops";
import { useTranslations, useLocale } from "next-intl";
import { getDisplayTitle } from "@/lib/localized";

type DroppedItem = { slug: string; anime: AnimeEntry | null };

const UNDO_TIMEOUT = 5000;

export function DropsContent({ items }: { items: DroppedItem[] }) {
  const { data: session } = useSession();
  const locale = useLocale();
  const [list, setList] = useState(items);
  const [pendingRemoval, setPendingRemoval] = useState<Set<string>>(new Set());
  const [timers, setTimers] = useState<Map<string, NodeJS.Timeout>>(new Map());
  const [, startTransition] = useTransition();
  const t = useTranslations("drops");

  const confirmRemoval = useCallback(
    (slug: string) => {
      setList((prev) => prev.filter((i) => i.slug !== slug));
      setPendingRemoval((prev) => {
        const next = new Set(prev);
        next.delete(slug);
        return next;
      });
      startTransition(async () => {
        await toggleDrop(slug);
      });
    },
    []
  );

  function handleRemove(slug: string) {
    setPendingRemoval((prev) => new Set(prev).add(slug));
    const timer = setTimeout(() => {
      confirmRemoval(slug);
      setTimers((prev) => {
        const next = new Map(prev);
        next.delete(slug);
        return next;
      });
    }, UNDO_TIMEOUT);
    setTimers((prev) => new Map(prev).set(slug, timer));
  }

  function handleUndo(slug: string) {
    const timer = timers.get(slug);
    if (timer) clearTimeout(timer);
    setTimers((prev) => {
      const next = new Map(prev);
      next.delete(slug);
      return next;
    });
    setPendingRemoval((prev) => {
      const next = new Set(prev);
      next.delete(slug);
      return next;
    });
  }

  if (!session?.user) {
    return <p className="text-text-muted text-sm">{t("loginRequired")}</p>;
  }

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="mb-4 h-16 w-16 text-text-muted"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.182 16.318A4.486 4.486 0 0 0 12.016 15a4.486 4.486 0 0 0-3.198 1.318M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z"
          />
        </svg>
        <p className="text-sm font-bold text-text-primary">{t("empty")}</p>
        <p className="mt-1 text-xs text-text-muted">
          {t("emptyDescription")}
        </p>
        <Link
          href="/"
          className="mt-4 rounded bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent/90 transition-colors"
        >
          {t("backToHome")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {list.map(({ slug, anime }) => {
        const isPending = pendingRemoval.has(slug);

        return (
          <div key={slug} className="relative group">
            {/* Remove / Undo button above the card */}
            {isPending ? (
              <button
                onClick={() => handleUndo(slug)}
                className="mb-1.5 flex w-full items-center justify-center gap-1.5 rounded bg-bg-card border border-border px-2 py-1 text-xs font-bold text-text-secondary hover:text-accent hover:border-accent transition-colors cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.06.025z"
                    clipRule="evenodd"
                  />
                </svg>
                Undo
              </button>
            ) : (
              <button
                onClick={() => handleRemove(slug)}
                className="mb-1.5 flex w-full items-center justify-center gap-1.5 rounded bg-red-500/90 px-2 py-1 text-xs font-bold text-white hover:bg-red-600 transition-colors cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
                {t("remove")}
              </button>
            )}

            {/* Card */}
            <Link href={`/anime/${slug}`} className={isPending ? "pointer-events-none" : ""}>
              <div
                className={`relative overflow-hidden rounded border border-border transition-opacity ${
                  isPending ? "opacity-30" : ""
                }`}
              >
                {anime?.image ? (
                  <img
                    src={anime.image}
                    alt={anime?.title ?? slug}
                    className="aspect-[3/4] w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex aspect-[3/4] w-full items-center justify-center bg-bg-card text-xs text-text-muted">
                    {t("noImage")}
                  </div>
                )}
              </div>
              <div className={`mt-1.5 transition-opacity ${isPending ? "opacity-30" : ""}`}>
                <h3 className="line-clamp-2 text-sm font-bold text-text-primary group-hover:text-accent">
                  {anime ? getDisplayTitle(anime, locale) : slug}
                </h3>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
