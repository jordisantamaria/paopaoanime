import { getTranslations } from "next-intl/server";
import { getAnimeByDay, getNonWeeklyAnime } from "@/lib/data";
import { ScheduleGrid } from "@/components/schedule-grid";

export default async function Schedule() {
  const t = await getTranslations("schedule");
  const animeByDay = await getAnimeByDay();
  const nonWeeklyAnime = await getNonWeeklyAnime();

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{t("title")}</h1>
      <ScheduleGrid animeByDay={animeByDay} nonWeeklyAnime={nonWeeklyAnime} />
    </div>
  );
}
