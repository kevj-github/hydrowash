import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // PKCE requires crypto.subtle which is only available in secure contexts
        // (HTTPS or localhost). Use implicit flow so plain-HTTP VPS testing works.
        flowType: 'implicit',
      },
    }
  )
}
