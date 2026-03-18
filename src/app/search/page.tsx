import Link from "next/link";
import { getAnimeData } from "@/lib/data";
import { Suspense } from "react";
import { SearchResults } from "@/components/search-results";

export default function SearchPage() {
  const animeList = getAnimeData();

  return (
    <div>
      <Suspense>
        <SearchResults animeList={animeList} />
      </Suspense>
    </div>
  );
}
