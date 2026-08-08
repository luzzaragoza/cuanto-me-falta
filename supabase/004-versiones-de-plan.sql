-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 004 · Versiones de plan — el admin edita sin que el alumno se entere,    │
-- │       y publicar es una sola operación.  (Sprint 1, paso 3 — ago 2026)   │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Cómo correrlo: Supabase → SQL Editor (Role: postgres) → pegar TODO → Run.
-- Requiere 001, el seed y 002. Idempotente. Al final devuelve una TABLA con el
-- estado de los 4 planes: si dice `version_publicada = 1` en todos, salió bien.
--
-- EL PROBLEMA (decisión de producto de Luz, 8-ago): mientras el admin corrige un
-- plan, los alumnos NO tienen que perderlo ni ver cambios a medio hacer. Y cuando
-- se publica, quien tenga la app abierta recibe un aviso y decide él cuándo
-- actualizar. Nada cambia debajo del mouse de nadie.
--
-- LA FORMA: las filas relacionales (`materia`, `correlativa`, `titulo`) pasan a ser
-- el BORRADOR — cómodas para editar y validar. Al publicar se guarda una FOTO en
-- `plan_version` (el `PlanDef` completo en JSON) y `plan.version_publicada` apunta a
-- ella. Los alumnos leen la foto, nunca las filas vivas.
--
--     admin edita filas ─────────────┐
--                                    │  publicar_plan()
--     plan_version  v1   v2   v3  ◄──┘   (una foto nueva)
--                              ▲
--     plan.version_publicada ──┘  ← lo único que ve el alumno
--
-- Tres cosas salen gratis:
--   · publicar es UN update → no existe el estado "a medio publicar";
--   · deshacer es apuntar a la foto anterior → instantáneo, sin restaurar nada;
--   · la vista `plan_publicado` conserva las MISMAS columnas → el cliente no cambia.
--
-- Alternativa descartada: versionar cada tabla con una columna `version` y duplicar
-- filas. Multiplica las filas por versión, complica cada consulta y cada FK, y para
-- volver atrás hay que reconstruir a mano lo que la foto ya tiene resuelto.

-- ── El armador del JSON ───────────────────────────────────────────────────
-- Es la expresión que hasta ahora vivía dentro de la vista. Sale a una función para
-- que la foto y la vista NO puedan divergir: las dos usan esto.
-- `jsonb_strip_nulls` + los `case when`: `opt`/`especial`/`hastaCuatri` viajan solo
-- cuando corresponde, igual que en los módulos TS del bundle.
create or replace function public.plan_json(p text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', pl.id,
    'universidad', pl.universidad_id,
    'codigo', pl.codigo,
    'anio', pl.anio,
    'carrera', pl.carrera,
    'materias', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'cod', m.cod, 'nom', m.nom, 'anio', m.anio, 'cuatri', m.cuatri,
               'opt',      case when m.opt      then true end,
               'especial', case when m.especial then true end))
                       order by m.anio, m.cuatri, m.orden, m.cod)
        from public.materia m where m.plan_id = pl.id), '[]'::jsonb),
    'correlativas', coalesce((
      select jsonb_agg(jsonb_build_object('cod', c.cod, 'requiere', c.requiere)
                       order by c.orden, c.cod, c.requiere)
        from public.correlativa c where c.plan_id = pl.id), '[]'::jsonb),
    'titulos', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'nombre', t.nombre, 'hastaAnio', t.hasta_anio, 'hastaCuatri', t.hasta_cuatri))
                       order by t.orden, t.id)
        from public.titulo t where t.plan_id = pl.id), '[]'::jsonb)
  ))
  from public.plan pl where pl.id = p;
$$;

-- ── Las fotos ─────────────────────────────────────────────────────────────
create table if not exists public.plan_version (
  plan_id        text not null references public.plan(id) on delete cascade,
  version        int  not null check (version >= 1),
  data           jsonb not null,
  nota           text,                    -- "qué cambió", opcional, lo escribe el admin
  publicado_at   timestamptz not null default now(),
  publicado_por  uuid references auth.users(id) on delete set null,
  primary key (plan_id, version)
);

