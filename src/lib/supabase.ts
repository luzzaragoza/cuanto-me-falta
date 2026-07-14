// Cliente de Supabase (auth + sync). Agnóstico igual que analytics: si no hay
// credenciales en el entorno, el cliente es `null` y toda la capa de cuenta
// desaparece → la app sigue 100% local, como hasta ahora. Así en dev/E2E sin
// backend no aparece nada y los tests no cambian.
//
// Env (ver .env.example):
//   VITE_SUPABASE_URL       — https://<ref>.supabase.co
//   VITE_SUPABASE_ANON_KEY  — la clave publishable (pública por diseño, la protege el RLS)
//
// La clave publishable NO es secreta: viaja al navegador igual. La `secret`/`service_role`
// JAMÁS va acá ni en el repo.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const env = import.meta.env as Record<string, string | undefined>
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

/** Cliente único, o `null` si no hay backend configurado. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        // PKCE en vez del flujo implícito (el default): Google vuelve con un
        // `?code=` de un solo uso en lugar de `#access_token=` (un JWT vivo en
        // la URL, que quedaba en el historial y hasta en Umami como "página").
        auth: { flowType: 'pkce' },
      })
    : null

/** ¿Está la capa de cuenta habilitada? (hay credenciales de Supabase) */
export const authHabilitado = supabase !== null
