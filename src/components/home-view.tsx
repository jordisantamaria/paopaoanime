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
      <div className="mb-5 flex gap-0 border-b-2 border-border">
        <button
          onClick={() => setTab("latest")}
          className={`px-4 py-2.5 text-sm font-bold transition-colors ${
            tab === "latest"
              ? "border-b-2 border-accent text-accent -mb-[2px]"
              : "text-text-muted hover:text-accent"
          }`}
        >
          最新エピソード
        </button>
        <button
          onClick={() => setTab("schedule")}
          className={`px-4 py-2.5 text-sm font-bold transition-colors ${
            tab === "schedule"
              ? "border-b-2 border-accent text-accent -mb-[2px]"
              : "text-text-muted hover:text-accent"
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