create index if not exists plan_version_plan_idx on public.plan_version (plan_id, version desc);

-- Cuál foto ve el alumno. Si es NULL, el plan no se ve (nunca se publicó).
alter table public.plan add column if not exists version_publicada int;

-- ── Publicar ──────────────────────────────────────────────────────────────
-- `security definer` porque escribe la foto (no hay política de escritura sobre
-- `plan_version`: la única puerta es esta función). Por eso mismo chequea el permiso
-- explícitamente en la primera línea.
--
-- Las validaciones de acá son las ESTRUCTURALES, las que se pueden afirmar en SQL.
-- El resto de las reglas (nombres, huecos, avisos) las hace cumplir `validarPlan()`
-- en el editor, y el arranque de la app descarta igual cualquier plan roto.
-- Dato lindo: exigir que toda correlativa apunte a un cuatrimestre ANTERIOR hace
-- imposible un ciclo, por construcción — no hace falta buscarlos.
create or replace function public.publicar_plan(p text, nota text default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uni  text;
  v_next int;
  v_n    int;
  v_mal  text;
begin
  select universidad_id into v_uni from public.plan where id = p;
  if v_uni is null then
    raise exception 'No existe el plan %', p;
  end if;
  if not public.permiso_uni(v_uni, 'editar') then
    raise exception 'No tenés permiso para publicar planes de %', v_uni;
  end if;

  -- 1) tiene materias
  select count(*) into v_n from public.materia where plan_id = p;
  if v_n = 0 then
    raise exception 'El plan no tiene ninguna materia: no se puede publicar';
  end if;

  -- 2) ninguna materia sin nombre
  if exists (select 1 from public.materia where plan_id = p and btrim(nom) = '') then
    raise exception 'Hay materias sin nombre: no se puede publicar';
  end if;

  -- 3) toda correlativa apunta a un cuatrimestre anterior (⇒ sin ciclos)
  select string_agg(c.cod || ' ← ' || c.requiere, ', ') into v_mal
    from public.correlativa c
    join public.materia m on m.plan_id = c.plan_id and m.cod = c.cod
    join public.materia r on r.plan_id = c.plan_id and r.cod = c.requiere
   where c.plan_id = p
     and (r.anio - 1) * 2 + (r.cuatri - 1) >= (m.anio - 1) * 2 + (m.cuatri - 1);
  if v_mal is not null then
    raise exception 'Estas correlativas no apuntan a un cuatrimestre anterior: %', v_mal;
  end if;

  -- 4) ninguna optativa participa de las correlativas (RN-05)
  select string_agg(c.cod || ' ← ' || c.requiere, ', ') into v_mal
    from public.correlativa c
   where c.plan_id = p
     and exists (select 1 from public.materia m
                  where m.plan_id = p and m.opt and m.cod in (c.cod, c.requiere));
  if v_mal is not null then
    raise exception 'Estas correlativas involucran una optativa: %', v_mal;
  end if;

  -- 5) los títulos apuntan a años (y cuatrimestres) que existen
  select string_agg(t.nombre, ', ') into v_mal
    from public.titulo t
   where t.plan_id = p
     and not exists (
       select 1 from public.materia m
        where m.plan_id = p and m.anio = t.hasta_anio
          and (t.hasta_cuatri is null or m.cuatri = t.hasta_cuatri));
  if v_mal is not null then
    raise exception 'Estos títulos apuntan a un año o cuatrimestre que el plan no tiene: %', v_mal;
  end if;

  -- La foto
  select coalesce(max(version), 0) + 1 into v_next
    from public.plan_version where plan_id = p;

  insert into public.plan_version (plan_id, version, data, nota, publicado_por)
  values (p, v_next, public.plan_json(p), nota, auth.uid());

  update public.plan
     set version_publicada = v_next,
         estado = 'publicado',
         publicado_at = now(),
         actualizado_por = auth.uid()
   where id = p;

  return v_next;
end;
$$;

