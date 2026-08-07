import { requireRole } from '@/lib/auth';
import { SignOutButton } from '@/components/sign-out-button';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('ADMIN', 'STAFF');

  return (
    <div className="min-h-svh">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Panel de administración</h1>
          <p className="text-muted-foreground text-sm">{session.user?.email}</p>
        </div>
        <SignOutButton />
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
