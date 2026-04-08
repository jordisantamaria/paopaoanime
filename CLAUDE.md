# Project Instructions

## Workflow: Plan con Checklist

Cuando el usuario pide implementar, arreglar o modificar algo:

1. **Crear `PROGRESS.md`** en la raíz del proyecto con el plan y checklist ANTES de escribir código
2. **Marcar cada item como completado** (`- [x]`) inmediatamente después de terminarlo
3. **Mantener tareas granulares** - cada item debe ser una acción concreta
4. Si el plan cambia durante la ejecución, actualizar `PROGRESS.md` para reflejarlo
5. **Al terminar la tarea**, vaciar `PROGRESS.md` (el historial queda en `CHANGELOG.md`)

> `PROGRESS.md` es temporal (en `.gitignore`). Solo refleja el trabajo en curso. El registro permanente es `CHANGELOG.md`.

## Changelog Automático

Cada vez que se completa una tarea o feature, **añadir una entrada en `CHANGELOG.md`** en la raíz del proyecto.

- Añadir la entrada al completar el trabajo (no antes)
- Las entradas más recientes van arriba
- Agrupar por fecha

### Formato de CHANGELOG.md

```markdown
# Changelog

## 2026-04-07

### feat: Nombre de la feature
- Descripción de lo que se hizo
- Detalles relevantes

### fix: Descripción del bug corregido
- Qué se arregló y por qué

## 2026-04-06

### chore: Migración de datos a Neon PostgreSQL
- Se migraron los datos de anime desde JSON a la base de datos
```

## Documentación del Proyecto

La documentación vive en `docs/`:

- `docs/ROADMAP.md` — Features planificadas y prioridades
- `docs/architecture.md` — Decisiones de arquitectura y por qué se tomaron
- `docs/database.md` — Estructura de tablas, relaciones y razones de diseño
- `docs/data-pipeline.md` — ETL pipeline: scripts, orden de ejecución, flujo de datos

Cuando se tomen decisiones de arquitectura relevantes, actualizar `docs/architecture.md`.
Cuando se modifique el esquema de DB, actualizar `docs/database.md`.
Cuando se añadan/modifiquen scripts de datos, actualizar `docs/data-pipeline.md`.
