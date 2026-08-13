import { createClient } from '@supabase/supabase-js';

const [email, password, firstName = 'Admin', lastName = 'User'] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run bootstrap:admin -- <email> <password> [firstName] [lastName]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await supabase.auth.admin.createUser({
  email: email.toLowerCase(),
  password,
  email_confirm: true,
  user_metadata: { firstname: firstName, lastname: lastName },
});
if (error || !data.user) {
  console.error(error?.message ?? 'Supabase did not return the new user.');
  process.exit(1);
}

const { error: profileError } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', data.user.id);
if (profileError) {
  await supabase.auth.admin.deleteUser(data.user.id);
  console.error(profileError.message);
  process.exit(1);
}

console.log(`Admin bootstrap completed for ${email.toLowerCase()} (${data.user.id}). Remove access to this command after the one-time operation.`);
