import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { ANIME_CACHE_TAG } from "@/lib/data";

/**
 * Invalida el cache de datos de anime bajo demanda.
 *
 * Las páginas de anime son estáticas puras (ver `ANIME_CACHE_TTL` en `lib/data.ts`):
 * no caducan solas, así que sin esto se quedarían congeladas con los datos del último
 * build. El workflow `sync-anime.yml` llama aquí al terminar de escribir en la DB.
 *
 * Se dispara ~1 vez por semana, y regenera las ~628 páginas prerenderizadas.
 * Ese es todo el gasto de ISR writes del proyecto — antes eran ~15.000 al día.
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
