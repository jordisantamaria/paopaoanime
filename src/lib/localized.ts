import { AnimeEntry } from "./types";

/** Returns the best display title for the given locale.
 *  EN: titleRomaji → title (Japanese fallback)
 *  JA: title (original Japanese) */
export function getDisplayTitle(anime: AnimeEntry, locale: string): string {
  if (locale === "en") {
    return anime.titleRomaji || anime.title;
  }
  return anime.title;
}

/** Returns the synopsis for the given locale.
 *  EN: synopsis (English from AniList) → synopsisJa fallback
 *  JA: synopsisJa → synopsis (English fallback) */
export function getDisplaySynopsis(anime: AnimeEntry, locale: string): string | undefined {
  if (locale === "en") {
    return anime.synopsis || anime.synopsisJa;
  }
  return anime.synopsisJa || anime.synopsis;
}
