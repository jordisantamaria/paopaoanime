import { getAnimeByDay, getNonWeeklyAnime } from "@/lib/data";
import { ScheduleGrid } from "@/components/schedule-grid";

export default async function Schedule() {
  const animeByDay = await getAnimeByDay();
  const nonWeeklyAnime = await getNonWeeklyAnime();

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">週間スケジュール</h1>
      <ScheduleGrid animeByDay={animeByDay} nonWeeklyAnime={nonWeeklyAnime} />
    </div>
  );
}
