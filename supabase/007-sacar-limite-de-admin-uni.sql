-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 007 · El paso "contraer": sacar la columna vieja                         │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Cómo correrlo: Supabase → SQL Editor (Role: postgres) → pegar TODO → Run.
--
-- ⚠️ CUÁNDO: DESPUÉS de que el código nuevo esté deployado en producción (o sea,
--    después de mergear a main y que termine el deploy de GitHub Actions).
--    Antes de eso NO: el cliente viejo todavía pide `limite_planes` en el select de
--    `admin_uni`, y sacarla le rompe la pantalla `#admin`.
--
--    Cómo saber que ya se puede: entrá a https://cuantomefalta.app/#admin y fijate que
--    el cupo de cada universidad se vea bien ("4 de 6 · podés crear 2 más"). Si eso
--    anda, el código nuevo está arriba leyendo el límite de `universidad` y esta
--    columna ya no la mira nadie.
--
-- POR QUÉ EN DOS PASOS (expandir → contraer): la 006 agregó `universidad.limite_planes`
-- y dejó la vieja en su lugar, así que durante la transición conviven las dos formas y
-- ningún cliente —viejo o nuevo— se queda sin la columna que pide. Recién cuando no
-- queda nadie usando la vieja, se borra. Es la diferencia entre migrar y cortar el
-- cable con la luz prendida.
--
-- Si te arrepentís antes de correr esto: no hace falta hacer nada. La columna vieja
-- quedó muerta pero inofensiva; el único costo es tenerla ahí.

begin;

alter table public.admin_uni drop column if exists limite_planes;

commit;

-- ── Verificación ──────────────────────────────────────────────────────────
select
  case when not exists (select 1 from information_schema.columns
                         where table_schema='public' and table_name='admin_uni'
                           and column_name='limite_planes')
        and exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='universidad'
                       and column_name='limite_planes')
       then '✓ el límite vive solo en universidad'
       else '✗ revisá: falta correr la 006, o la columna vieja sigue ahí'
  end as estado;

-- Y los cupos que quedaron:
--   select u.id, u.nombre, u.limite_planes,
--          (select count(*) from public.plan p where p.universidad_id = u.id) as planes
--     from public.universidad u order by u.id;
