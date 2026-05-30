"use client";

import { useSyncExternalStore } from "react";
import { AnimeEntry } from "@/lib/types";
import { getRecentEpisodes } from "@/lib/episodes";
import { useTranslations } from "next-intl";

// No-op store: we never re-subscribe, we only need a different snapshot on
// server vs client.
const subscribe = () => () => {};

export function CurrentEpisode({ anime }: { anime: AnimeEntry }) {
  const t = useTranslations("anime");

  // The current episode depends on `new Date()`, which only makes sense on the
  // client (this page is statically generated, so a server value would be frozen
  // at build time). useSyncExternalStore renders null on the server and computes
  // the real value on the client — no hydration mismatch, no setState-in-effect.
  const episode = useSyncExternalStore(
    subscribe,
    () => {
      // Movies/OVAs/Specials and batch releases don't have a weekly "current" episode
      if (anime.format && !["TV", "TV_SHORT", "ONA"].includes(anime.format)) return null;
      if (anime.batchRelease) return null;
      const episodes = getRecentEpisodes([anime]);
      return episodes.length > 0 ? episodes[0].episode : null;
    },
    () => null
  );

  if (anime.batchRelease) {
    return (
      <tr>
        <td>{t("deliveryFormat")}</td>
        <td className="text-accent">{t("batchRelease")}</td>
      </tr>
    );
  }

  if (episode === null) return null;

  return (
    <tr>
      <td>{t("currentEpisode")}</td>
      <td className="text-accent">{t("episode", { ep: episode })}</td>
    </tr>
  );
}
