import { redirect } from 'next/navigation';
import { auth, ROLE_HOME } from '@/lib/auth';
import { RegisterForm } from './register-form';

export default async function RegisterPage() {
  const session = await auth();
  const home = session?.user ? ROLE_HOME[session.user.role] : undefined;
  // Same rule as /login: with an active session, signing up makes no sense.
  if (home) redirect(home);

  return <RegisterForm />;
}
