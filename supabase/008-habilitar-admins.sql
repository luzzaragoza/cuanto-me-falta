-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 008 · Habilitar admins de universidad desde la pantalla                  │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Cómo correrlo: Supabase → SQL Editor (Role: postgres) → pegar TODO → Run.
-- Idempotente. Requiere 002 y 006.
--
-- EL PROBLEMA: hasta ahora habilitar a alguien era el `insert` comentado al pie de la
-- 002, corrido a mano en este editor. Eso funciona para una persona, pero el paso 4 del
-- sprint pide que el superadmin lo haga desde `#admin` — y desde el navegador NO se
-- puede: `auth.users` no está expuesta por PostgREST (ni debería estarlo), así que el
-- cliente no tiene forma de traducir un mail a un `user_id`.
--
-- LA FORMA: tres funciones `security definer` que hacen esa traducción del lado del
-- servidor. Son la ÚNICA puerta, y cada una chequea `es_superadmin()` en su primera
-- línea — el `security definer` corre con permisos del dueño, así que sin ese chequeo
-- serían un agujero por el que cualquiera se haría admin.
--
-- Por qué por MAIL y no por id: el superadmin conoce a la persona por su mail (es con lo
-- que entra a Google), no por un UUID. Pedirle el UUID sería pedirle que abra el panel de
-- Supabase, que es exactamente lo que esta pantalla viene a evitar.
--
-- Lo que NO se expone, a propósito: la lista de `auth.users`. `admins_de()` devuelve el
-- mail solo de quien YA está habilitado en esa universidad. No hay forma de listar ni de
-- buscar cuentas del padrón desde el cliente.

begin;

/**
 * Los admins habilitados en una universidad, con su mail.
 * Solo para el superadmin: para cualquier otro, lista vacía.
 */
create or replace function public.admins_de(p_uni text)
returns table (user_id uuid, email text, crear boolean, editar boolean, eliminar boolean,
               otorgado_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.user_id, u.email::text, a.crear, a.editar, a.eliminar, a.otorgado_at
    from public.admin_uni a
    join auth.users u on u.id = a.user_id
   where a.universidad_id = p_uni
     and public.es_superadmin()
   order by u.email;
$$;

/**
 * Habilita (o actualiza) a una persona como admin de una universidad.
 *
 * Devuelve el `user_id` habilitado. Tira con un mensaje claro si el mail no tiene cuenta:
 * la persona tiene que haber entrado al menos una vez con Google — no se pueden crear
 * cuentas desde acá, y está bien que así sea.
 */
create or replace function public.habilitar_admin(
  p_email    text,
  p_uni      text,
  p_crear    boolean default false,
  p_editar   boolean default true,
  p_eliminar boolean default false
)
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

  select id into v_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_id is null then
    raise exception 'No hay ninguna cuenta con el mail %. Tiene que entrar una vez con Google antes de habilitarla.', p_email;
  end if;

  insert into public.admin_uni (user_id, universidad_id, crear, editar, eliminar, otorgado_por)
  values (v_id, p_uni, p_crear, p_editar, p_eliminar, auth.uid())
  on conflict (user_id, universidad_id) do update
    set crear = excluded.crear,
        editar = excluded.editar,
        eliminar = excluded.eliminar;

  return v_id;
end;
$$;

/**
 * Revoca la habilitación. Efecto INMEDIATO: los permisos se leen de esta tabla en cada
 * consulta, no de un claim del JWT que quedaría cacheado hasta que se refresque la
 * sesión (ADR-11, punto 5).
 */
create or replace function public.revocar_admin(p_email text, p_uni text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.es_superadmin() then
    raise exception 'Solo el superadmin puede revocar administradores';
  end if;
  select id into v_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_id is null then
    raise exception 'No hay ninguna cuenta con el mail %', p_email;
  end if;
  delete from public.admin_uni where user_id = v_id and universidad_id = p_uni;
end;
$$;

-- Se llaman por RPC desde la pantalla; nunca desde una sesión anónima.
revoke all on function public.admins_de(text)                                   from public, anon;
revoke all on function public.habilitar_admin(text, text, boolean, boolean, boolean) from public, anon;
revoke all on function public.revocar_admin(text, text)                         from public, anon;
grant execute on function public.admins_de(text)                                   to authenticated;
grant execute on function public.habilitar_admin(text, text, boolean, boolean, boolean) to authenticated;
grant execute on function public.revocar_admin(text, text)                         to authenticated;

commit;

-- ── Verificación ──────────────────────────────────────────────────────────
select
  p.proname as funcion,
  p.prosecdef as security_definer,
  has_function_privilege('authenticated', p.oid, 'execute') as la_puede_llamar_authenticated,
  has_function_privilege('anon', p.oid, 'execute')          as la_puede_llamar_anon
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('admins_de', 'habilitar_admin', 'revocar_admin')
order by p.proname;

-- Las tres tienen que decir: security_definer = true, authenticated = true, anon = false.
--
-- Probarlas (como superadmin, desde la app o acá):
--   select public.habilitar_admin('persona@uni.edu.ar', 'uade', true, true, false);
--   select * from public.admins_de('uade');
--   select public.revocar_admin('persona@uni.edu.ar', 'uade');
