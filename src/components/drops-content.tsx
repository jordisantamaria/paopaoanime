"use client";

import { useState, useTransition, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AnimeEntry } from "@/lib/types";
import { toggleDrop } from "@/actions/drops";

type DroppedItem = { slug: string; anime: AnimeEntry | null };

const UNDO_TIMEOUT = 5000;

export function DropsContent({ items }: { items: DroppedItem[] }) {
  const { data: session } = useSession();
  const [list, setList] = useState(items);
  const [pendingRemoval, setPendingRemoval] = useState<Set<string>>(new Set());
  const [timers, setTimers] = useState<Map<string, NodeJS.Timeout>>(new Map());
  const [, startTransition] = useTransition();

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
    return <p className="text-text-muted text-sm">ログインしてください。</p>;
  }

  if (list.length === 0) {
    return <p className="text-text-muted text-sm">切り捨てた作品はありません。</p>;
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
                Remove
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
                    画像なし
                  </div>
                )}
              </div>
              <div className={`mt-1.5 transition-opacity ${isPending ? "opacity-30" : ""}`}>
                <h3 className="line-clamp-2 text-sm font-bold text-text-primary group-hover:text-accent">
                  {anime?.title ?? slug}
                </h3>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
