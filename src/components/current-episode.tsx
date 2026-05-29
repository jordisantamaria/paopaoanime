"use client";

import { useEffect, useState } from "react";
import { AnimeEntry } from "@/lib/types";
import { getRecentEpisodes } from "@/lib/episodes";
import { useTranslations } from "next-intl";

export function CurrentEpisode({ anime }: { anime: AnimeEntry }) {
  const [episode, setEpisode] = useState<number | null>(null);
  const t = useTranslations("anime");

  useEffect(() => {
    // Movies/OVAs/Specials don't have weekly episodes
    if (anime.format && !["TV", "TV_SHORT", "ONA"].includes(anime.format)) return;

    if (anime.batchRelease) return; // all episodes available from start

    const episodes = getRecentEpisodes([anime]);
    if (episodes.length > 0) {
      setEpisode(episodes[0].episode);
    }
  }, [anime]);

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
