# Changelog

## 2026-04-08

### feat: Pipeline unificado de anime (cron semanal)
- Nuevo cron `/api/cron/sync-anime` que automatiza todo el pipeline de datos
- Step 1: Detecta anime nuevos de la temporada desde AniList y los inserta en DB
- Step 2: Extrae datos de plataformas de animebb.jp con Claude Haiku (LLM)
- Step 3: Sincroniza episodeOffset y pausedUntil desde AniList
- Step 4: Sube imágenes (covers + banners) a Cloudflare R2
- Soporte para `?step=1,2,3,4` para ejecutar steps individuales
- Cron configurado: domingos 21:00 UTC (lunes 06:00 JST)

### chore: Cloudflare R2 como CDN de imágenes
- Migración de imágenes locales (`public/img/`) a Cloudflare R2
- Cliente R2 con dedup (no re-sube imágenes que ya existen)

### docs: Setup actualizado
- README con instrucciones de Cloudflare R2, CRON_SECRET, ANTHROPIC_API_KEY
- Flujo de `vercel env pull` documentado
- data-pipeline.md actualizado con pipeline automatizado
