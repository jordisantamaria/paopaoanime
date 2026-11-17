import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { ANIME_CACHE_TAG } from "@/lib/data";

/**
 * Invalida el cache de datos de anime bajo demanda.
 *
 * Manual fallback only. The weekly sync no longer calls this: it rebuilds the site
 * through a Deploy Hook, because the anime pages only exist for the slugs known at
 * build time (`dynamicParams = false`) and expiring the tag would not create pages
 * for anime the sync just added. This still refreshes the existing pages after an
 * out-of-band DB edit without waiting for a deploy.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // `{ expire: 0 }` expires the tag outright. The "max" profile used before is
  // stale-while-revalidate: each page kept serving its pre-sync copy to the first
  // visitor after a sync, and rarely visited pages stayed weeks behind the home
  // list (which is dynamic), so the platform filter and the detail page disagreed.
  // Now the first visit after a sync waits for a fresh render instead.
  revalidateTag(ANIME_CACHE_TAG, { expire: 0 });

  return NextResponse.json({ revalidated: ANIME_CACHE_TAG });
}
