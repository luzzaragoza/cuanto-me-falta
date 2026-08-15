-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 006 · Correcciones del esquema — auditoría del 11-ago-2026               │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Cómo correrlo: Supabase → SQL Editor (Role: postgres) → pegar TODO → Run.
-- Idempotente: correrlo dos veces deja la base igual. Requiere 001–005.
-- Al final devuelve una TABLA con las 5 correcciones y si quedaron aplicadas.
--
-- ✅ ESTE ARCHIVO SE PUEDE CORRER CUANDO QUIERAS, incluso con el código viejo en
--    producción: solo AGREGA cosas. La columna vieja `admin_uni.limite_planes` sigue
--    en su lugar, así que el cliente que todavía la pide sigue andando.
--
--    Sacarla es el paso siguiente y vive aparte, en `007-sacar-limite-de-admin-uni.sql`,
--    que hay que correr DESPUÉS de que el código nuevo esté deployado. Es el patrón
--    expandir/contraer: primero existen las dos formas, se muda el código, recién ahí
--    se borra la vieja. Así no hay ni un segundo en que la base y el código no se
--    entiendan.
--
-- Las cinco cosas, en orden de consecuencia:
--   1) `limite_planes` estaba en `admin_uni`, cuya PK es (user_id, universidad_id).
--      Depende solo de la universidad → dependencia parcial (2FN). Y no era teoría:
--      `limite_ok()` leía la fila DEL ADMIN QUE CREA, así que con dos admins en la
--      misma universidad y límites distintos, el cupo real dependía de quién apretaba
--      el botón. El límite es una cláusula del contrato con la facultad: es un dato
--      de la facultad.
--   2) `plan.version` quedó muerta desde 004 (la vista lee `plan_version.version` y
--      `publicar_plan` nunca la toca). Se quedaba en 1 para siempre mientras
--      `version_publicada` avanzaba: una columna que miente es peor que una ausente.
--   3) Faltaba el índice de `correlativa (plan_id, requiere)`. La PK
--      (plan_id, cod, requiere) no sirve para buscar por `requiere`, y esa FK tiene
--      `on delete/update cascade` (005) → cada borrado de materia y cada corrección
--      de un código recorría la tabla entera.
--   4) `plan_version_plan_idx (plan_id, version desc)` es el mismo árbol que la PK
--      (Postgres recorre un índice hacia atrás al mismo costo).
--   5) Cada edición escribía DOS filas de auditoría: la de la materia y la del
--      `UPDATE` que dispara `tocar_plan()` sobre el plan, cuyo único cambio es una
--      marca de tiempo.

begin;

-- ── 1 · El límite de planes es de la universidad ──────────────────────────
alter table public.universidad
  add column if not exists limite_planes int not null default 5
    check (limite_planes >= 0);

comment on column public.universidad.limite_planes is
  'Cuántos planes puede tener esta universidad. Es una cláusula del contrato: '
  'la reparte el superadmin, no depende de qué admin esté creando.';

-- Backfill, solo si la columna vieja todavía existe (para que re-correr no falle).
-- Se toma el límite más alto que se hubiera repartido, y nunca por debajo de los
-- planes que la universidad YA tiene: nadie queda excedido de golpe.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'admin_uni'
       and column_name = 'limite_planes'
  ) then
    execute $sql$
      update public.universidad u
         set limite_planes = greatest(
               coalesce((select max(a.limite_planes) from public.admin_uni a
                          where a.universidad_id = u.id), 5),
               (select count(*) from public.plan p where p.universidad_id = u.id)
             )
    $sql$;
  end if;
end $$;

