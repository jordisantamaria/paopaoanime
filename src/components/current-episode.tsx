"use client";

import { useEffect, useState } from "react";
import { AnimeEntry } from "@/lib/types";
import { getRecentEpisodes } from "@/lib/episodes";

export function CurrentEpisode({ anime }: { anime: AnimeEntry }) {
  const [episode, setEpisode] = useState<number | null>(null);

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
        <td>配信形式</td>
        <td className="text-accent">全話一挙配信</td>
      </tr>
    );
  }

  if (episode === null) return null;

  return (
    <tr>
      <td>最新話</td>
      <td className="text-accent">第{episode}話</td>
    </tr>
  );
}
