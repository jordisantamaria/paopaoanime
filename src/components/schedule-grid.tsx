"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { AnimeEntry, DayOfWeek, PlatformId } from "@/lib/types";
import { DAYS, PLATFORM_ORDER } from "@/lib/constants";
import { platforms } from "@/lib/platforms";
import { useTranslations, useLocale } from "next-intl";
import { getDisplayTitle } from "@/lib/localized";

type DayFilter = DayOfWeek | "all" | "他";

type Props = {
  animeByDay: Record<DayOfWeek, AnimeEntry[]>;
  nonWeeklyAnime?: AnimeEntry[];
};

export function ScheduleGrid({ animeByDay, nonWeeklyAnime = [] }: Props) {
  const [search, setSearch] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | "all">(
    "all"
  );
  const [selectedDay, setSelectedDay] = useState<DayFilter>("all");
  const tSchedule = useTranslations("schedule");
  const tDaysShort = useTranslations("daysShort");
  const tDays = useTranslations("days");
  const tFormats = useTranslations("formats");
  const tPlatforms = useTranslations("platforms");
  const locale = useLocale();

  const allPlatformIds = [
    ...new Set(
      [...Object.values(animeByDay).flat(), ...nonWeeklyAnime]
        .flatMap((a) => a.platforms)
    ),
  ];

  function normalize(s: string): string {
    return s.toLowerCase().replace(/[-ー～〜・:：]/g, "").replace(/\s+/g, "");
  }

  function filterAnime(list: AnimeEntry[]): AnimeEntry[] {
    return list.filter((anime) => {
      if (search) {
        const q = normalize(search);
        const matchTitle = normalize(anime.title).includes(q);
        const matchRomaji = anime.titleRomaji ? normalize(anime.titleRomaji).includes(q) : false;
        const matchEnglish = anime.titleEnglish ? normalize(anime.titleEnglish).includes(q) : false;
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
    selectedDay === "all" ? DAYS
    : selectedDay === "他" ? []
    : DAYS.filter((d) => d === selectedDay);

  const showNonWeekly = selectedDay === "all" || selectedDay === "他";
  const filteredNonWeekly = showNonWeekly ? filterAnime(nonWeeklyAnime) : [];

  const totalFiltered = daysToShow.reduce(
    (sum, day) => sum + filterAnime(animeByDay[day]).length,
    0
  ) + filteredNonWeekly.length;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder={tSchedule("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent"
        />

        <div className="relative">
          <select
            value={selectedPlatform}
            onChange={(e) =>
              setSelectedPlatform(e.target.value as PlatformId | "all")
            }
            className="w-full cursor-pointer appearance-none rounded border border-border bg-bg-card pl-3 pr-8 py-2 text-sm text-text-primary outline-none focus:border-accent"
          >
            <option value="all">{tSchedule("allPlatforms")}</option>
            {PLATFORM_ORDER.filter((pid) => allPlatformIds.includes(pid)).map((pid) => (
              <option key={pid} value={pid}>
                {tPlatforms(pid)}
              </option>
            ))}
          </select>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted">
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </div>

        <div className="flex gap-0.5">
          <button
            onClick={() => setSelectedDay("all")}
            className={`cursor-pointer rounded-sm px-2.5 py-1.5 text-xs font-bold transition-colors ${
              selectedDay === "all"
                ? "bg-accent text-white"
                : "bg-bg-card text-text-muted border border-border hover:text-accent"
            }`}
          >
            {tSchedule("all")}
          </button>
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`cursor-pointer rounded-sm px-2.5 py-1.5 text-xs font-bold transition-colors ${
                selectedDay === day
                  ? "bg-accent text-white"
                  : "bg-bg-card text-text-muted border border-border hover:text-accent"
              }`}
            >
              {tDaysShort(day)}
            </button>
          ))}
          <button
            onClick={() => setSelectedDay("他")}
            className={`cursor-pointer rounded-sm px-2.5 py-1.5 text-xs font-bold transition-colors ${
              selectedDay === "他"
                ? "bg-yellow-500 text-black"
                : "bg-bg-card text-text-muted border border-border hover:text-yellow-500"
            }`}
          >
            {tSchedule("other")}
          </button>
        </div>
      </div>

      <p className="mb-5 text-xs text-text-muted">
        {tSchedule("worksCount", { count: totalFiltered })}
      </p>

      <div className="space-y-10">
        {daysToShow.map((day) => {
          const filtered = filterAnime(animeByDay[day]);
          if (filtered.length === 0) return null;

          return (
            <section key={day}>
              <h2 className="mb-3 border-l-4 border-accent pl-3 text-base font-bold">
                {tSchedule("dayDelivery", { day: tDaysShort(day) })}
                <span className="ml-2 text-xs font-normal text-text-muted">
                  {tDays(day)}
                </span>
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filtered.map((anime) => (
                  <ScheduleCard key={anime.slug} anime={anime} tSchedule={tSchedule} tFormats={tFormats} locale={locale} />
                ))}
              </div>
            </section>
          );
        })}

        {filteredNonWeekly.length > 0 && (
          <section>
            <h2 className="mb-3 border-l-4 border-yellow-500 pl-3 text-base font-bold">
              {tSchedule("otherDelivery")}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filteredNonWeekly.map((anime) => (
                <ScheduleCard key={anime.slug} anime={anime} tSchedule={tSchedule} tFormats={tFormats} locale={locale} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

type ScheduleCardProps = {
  anime: AnimeEntry;
  tSchedule: ReturnType<typeof useTranslations<"schedule">>;
  tFormats: ReturnType<typeof useTranslations<"formats">>;
  locale: string;
};

function ScheduleCard({ anime, tSchedule, tFormats, locale }: ScheduleCardProps) {
  const thumbnail = anime.banner || anime.image;
  const isNonWeekly = anime.batchRelease || (anime.format && ["MOVIE", "OVA", "SPECIAL", "MUSIC"].includes(anime.format));
  const formatLabel = anime.batchRelease ? tSchedule("batch") : (anime.format ? tFormats(anime.format) : null);

  return (
    <Link
      href={`/anime/${anime.slug}`}
      className="group"
    >
      <div className="relative overflow-hidden rounded border border-border bg-bg-card">
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
            {tSchedule("noImage")}
          </div>
        )}
        {isNonWeekly && formatLabel && (
          <span className="absolute top-1.5 left-1.5 rounded bg-yellow-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
            {formatLabel}
          </span>
        )}
      </div>
      <div className="mt-1.5">
        <p className="text-xs font-bold text-accent">
          {isNonWeekly ? anime.startDate : (anime.time ?? tSchedule("tbd")) + " " + tSchedule("scheduled")}
        </p>
        <h3 className="text-sm font-bold leading-snug text-text-primary group-hover:text-accent line-clamp-2">
          {getDisplayTitle(anime, locale)}
        </h3>
      </div>
    </Link>
  );
}
