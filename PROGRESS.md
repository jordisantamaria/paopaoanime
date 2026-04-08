# Progreso del Proyecto

## Cron semanal: pipeline unificado de anime (2026-04-08)
> Un solo cron que automatiza todo el pipeline: detectar anime nuevos, extraer plataformas, sincronizar episodios, descargar imágenes, actualizar DB.

### Pipeline steps
- [x] **Step 1 — Fetch seasonal anime from AniList**
  - Query por temporada actual (TV, ONA, MOVIE, OVA, SPECIAL)
  - Detectar nuevos (no están en DB) e insertar con metadata completa
- [x] **Step 2 — Extract platform schedules via LLM**
  - Crawl animebb.jp (tabla cruzada anime × plataformas en una página)
  - Usar Anthropic Claude Haiku para extraer datos estructurados del HTML
  - Match con anime en DB por título normalizado
  - Upsert en anime_platform
- [x] **Step 3 — Sync episodes**
  - Consultar AniList nextAiringEpisode para cada anime en emisión
  - Actualizar episodeOffset y pausedUntil
- [x] **Step 4 — Upload images to Cloudflare R2**
  - Descargar covers y banners desde AniList CDN
  - Subir a Cloudflare R2, actualizar URLs en DB
- [x] Crear API route `src/app/api/cron/sync-anime/route.ts`
- [x] Configurar cron en vercel.json (reemplaza sync-episodes)
- [x] Crear `src/lib/r2.ts` (Cloudflare R2 client)
- [x] Mover @anthropic-ai/sdk a dependencies
- [x] Instalar @aws-sdk/client-s3
- [x] Actualizar README con setup de Cloudflare R2
- [ ] Actualizar docs/data-pipeline.md
- [ ] Añadir env vars en Vercel (R2 + ANTHROPIC_API_KEY)
- [ ] Test local del pipeline completo

### Fuentes de datos
- **AniList API** — metadata de anime, episodios, schedule
- **animebb.jp** — tabla cruzada anime × plataformas (una sola página por temporada)
- **Anthropic API (Haiku)** — extracción de datos estructurados del HTML
- **Cloudflare R2** — almacenamiento de imágenes

---

## Cron semanal: sync-episodes (2026-04-08) — Reemplazado por sync-anime
> Integrado en el pipeline unificado. El route `sync-episodes` queda como fallback.

- [x] Crear API route `src/app/api/cron/sync-episodes/route.ts`
- [x] Crear `vercel.json` con configuración del cron
- [x] Actualizar documentación (data-pipeline.md)
