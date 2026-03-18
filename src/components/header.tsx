import { getAnimeData } from "@/lib/data";
import { NavLinks } from "@/components/nav-links";
import { SearchBar } from "@/components/search-bar";
import { MobileMenu } from "@/components/mobile-menu";

export function Header() {
  const animeList = getAnimeData();

  return (
    <header className="bg-nav text-white relative">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <a href="/" className="text-lg font-bold tracking-tight">
          PaoPaoAnime
        </a>
        <div className="hidden sm:flex items-center gap-5">
          <NavLinks />
          <SearchBar animeList={animeList} />
        </div>
        <div className="flex sm:hidden items-center gap-3">
          <SearchBar animeList={animeList} />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
