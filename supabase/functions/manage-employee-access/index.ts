import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AccessAction = 'REMOVE' | 'RESTORE';

interface AccessRequest {
  employee_id?: string;
  action?: AccessAction;
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(500, { error: 'Server is missing Supabase configuration.' });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) return jsonResponse(401, { error: 'Missing authorization header.' });

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller) return jsonResponse(401, { error: 'Invalid or expired session.' });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerProfile, error: callerProfileError } = await admin
    .from('profiles')
    .select('id, role, active')
    .eq('id', caller.id)
    .maybeSingle();

  if (callerProfileError || !callerProfile?.active || callerProfile.role !== 'OWNER') {
    return jsonResponse(403, { error: 'Only an active Owner can manage employee access.' });
  }

  let body: AccessRequest;
  try {
    body = await request.json() as AccessRequest;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body.' });
  }

  const employeeId = body.employee_id;
  const action = body.action;
  if (!employeeId || (action !== 'REMOVE' && action !== 'RESTORE')) {
    return jsonResponse(400, { error: 'A valid employee and access action are required.' });
  }
  if (employeeId === caller.id) {
    return jsonResponse(403, { error: 'You cannot remove or restore your own access.' });
  }

  const { data: employee, error: employeeError } = await admin
    .from('profiles')
    .select('id, full_name, role, active')
    .eq('id', employeeId)
    .maybeSingle();
  if (employeeError || !employee) return jsonResponse(404, { error: 'Employee profile not found.' });
  if (employee.role === 'OWNER') return jsonResponse(403, { error: 'Owner access cannot be changed here.' });

  const nextActive = action === 'RESTORE';
  if (employee.active === nextActive) {
    return jsonResponse(409, { error: `Employee access is already ${nextActive ? 'active' : 'removed'}.` });
  }

  const nextBanDuration = nextActive ? 'none' : '876000h';
  const previousBanDuration = employee.active ? 'none' : '876000h';
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(employee.id, {
    ban_duration: nextBanDuration,
  });
  if (authUpdateError) return jsonResponse(500, { error: authUpdateError.message });

  const { data: updatedProfile, error: profileUpdateError } = await admin
    .from('profiles')
    .update({ active: nextActive })
    .eq('id', employee.id)
    .select('id, full_name, email, role, branch_id, active, created_at, updated_at')
    .single();

  if (profileUpdateError || !updatedProfile) {
    await admin.auth.admin.updateUserById(employee.id, { ban_duration: previousBanDuration });
    return jsonResponse(500, { error: profileUpdateError?.message ?? 'Failed to update employee status.' });
  }

  const { error: auditError } = await admin.from('employee_access_events').insert({
    actor_id: caller.id,
    employee_id: employee.id,
    action: nextActive ? 'ACCESS_RESTORED' : 'ACCESS_REMOVED',
  });

  if (auditError) {
    await admin.from('profiles').update({ active: employee.active }).eq('id', employee.id);
    await admin.auth.admin.updateUserById(employee.id, { ban_duration: previousBanDuration });
    return jsonResponse(500, { error: 'Access status could not be audited; the change was rolled back.' });
  }

  return jsonResponse(200, { profile: updatedProfile });
});