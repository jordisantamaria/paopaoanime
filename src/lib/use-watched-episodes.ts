"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  getWatchedEpisodes,
  setWatchedEpisode as setWatchedEpisodeAction,
} from "@/actions/watched";

const STORAGE_PREFIX = "pao:watched:";

function storageKey(slug: string): string {
  return `${STORAGE_PREFIX}${slug}`;
}

function readLocal(slug: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n: unknown): n is number => typeof n === "number");
  } catch {
    return [];
  }
}

function writeLocal(slug: string, episodes: number[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(slug), JSON.stringify(episodes));
  } catch {
    // Ignore quota errors.
  }
}

export interface UseWatchedEpisodesResult {
  watched: Set<number>;
  loaded: boolean;
  isAuthenticated: boolean;
  setWatched: (episode: number, value: boolean) => Promise<void>;
  toggle: (episode: number) => Promise<void>;
}

export function useWatchedEpisodes(slug: string): UseWatchedEpisodesResult {
  const { data: session, status } = useSession();
  const isAuthenticated = !!session?.user;

  const [watched, setWatchedState] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;

    async function load() {
      if (isAuthenticated) {
        try {
          const episodes = await getWatchedEpisodes(slug);
          if (cancelled) return;
          setWatchedState(new Set(episodes));
        } catch {
          if (cancelled) return;
          setWatchedState(new Set());
        }
      } else {
        setWatchedState(new Set(readLocal(slug)));
      }
      if (!cancelled) setLoaded(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, status, isAuthenticated]);

  const setWatched = useCallback(
    async (episode: number, value: boolean) => {
      // Optimistic UI update.
      setWatchedState((prev) => {
        const next = new Set(prev);
        if (value) next.add(episode);
        else next.delete(episode);

        if (!isAuthenticated) {
          writeLocal(slug, Array.from(next).sort((a, b) => a - b));
        }
        return next;
      });

      if (isAuthenticated) {
        try {
          await setWatchedEpisodeAction(slug, episode, value);
        } catch {
          // Revert on failure.
          setWatchedState((prev) => {
            const next = new Set(prev);
            if (value) next.delete(episode);
            else next.add(episode);
            return next;
          });
        }
      }
    },
    [slug, isAuthenticated],
  );

  const toggle = useCallback(
    async (episode: number) => {
      const isCurrentlyWatched = watched.has(episode);
      await setWatched(episode, !isCurrentlyWatched);
    },
    [watched, setWatched],
  );

  return {
    watched,
    loaded,
    isAuthenticated,
    setWatched,
    toggle,
  };
}
