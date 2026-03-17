"use client";

import { useState } from "react";
import { AnimeEntry, DayOfWeek, PlatformId } from "@/lib/types";
import { DAYS, DAY_LABELS } from "@/lib/data";
import { platforms } from "@/lib/platforms";
import { AnimeCard } from "@/components/anime-card";

type Props = {
  animeByDay: Record<DayOfWeek, AnimeEntry[]>;
};

export function ScheduleGrid({ animeByDay }: Props) {
  const [search, setSearch] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | "all">(
    "all"
  );
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | "all">("all");

  const allPlatformIds = [
    ...new Set(
      Object.values(animeByDay)
        .flat()
        .flatMap((a) => a.platforms)
    ),
  ];

  function filterAnime(list: AnimeEntry[]): AnimeEntry[] {
    return list.filter((anime) => {
      if (search) {
        const q = search.toLowerCase();
        const matchTitle = anime.title.toLowerCase().includes(q);
        const matchRomaji = anime.titleRomaji?.toLowerCase().includes(q);
        const matchEnglish = anime.titleEnglish?.toLowerCase().includes(q);
        if (!matchTitle && !matchRomaji && !matchEnglish) return false;
      }
      if (
        selectedPlatform !== "all" &&
        !anime.platforms.includes(selectedPlatform)
      ) {
        return false;
      }
      return true;
    });
  }

  const daysToShow =
    selectedDay === "all" ? DAYS : DAYS.filter((d) => d === selectedDay);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="アニメを検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent"
        />

        <select
          value={selectedPlatform}
          onChange={(e) =>
            setSelectedPlatform(e.target.value as PlatformId | "all")
          }
          className="rounded border border-border bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        >
          <option value="all">全プラットフォーム</option>
          {allPlatformIds.map((pid) => (
            <option key={pid} value={pid}>
              {platforms[pid].name}
            </option>
          ))}
        </select>

        <div className="flex gap-0.5">
          <button
            onClick={() => setSelectedDay("all")}
            className={`rounded-sm px-2.5 py-1.5 text-xs font-bold transition-colors ${
              selectedDay === "all"
                ? "bg-accent text-white"
                : "bg-bg-card text-text-muted border border-border hover:text-accent"
            }`}
          >
            全部
          </button>
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`rounded-sm px-2.5 py-1.5 text-xs font-bold transition-colors ${
                selectedDay === day
                  ? "bg-accent text-white"
                  : "bg-bg-card text-text-muted border border-border hover:text-accent"
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {daysToShow.map((day) => {
          const filtered = filterAnime(animeByDay[day]);
          if (filtered.length === 0) return null;

          return (
            <section key={day}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
                <span className="bg-accent text-white px-2 py-0.5 rounded-sm text-xs">
                  {day}
                </span>
                <span className="text-text-muted text-xs font-normal">
                  {DAY_LABELS[day]}
                </span>
              </h2>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((anime) => (
                  <AnimeCard key={anime.slug} anime={anime} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
