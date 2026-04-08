import { getAnimeData } from "@/lib/data";
import { NavLinks } from "@/components/nav-links";
import { SearchBar } from "@/components/search-bar";
import { AuthButton } from "@/components/auth-button";
import Link from "next/link";

export async function Header() {
  const animeList = await getAnimeData();

  return (
    <header className="bg-nav text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <a href="/" className="flex items-center gap-1.5 text-lg font-bold tracking-tight shrink-0">
          <img src="/logo.png" alt="PaoPaoAnime" className="h-5 w-auto" />
          <span className="text-sm sm:text-lg">PaoPaoAnime</span>
        </a>
        <div className="hidden sm:flex items-center gap-5">
          <NavLinks />
          <SearchBar animeList={animeList} />
          <AuthButton />
        </div>
        <div className="flex sm:hidden items-center gap-3">
          <SearchBar animeList={animeList} />
          <Link href="/schedule" className="text-white/80 hover:text-white" title="週間スケジュール">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clipRule="evenodd" />
            </svg>
          </Link>
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
