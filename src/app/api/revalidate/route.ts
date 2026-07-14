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

  // El segundo argumento (Next 16) es el perfil de caché del contenido que se
  // vuelve a escribir: "max" = sin caducidad por tiempo, coherente con que la
  // única vía de invalidación sea este endpoint.
  revalidateTag(ANIME_CACHE_TAG, "max");

  return NextResponse.json({ revalidated: ANIME_CACHE_TAG });
}
