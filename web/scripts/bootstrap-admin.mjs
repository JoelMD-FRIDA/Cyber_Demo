import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const onlyIfConfigured = args[0] === '--if-configured';
if (onlyIfConfigured) args.shift();
const resetExistingPassword = args[0] === '--reset-password';
if (resetExistingPassword) args.shift();

const [argEmail, argPassword, argFirstName, argLastName] = args;
const email = (argEmail || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = argPassword || process.env.ADMIN_PASSWORD || '';
const firstName = argFirstName || process.env.ADMIN_FIRST_NAME || 'Admin';
const lastName = argLastName || process.env.ADMIN_LAST_NAME || 'User';

if (onlyIfConfigured && (!email || !password)) {
  console.log('Admin bootstrap skipped: ADMIN_EMAIL and ADMIN_PASSWORD are not configured.');
  process.exit(0);
}
if (!email) {
  console.error('Usage: npm run bootstrap:admin -- <email> [password] [firstName] [lastName]');
  console.error('Or configure ADMIN_EMAIL and ADMIN_PASSWORD in the environment.');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function findUserByEmail(targetEmail) {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === targetEmail);
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
  return null;
}

let user;
try {
  user = await findUserByEmail(email);
  if (user) {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      ...(password && (!onlyIfConfigured || resetExistingPassword) ? { password } : {}),
      email_confirm: true,
      user_metadata: { ...user.user_metadata, firstname: firstName, lastname: lastName },
    });
    if (error || !data.user) throw error ?? new Error('Supabase did not return the updated user.');
    user = data.user;
  } else {
    if (!password) {
      throw new Error('A password is required when creating a new admin user.');
    }
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { firstname: firstName, lastname: lastName },
    });
    if (error || !data.user) throw error ?? new Error('Supabase did not return the new user.');
    user = data.user;
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: user.id,
    email,
    firstname: firstName,
    lastname: lastName,
    role: 'admin',
  }, { onConflict: 'id' });
  if (profileError) throw profileError;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

console.log(`Admin bootstrap completed for ${email} (${user.id}).`);
