import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "http://localhost:54321"
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "anon-key-placeholder"

export const isSupabaseConfigured =
  Boolean(import.meta.env.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY) &&
  import.meta.env.VITE_SUPABASE_ANON_KEY !== "anon-key-placeholder"

if (!isSupabaseConfigured && typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
  console.warn(
    "[Supabase] Missing or default VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Verify your web/.env configuration."
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

