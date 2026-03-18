"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimeEntry, DayOfWeek, PlatformId } from "@/lib/types";
import { DAYS, DAY_LABELS } from "@/lib/data";
import { platforms } from "@/lib/platforms";

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

      <div className="space-y-8">
        {daysToShow.map((day) => {
          const filtered = filterAnime(animeByDay[day]);
          if (filtered.length === 0) return null;

          return (
            <section key={day}>
              <h2 className="mb-3 text-base font-bold">
                {day}曜配信
                <span className="ml-2 text-xs font-normal text-text-muted">
                  {DAY_LABELS[day]}
                </span>
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filtered.map((anime) => (
                  <ScheduleCard key={anime.slug} anime={anime} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleCard({ anime }: { anime: AnimeEntry }) {
  const thumbnail = anime.banner || anime.image;

  return (
    <Link
      href={`/anime/${anime.slug}`}
      className="group"
    >
      <div className="relative overflow-hidden rounded border border-border bg-bg-card">
        {/* Platform chip */}
        <div className="absolute top-1.5 right-1.5 z-10">
          {anime.platforms.slice(0, 1).map((pid) => (
            <span
              key={pid}
              className="rounded-sm bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white"
            >
              {platforms[pid].name}
            </span>
          ))}
        </div>
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={anime.title}
            className={`w-full object-cover transition-transform group-hover:scale-105 ${
              anime.banner ? "aspect-video" : "aspect-video object-top"
            }`}
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-bg-card text-xs text-text-muted">
            画像なし
          </div>
        )}
      </div>
      <div className="mt-1.5">
        <p className="text-xs font-bold text-accent">
          {anime.time ?? "未定"} 予定
        </p>
        <h3 className="text-sm font-bold leading-snug text-text-primary group-hover:text-accent line-clamp-2">
          {anime.title}
        </h3>
      </div>
    </Link>
  );
}
