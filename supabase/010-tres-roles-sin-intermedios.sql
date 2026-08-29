-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 010 · Tres roles y nada en el medio                                      │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Cómo correrlo: Supabase → SQL Editor (Role: postgres) → pegar TODO → Run.
-- Idempotente. Requiere 008.
--
-- DECISIÓN DE PRODUCTO (Luz, 12-ago): los permisos son TRES y no hay grises.
--
--   superadmin   · lo único que hace de distinto: gestionar permisos y cupos.
--   admin_uni    · en SU universidad puede todo —crear, editar, publicar, eliminar—
--                  hasta el cupo que le dio el superadmin.
--   estudiante   · la app.
--
-- Las columnas `crear`/`editar`/`eliminar` de `admin_uni` nacieron de suponer que una
-- facultad querría repartir esas tres capacidades entre personas distintas. No pasa: quien
-- carga un plan es quien lo corrige y quien lo publica, y las tres casillas solo lograban
-- que se pudiera habilitar a alguien "a medias" por error — un admin sin `crear` que ve un
-- botón apagado y no entiende por qué.
--
-- El cupo sí es una perilla real, porque es la cláusula del contrato con la facultad. Esa
-- se queda.
--
-- ESTA MIGRACIÓN NO BORRA LAS COLUMNAS. Es la mitad "expandir" del expandir/contraer, como
-- la 006: las políticas de RLS leen esas columnas vía `permiso_uni(uni, accion)`, y el
-- código que hoy está en producción todavía las pide en `cargarPerfil`. Acá quedan todas
-- en `true` y dejan de significar algo; la 011 las borra DESPUÉS del deploy.

begin;

-- ── 1. Nadie queda habilitado a medias ────────────────────────────────────
update public.admin_uni
   set crear = true, editar = true, eliminar = true
 where not (crear and editar and eliminar);

-- ── 2. Y no se puede volver a crear una fila a medias ──────────────────────
alter table public.admin_uni alter column crear    set default true;
alter table public.admin_uni alter column editar   set default true;
alter table public.admin_uni alter column eliminar set default true;

comment on column public.admin_uni.crear is
  'Vestigial (010): un admin habilitado puede todo en su universidad. La 011 la borra.';
comment on column public.admin_uni.editar is
  'Vestigial (010): un admin habilitado puede todo en su universidad. La 011 la borra.';
comment on column public.admin_uni.eliminar is
  'Vestigial (010): un admin habilitado puede todo en su universidad. La 011 la borra.';

-- ── 3. Habilitar deja de aceptar matices ──────────────────────────────────
-- Se DROPEA la versión vieja en vez de reemplazarla: si quedaran las dos, PostgREST
-- tendría dos sobrecargas del mismo nombre y no sabría cuál llamar.
drop function if exists public.habilitar_admin(text, text, boolean, boolean, boolean);

create or replace function public.habilitar_admin(p_email text, p_uni text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.es_superadmin() then
    raise exception 'Solo el superadmin puede habilitar administradores';
  end if;
  if not exists (select 1 from public.universidad where id = p_uni) then
    raise exception 'No existe la universidad %', p_uni;
  end if;

  -- El mail vive en `auth.users`, que PostgREST no expone (ni debería): la traducción de
  -- mail a id pasa por acá o no pasa.
  select id into v_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_id is null then
    raise exception 'No hay ninguna cuenta con el mail %. Tiene que entrar una vez con Google antes de habilitarla.', p_email;
  end if;

  insert into public.admin_uni (user_id, universidad_id, crear, editar, eliminar, otorgado_por)
  values (v_id, p_uni, true, true, true, auth.uid())
  on conflict (user_id, universidad_id) do update
    set crear = true, editar = true, eliminar = true;

  -- Que pueda entrar a `#admin`: sin esto queda con permisos sobre la universidad pero
  -- con rol `estudiante`, y la pantalla lo rebota.
  update public.perfil set rol = 'admin_uni'
   where user_id = v_id and rol = 'estudiante';

  return v_id;
end;
$$;

revoke all    on function public.habilitar_admin(text, text) from public, anon;
grant execute on function public.habilitar_admin(text, text) to authenticated;

commit;

-- ── Verificación ──────────────────────────────────────────────────────────
select 'ninguna habilitación a medias' as chequeo,
       case when not exists (select 1 from public.admin_uni
                              where not (crear and editar and eliminar))
            then '✓' else '✗ FALTA' end as estado
union all
select 'habilitar_admin toma 2 parámetros',
       case when (select count(*) from pg_proc
                   where pronamespace = 'public'::regnamespace
                     and proname = 'habilitar_admin') = 1
             and (select pronargs from pg_proc
                   where pronamespace = 'public'::regnamespace
                     and proname = 'habilitar_admin') = 2
            then '✓' else '✗ FALTA' end
order by 1;
