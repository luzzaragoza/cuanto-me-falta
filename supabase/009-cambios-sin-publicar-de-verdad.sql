-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 009 · "Cambios sin publicar" deja de ser una adivinanza                  │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Cómo correrlo: Supabase → SQL Editor (Role: postgres) → pegar TODO → Run.
-- Idempotente. Requiere 004.
--
-- EL BUG (lo encontró Luz el 12-ago): los 4 planes de UADE aparecían con "Cambios sin
-- publicar" sin que nadie los hubiera tocado — alcanzaba con abrir la pantalla.
--
-- LA CAUSA: la etiqueta se calculaba comparando `plan.actualizado_at` contra
-- `plan.publicado_at`. Y la 004, al publicar la versión 1 de los planes ya cargados,
-- hizo `update plan set version_publicada = 1` SIN tocar `publicado_at` — pero ese
-- UPDATE disparó el trigger `plan_tocado`, que sí movió `actualizado_at`. Desde ese
-- momento los cuatro quedaron con `actualizado_at > publicado_at` de forma permanente.
--
-- Se podría emparejar los timestamps y listo. No: eso arregla ESTOS cuatro y deja viva la
-- causa. El problema de fondo es que la pregunta "¿hay cambios sin publicar?" se estaba
-- respondiendo por INFERENCIA (dos relojes) cuando tiene una respuesta exacta disponible:
-- comparar el borrador contra la foto publicada. Cualquier cosa que toque la fila del plan
-- —publicar, revertir, una migración futura— vuelve a romper la inferencia.
--
-- Por eso la vista calcula el dato de verdad. Se va también la tolerancia de 2 segundos
-- que había en el cliente, que era el síntoma de estar comparando relojes.

begin;

/**
 * Los planes como los ve la ADMINISTRACIÓN (incluye los no publicados), con la respuesta
 * exacta a "¿tiene cambios sin publicar?".
 *
 * `security_invoker`: respeta el RLS de quien pregunta, igual que `plan_publicado`. Un
 * admin ve los suyos; el superadmin, todos.
 */
create or replace view public.plan_editable
with (security_invoker = true) as
select
  p.id,
  p.universidad_id,
  p.codigo,
  p.anio,
  p.carrera,
  p.estado,
  p.version_publicada,
  p.actualizado_at,
  p.publicado_at,
  p.orden,
  case
    -- nunca publicado: todo lo cargado está sin publicar, por definición
    when p.version_publicada is null then true
    -- publicado: el borrador contra la foto, tal cual. `plan_json` es el MISMO armador
    -- que usó la foto al guardarse, así que no pueden diferir por formato.
    else public.plan_json(p.id) is distinct from (
      select v.data from public.plan_version v
       where v.plan_id = p.id and v.version = p.version_publicada
    )
  end as tiene_cambios
from public.plan p;

grant select on public.plan_editable to authenticated;

commit;

-- ── Verificación ──────────────────────────────────────────────────────────
-- Con nadie editando, los 4 planes de UADE tienen que decir `tiene_cambios = false`.
-- (Si alguno dice true, ese SÍ tiene un borrador distinto de lo publicado.)
select id, carrera, version_publicada, tiene_cambios
  from public.plan_editable
 order by universidad_id, orden;
