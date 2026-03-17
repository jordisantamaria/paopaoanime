import { getAnimeData } from "@/lib/data";
import { RecentEpisodes } from "@/components/recent-episodes";

export default function Home() {
  const animeList = getAnimeData();

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">最新エピソード</h1>
      <RecentEpisodes animeList={animeList} />
    </div>
  );
}
