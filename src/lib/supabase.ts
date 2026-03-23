import { createClient } from '@supabase/supabase-js'

let supabaseClient = null

export function getSupabase() {
  const url = localStorage.getItem('dsn_sb_url')
  const key = localStorage.getItem('dsn_sb_key')
  if (!url || !key) return null
  if (!supabaseClient) {
    supabaseClient = createClient(url, key)
  }
  return supabaseClient
}

export function initSupabase(url, key) {
  supabaseClient = createClient(url, key)
  return supabaseClient
}

export function clearSupabase() {
  supabaseClient = null
}
