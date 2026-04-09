import { getTranslations } from "next-intl/server";
import { getAnimeData } from "@/lib/data";
import { getRecentEpisodes } from "@/lib/episodes";
import { HomeContent } from "@/components/home-content";
import { getDroppedSlugs } from "@/actions/drops";
import { getPlatformPreferences } from "@/actions/platform-preferences";

export const dynamic = "force-dynamic";

export default async function Home() {
  const t = await getTranslations("home");
  const animeList = await getAnimeData();
  const [droppedSlugs, platformPreferences] = await Promise.all([
    getDroppedSlugs(),
    getPlatformPreferences(),
  ]);
  const recentEpisodes = getRecentEpisodes(animeList, new Date(), undefined, platformPreferences);

  return (
    <div>
      <p className="mb-5 text-xs text-text-muted text-center">
        {t("tagline")}
      </p>
      <HomeContent
        animeList={animeList}
        droppedSlugs={droppedSlugs}
        initialEpisodes={recentEpisodes}
        platformPreferences={platformPreferences}
      />
    </div>
  );
}
