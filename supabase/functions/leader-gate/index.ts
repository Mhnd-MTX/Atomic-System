import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authorization = request.headers.get('Authorization') || ''
    const token = authorization.replace(/^Bearer\s+/i, '')
    const { password } = await request.json()
    const gatePassword = Deno.env.get('LEADER_GATE_PASSWORD')
    if (!token || !gatePassword || password !== gatePassword) {
      return Response.json({ ok: false, error: 'Leader access could not be verified.' }, { status: 403, headers: corsHeaders })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const { data: authData, error: authError } = await admin.auth.getUser(token)
    if (authError || !authData.user) {
      return Response.json({ ok: false, error: 'Please sign in again.' }, { status: 401, headers: corsHeaders })
    }
    const { data: profile } = await admin.from('team_members').select('role').eq('id', authData.user.id).maybeSingle()
    if (profile?.role !== 'leader') {
      return Response.json({ ok: false, error: 'A leader account is required.' }, { status: 403, headers: corsHeaders })
    }
    return Response.json({ ok: true }, { headers: corsHeaders })
  } catch {
    return Response.json({ ok: false, error: 'Leader access could not be verified.' }, { status: 400, headers: corsHeaders })
  }
})