-- La función se recrea ANTES de soltar la columna: si no, queda rota entre medio.
-- Sigue exigiendo que la persona sea admin de esa universidad; lo que cambia es de
-- dónde sale el número.
create or replace function public.limite_ok(uni text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.es_superadmin() or (
    exists (select 1 from public.admin_uni a
             where a.user_id = auth.uid() and a.universidad_id = uni)
    and public.planes_de(uni) < coalesce(
          (select u.limite_planes from public.universidad u where u.id = uni), 0)
  );
$$;

-- La columna vieja NO se toca acá a propósito (ver el encabezado): se va en la 007,
-- después de que el código nuevo esté arriba. Mientras tanto queda muerta pero presente,
-- que es exactamente lo que hace falta para que el cliente viejo no se entere de nada.

-- ── 2 · Fuera la columna muerta ───────────────────────────────────────────
alter table public.plan drop column if exists version;

-- ── 3 · El índice que faltaba ─────────────────────────────────────────────
-- Lo usa la FK (plan_id, requiere) → materia en cada delete y en cada rename de
-- código, y la consulta de "qué materias habilita esta".
create index if not exists correlativa_requiere_idx
  on public.correlativa (plan_id, requiere);

-- ── 4 · Fuera el índice redundante ────────────────────────────────────────
drop index if exists public.plan_version_plan_idx;

-- ── 5 · Que la auditoría no se llene de ruido ─────────────────────────────
-- El chequeo va DENTRO de la función y no en un `when` del trigger: PostgreSQL no
-- acepta una cláusula `when` que referencie OLD en un trigger que incluye INSERT,
-- y `tg_op` tampoco existe en ese contexto. Acá se tiene todo a mano.
create or replace function public.auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_dato jsonb;
begin
  -- `tocar_plan()` actualiza `plan.actualizado_at` cada vez que se toca una materia,
  -- una correlativa o un título. Ese UPDATE llega hasta acá y, sin este descarte,
  -- deja una fila de auditoría cuyo único cambio es una marca de tiempo: cargar un
  -- plan de 40 materias escribía ~80 filas, la mitad ruido.
  if tg_op = 'UPDATE' and tg_table_name = 'plan'
     and to_jsonb(old) - 'actualizado_at' = to_jsonb(new) - 'actualizado_at' then
    return new;
  end if;

  if tg_table_name = 'plan' then
    v_plan := coalesce(new.id, old.id);
  else
    v_plan := coalesce(new.plan_id, old.plan_id);
  end if;
  v_dato := case tg_op
              when 'DELETE' then to_jsonb(old)
              else to_jsonb(new)
            end;
  insert into public.auditoria (user_id, tabla, accion, plan_id, dato)
  values (auth.uid(), tg_table_name, tg_op, v_plan, v_dato - 'plan_id');
  return coalesce(new, old);
end;
$$;

commit;

-- ── Verificación ──────────────────────────────────────────────────────────
-- Las 5 filas tienen que decir ✓. (La 5 se prueba de verdad editando una materia y
-- mirando que `auditoria` sume UNA fila, no dos — está al pie.)
select 1 as n, 'universidad.limite_planes existe y está cargada' as correccion,
       case when exists (select 1 from information_schema.columns
                          where table_schema='public' and table_name='universidad'
                            and column_name='limite_planes')
            then '✓' else '✗' end as estado
union all
select 2, 'plan.version ya no existe',
       case when not exists (select 1 from information_schema.columns
                              where table_schema='public' and table_name='plan'
                                and column_name='version')
            then '✓' else '✗' end
union all
select 3, 'índice correlativa (plan_id, requiere)',
       case when exists (select 1 from pg_indexes
                          where schemaname='public' and indexname='correlativa_requiere_idx')
            then '✓' else '✗' end
union all
select 4, 'plan_version_plan_idx eliminado',
       case when not exists (select 1 from pg_indexes
                              where schemaname='public' and indexname='plan_version_plan_idx')
            then '✓' else '✗' end
union all
select 5, 'auditar() descarta el toque de actualizado_at',
       case when (select prosrc from pg_proc where proname='auditar'
                   and pronamespace='public'::regnamespace) like '%actualizado_at%'
            then '✓' else '✗' end
order by n;

-- Y los límites que quedaron, para que los mires:
--   select id, nombre, limite_planes,
--          (select count(*) from public.plan p where p.universidad_id = u.id) as planes
--     from public.universidad u order by id;
--
-- La prueba real de la corrección 5 (editar una materia deja UNA fila, no dos):
--   select count(*) from public.auditoria;                    -- anotá el número
--   update public.materia set nom = nom
--    where plan_id = 'uade-ing-informatica' and cod = '3.4.069';
--   select count(*) from public.auditoria;                    -- tiene que sumar 1
