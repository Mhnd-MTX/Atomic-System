import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
}

const respond = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: corsHeaders })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return respond({ error: 'Sign in as a team leader.' }, 401)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const { data: authData, error: authError } = await admin.auth.getUser(token)
    if (authError || !authData.user) return respond({ error: 'Please sign in again.' }, 401)
    const { data: actor } = await admin.from('team_members').select('role').eq('id', authData.user.id).maybeSingle()
    if (actor?.role !== 'leader') return respond({ error: 'Leader access is required.' }, 403)

    const { action, member } = await request.json()
    if (action === 'create') {
      if (!member?.name?.trim() || !member?.email?.trim() || typeof member.password !== 'string' || member.password.length < 8) {
        return respond({ error: 'Enter a name, valid email, and password of at least 8 characters.' }, 400)
      }
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: member.email.trim(), password: member.password, email_confirm: true,
        user_metadata: { name: member.name.trim() },
      })
      if (createError || !created.user) return respond({ error: createError?.message || 'Could not create the login.' }, 400)
      const { error: profileError } = await admin.from('team_members').insert({
        id: created.user.id, name: member.name.trim(), email: member.email.trim(),
        role: 'member', avatar: member.name.trim().split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase(),
      })
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id)
        return respond({ error: profileError.message }, 400)
      }
      return respond({ ok: true })
    }

    if (action === 'update') {
      if (!member?.id || !member?.name?.trim() || !member?.email?.trim()) return respond({ error: 'Name and email are required.' }, 400)
      const { data: existing } = await admin.from('team_members').select('role').eq('id', member.id).maybeSingle()
      if (!existing) return respond({ error: 'Team member not found.' }, 404)
      const email = member.email.trim()
      const name = member.name.trim()
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(member.id, { email, user_metadata: { name } })
      if (authUpdateError) return respond({ error: authUpdateError.message }, 400)
      const { error } = await admin.from('team_members').update({
        name, email, avatar: name.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase(),
      }).eq('id', member.id)
      if (error) return respond({ error: error.message }, 400)
      return respond({ ok: true })
    }

    if (action === 'delete') {
      if (!member?.id || member.id === authData.user.id) return respond({ error: 'You cannot remove your own leader account.' }, 400)
      const { data: target } = await admin.from('team_members').select('role').eq('id', member.id).maybeSingle()
      if (!target) return respond({ error: 'Team member not found.' }, 404)
      if (target.role === 'leader') return respond({ error: 'Leader accounts cannot be removed here.' }, 403)
      const { error } = await admin.auth.admin.deleteUser(member.id)
      if (error) return respond({ error: error.message }, 400)
      return respond({ ok: true })
    }

    return respond({ error: 'Unsupported member action.' }, 400)
  } catch {
    return respond({ error: 'Could not update team members.' }, 400)
  }
})