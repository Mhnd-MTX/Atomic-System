import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { name, password } = await request.json()
    if (typeof name !== 'string' || !name.trim() || typeof password !== 'string' || !password) {
      return Response.json({ error: 'Enter your name and password.' }, { status: 400, headers: corsHeaders })
    }

    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const auth = createClient(url, anonKey, { auth: { persistSession: false } })
    const namePattern = name.trim().replace(/[\\%_]/g, '\\$&')
    const { data: profile, error: lookupError } = await admin
      .from('team_members')
      .select('id,name,email,role,red_points,green_points,avatar')
      .ilike('name', namePattern)
      .maybeSingle()

    if (lookupError || !profile) {
      return Response.json({ error: 'That name and password did not match.' }, { status: 401, headers: corsHeaders })
    }

    const { data, error } = await auth.auth.signInWithPassword({ email: profile.email, password })
    if (error || !data.session) {
      return Response.json({ error: 'That name and password did not match.' }, { status: 401, headers: corsHeaders })
    }
    return Response.json({ session: data.session, member: profile }, { headers: corsHeaders })
  } catch {
    return Response.json({ error: 'Could not sign in. Please try again.' }, { status: 400, headers: corsHeaders })
  }
})