-- ── Volver a una versión anterior ─────────────────────────────────────────
-- No borra nada ni restaura filas: mueve el puntero. Las filas vivas (el borrador)
-- quedan como están, así el admin puede seguir corrigiendo desde donde iba.
create or replace function public.revertir_plan(p text, v int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_uni text;
begin
  select universidad_id into v_uni from public.plan where id = p;
  if v_uni is null then
    raise exception 'No existe el plan %', p;
  end if;
  if not public.permiso_uni(v_uni, 'editar') then
    raise exception 'No tenés permiso para publicar planes de %', v_uni;
  end if;
  if not exists (select 1 from public.plan_version where plan_id = p and version = v) then
    raise exception 'El plan % no tiene una versión %', p, v;
  end if;
  update public.plan set version_publicada = v where id = p;
  return v;
end;
$$;

-- Se llaman por RPC desde el editor; nunca desde una sesión anónima.
revoke all on function public.publicar_plan(text, text) from public, anon;
revoke all on function public.revertir_plan(text, int)  from public, anon;
grant execute on function public.publicar_plan(text, text) to authenticated;
grant execute on function public.revertir_plan(text, int)  to authenticated;

-- ── Lo que ve el alumno: la FOTO, no las filas vivas ──────────────────────
-- Mismas columnas y mismos tipos que antes → el cliente no cambia ni una línea.
create or replace view public.plan_publicado
with (security_invoker = true) as
select
  v.data->>'id'                  as id,
  v.data->>'universidad'         as universidad,
  v.data->>'codigo'              as codigo,
  (v.data->>'anio')::int         as anio,
  v.data->>'carrera'             as carrera,
  v.version                      as version,
  v.publicado_at                 as actualizado_at,
  p.orden                        as orden,
  coalesce(v.data->'materias',     '[]'::jsonb) as materias,
  coalesce(v.data->'correlativas', '[]'::jsonb) as correlativas,
  coalesce(v.data->'titulos',      '[]'::jsonb) as titulos
from public.plan p
join public.plan_version v
  on v.plan_id = p.id and v.version = p.version_publicada
where p.estado = 'publicado';

grant select on public.plan_publicado to anon, authenticated;

-- ── RLS de las fotos ──────────────────────────────────────────────────────
-- Se leen las versiones de un plan que ya podés leer (la subconsulta pasa por las
-- políticas de `plan`, así que el alumno ve las de los publicados y el admin también
-- las de los suyos). Escribir: solo por `publicar_plan`.
alter table public.plan_version enable row level security;

drop policy if exists plan_version_lectura on public.plan_version;
create policy plan_version_lectura on public.plan_version
  for select to anon, authenticated
  using (exists (select 1 from public.plan p where p.id = plan_id));

-- ── Publicar la versión 1 de lo que ya está cargado ───────────────────────
-- Sin esto la vista quedaría vacía (no hay fotos) y la app caería al bundle. Se hace
-- con SQL directo y no con `publicar_plan` porque acá no hay sesión: el editor corre
-- como `postgres` y `auth.uid()` es nulo.
insert into public.plan_version (plan_id, version, data, nota)
select p.id, 1, public.plan_json(p.id), 'Carga inicial (migrada del repo)'
  from public.plan p
 where not exists (select 1 from public.plan_version v where v.plan_id = p.id);

update public.plan p
   set version_publicada = 1
 where p.version_publicada is null
   and exists (select 1 from public.plan_version v where v.plan_id = p.id and v.version = 1);

-- ── Verificación (mirá que los 4 digan version_publicada = 1) ─────────────
select
  p.id,
  p.carrera,
  p.estado,
  p.version_publicada,
  (select count(*) from public.plan_version v where v.plan_id = p.id) as versiones,
  jsonb_array_length(pp.materias)     as materias,
  jsonb_array_length(pp.correlativas) as correlativas,
  case when pp.id is null then '✗ NO SE VE (falta publicar)' else '✓ visible' end as estado_app
from public.plan p
left join public.plan_publicado pp on pp.id = p.id
order by p.orden;
