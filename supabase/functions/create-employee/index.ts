import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type EmployeeRole = 'MAIN_BRANCH_EMPLOYEE' | 'BRANCH_EMPLOYEE';

interface CreateEmployeeBody {
  email?: string;
  password?: string;
  full_name?: string;
  role?: EmployeeRole;
  branch_id?: string | null;
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(500, { error: 'Server is missing Supabase configuration.' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse(401, { error: 'Missing authorization header.' });
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();

  if (callerError || !caller) {
    return jsonResponse(401, { error: 'Invalid or expired session.' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, active')
    .eq('id', caller.id)
    .maybeSingle();

  if (profileError || !callerProfile || !callerProfile.active || callerProfile.role !== 'OWNER') {
    return jsonResponse(403, { error: 'Only the Owner can create employees.' });
  }

  let body: CreateEmployeeBody;
  try {
    body = (await req.json()) as CreateEmployeeBody;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body.' });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const fullName = (body.full_name ?? '').trim();
  const role = body.role;
  const branchId = body.branch_id ?? null;

  if (!email || !email.includes('@')) {
    return jsonResponse(400, { error: 'A valid email is required.' });
  }
  if (password.length < 8) {
    return jsonResponse(400, { error: 'Password must be at least 8 characters.' });
  }
  if (!fullName) {
    return jsonResponse(400, { error: 'Full name is required.' });
  }
  if (role !== 'BRANCH_EMPLOYEE' && role !== 'MAIN_BRANCH_EMPLOYEE') {
    return jsonResponse(400, {
      error: 'Role must be BRANCH_EMPLOYEE or MAIN_BRANCH_EMPLOYEE.',
    });
  }

  if (role === 'BRANCH_EMPLOYEE' && !branchId) {
    return jsonResponse(400, { error: 'Branch employees must be assigned to a branch.' });
  }

  if (branchId) {
    const { data: branch, error: branchError } = await admin
      .from('branches')
      .select('id, branch_type, active')
      .eq('id', branchId)
      .maybeSingle();

    if (branchError || !branch || !branch.active) {
      return jsonResponse(400, { error: 'Assigned branch was not found or is inactive.' });
    }

    if (role === 'MAIN_BRANCH_EMPLOYEE' && branch.branch_type !== 'MAIN') {
      return jsonResponse(400, {
        error: 'Main Branch employees must be assigned to the Main Branch.',
      });
    }

    if (role === 'BRANCH_EMPLOYEE' && branch.branch_type === 'MAIN') {
      return jsonResponse(400, {
        error: 'Branch employees must be assigned to a sub-branch, not Main Branch.',
      });
    }
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    const message = createError?.message ?? 'Failed to create auth user.';
    const status = message.toLowerCase().includes('already') ? 409 : 400;
    return jsonResponse(status, { error: message });
  }

  const userId = created.user.id;
  let profileUpdated = false;

  for (let attempt = 0; attempt < 12 && !profileUpdated; attempt += 1) {
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await admin
        .from('profiles')
        .update({
          full_name: fullName,
          email,
          role,
          branch_id: branchId,
          active: true,
        })
        .eq('id', userId);

      if (updateError) {
        await admin.auth.admin.deleteUser(userId);
        return jsonResponse(500, { error: updateError.message });
      }
      profileUpdated = true;
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  if (!profileUpdated) {
    const { error: insertError } = await admin.from('profiles').insert({
      id: userId,
      full_name: fullName,
      email,
      role,
      branch_id: branchId,
      active: true,
    });

    if (insertError) {
      await admin.auth.admin.deleteUser(userId);
      return jsonResponse(500, { error: insertError.message });
    }
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, email, role, branch_id, active, created_at, updated_at')
    .eq('id', userId)
    .single();

  return jsonResponse(200, { profile });
});
