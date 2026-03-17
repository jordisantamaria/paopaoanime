"use client";

import { useState } from "react";
import { AnimeEntry, DayOfWeek } from "@/lib/types";
import { ScheduleGrid } from "@/components/schedule-grid";
import { RecentEpisodes } from "@/components/recent-episodes";

type Tab = "latest" | "schedule";

type Props = {
  animeByDay: Record<DayOfWeek, AnimeEntry[]>;
  animeList: AnimeEntry[];
};

export function HomeView({ animeByDay, animeList }: Props) {
  const [tab, setTab] = useState<Tab>("latest");

  return (
    <div>
      <div className="mb-5 flex gap-1">
        <button
          onClick={() => setTab("latest")}
          className={`rounded-t px-5 py-2 text-sm font-bold transition-colors ${
            tab === "latest"
              ? "bg-accent text-white"
              : "bg-bg-card text-text-secondary border border-border border-b-0 hover:text-accent"
          }`}
        >
          最新エピソード
        </button>
        <button
          onClick={() => setTab("schedule")}
          className={`rounded-t px-5 py-2 text-sm font-bold transition-colors ${
            tab === "schedule"
              ? "bg-accent text-white"
              : "bg-bg-card text-text-secondary border border-border border-b-0 hover:text-accent"
          }`}
        >
          週間スケジュール
        </button>
      </div>

      {tab === "latest" && <RecentEpisodes animeList={animeList} />}
      {tab === "schedule" && <ScheduleGrid animeByDay={animeByDay} />}
    </div>
  );
}
