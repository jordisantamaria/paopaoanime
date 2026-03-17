import { getAnimeByDay } from "@/lib/data";
import { ScheduleGrid } from "@/components/schedule-grid";

export default function Schedule() {
  const animeByDay = getAnimeByDay();

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">週間スケジュール</h1>
      <ScheduleGrid animeByDay={animeByDay} />
    </div>
  );
}
