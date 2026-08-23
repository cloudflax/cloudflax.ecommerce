import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, ROLE_HOME } from '@/lib/auth';
import { ForgotPasswordForm } from './forgot-password-form';

export default async function ForgotPasswordPage() {
  const session = await auth();
  const home = session?.user ? ROLE_HOME[session.user.role] : undefined;
  // Active session: resetting a password mid-session is pointless, and the
  // change would kill this very session (V4 pattern, same as /login).
  if (home) redirect(home);

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md text-xs font-semibold">
            C
          </div>
          Cloudflax
        </Link>

        <div className="flex flex-col gap-6">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
