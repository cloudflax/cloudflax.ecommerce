import { LogOutIcon } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  return (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/login' });
      }}
    >
      <Button
        type="submit"
        variant="ghost"
        className="w-full justify-start gap-1.5 px-1.5 py-1 text-sm font-normal"
      >
        <LogOutIcon />
        Cerrar sesión
      </Button>
    </form>
  );
}
