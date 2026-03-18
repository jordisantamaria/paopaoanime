# Roadmap — アニメスケジュール JP

## Pre-Launch (必須 para compartir)

### Branding
- [ ] Nombre definitivo del producto (animeschedule.jp? anisched? otro?)
- [ ] Logo (simple, reconocible, estilo anime)
- [ ] Favicon + OG image para compartir en redes
- [ ] Dominio custom

### Landing / About
- [ ] Página /about explicando el problema (fragmentación de plataformas en Japón) y la solución
- [ ] Sección de FAQ (¿es gratis? ¿cada cuánto se actualiza? ¿cómo se obtienen los datos?)

### SEO & Meta
- [ ] OG tags por página (título + imagen del anime en detalle)
- [ ] Sitemap.xml
- [ ] robots.txt
- [ ] Structured data (JSON-LD) para anime entries

### Polish
- [ ] Mobile responsive review (navbar, cards, filtros)
- [ ] 404 page personalizada
- [ ] Footer con links (About, GitHub, Twitter/X)
- [ ] Loading states

---

## Post-Launch v1.1 — Mi lista

- [ ] Guardar "mis plataformas" en localStorage (onboarding modal)
- [ ] Home filtra automáticamente por tus plataformas
- [ ] Guardar "mis animes" (favoritos) en localStorage
- [ ] Vista "Mi lista" — solo tus animes con sus horarios
- [ ] Notificación visual cuando hay episodio nuevo de tu lista

---

## v1.2 — Comparador de plataformas

- [ ] Página /platforms — tabla comparativa
- [ ] Precio mensual de cada plataforma
- [ ] Número de animes de temporada por plataforma
- [ ] "Simulador": selecciona los animes que quieres ver → te dice la combinación óptima de suscripciones

---

## v1.3 — Blog & Contenido

- [ ] Blog con MDX (Next.js built-in)
- [ ] Posts tipo "Mejores animes de Winter 2026" para SEO
- [ ] Guías por plataforma ("Guía completa de DMM TV para anime")
- [ ] Resumen semanal automático de episodios

---

## v2.0 — Auth & Premium

- [ ] Login (Auth.js — Google/Twitter)
- [ ] Migrar localStorage → base de datos (Neon/Drizzle)
- [ ] Sync favoritos entre dispositivos
- [ ] Premium features:
  - [ ] Google Calendar sync (evento por episodio)
  - [ ] Notificaciones push/email
  - [ ] Historial de episodios vistos

---

## v2.1 — Comunidad

- [ ] Ratings por episodio
- [ ] Comentarios por anime
- [ ] Rankings en tiempo real

---

## Futuro

- [ ] Spring 2026 season (abril) — primer test de cambio de temporada
- [ ] Automatizar extracción de datos con LLM al inicio de temporada
- [ ] Más plataformas (Hulu JP, Disney+, FOD, Lemino)
- [ ] Multi-idioma (EN/ES) para audiencia internacional

---

## Launch plan

### Dónde lanzar
1. **Product Hunt** — launch day con assets preparados
2. **Hacker News** (Show HN) — enfoque técnico: "Built an anime schedule aggregator for Japan with LLM-extracted data"
3. **Reddit** — r/anime, r/japan, r/animepiracy (ironically for legal alternative)
4. **Twitter/X** — anime community JP + dev community
5. **日本語コミュニティ** — はてなブックマーク, Qiita (tech angle), 5ch

### Assets necesarios para launch
- [ ] Screenshot/GIF del producto
- [ ] One-liner pitch en JP y EN
- [ ] GitHub README pulido (para open source angle)
