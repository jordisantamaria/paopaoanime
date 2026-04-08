import { Link } from "@/i18n/navigation";
import { getAnimeData } from "@/lib/data";
import { Suspense } from "react";
import { SearchResults } from "@/components/search-results";

export default async function SearchPage() {
  const animeList = await getAnimeData();

  return (
    <div>
      <Suspense>
        <SearchResults animeList={animeList} />
      </Suspense>
    </div>
  );
}
