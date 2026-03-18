import { getAnimeData } from "@/lib/data";
import { NavLinks } from "@/components/nav-links";
import { SearchBar } from "@/components/search-bar";

export function Header() {
  const animeList = getAnimeData();

  return (
    <header className="bg-nav text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <a href="/" className="text-lg font-bold tracking-tight">
          PaoPaoAnime
        </a>
        <nav className="flex items-center gap-5">
          <NavLinks />
        </nav>
        <SearchBar animeList={animeList} />
      </div>
    </header>
  );
}
