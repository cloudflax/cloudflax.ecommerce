import { CreditCard, Heart, MapPin, Package, User } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { SignOutButton } from '@/components/sign-out-button';
import { DashboardShell, type DashboardNavGroup } from '@/components/dashboard-shell';

// Rutas "#" son placeholders visuales — todavía no hay páginas detrás.
const nav: DashboardNavGroup[] = [
  {
    label: 'Mi cuenta',
    items: [
      { href: '/account', label: 'Perfil', icon: <User /> },
      { href: '#', label: 'Mis pedidos', icon: <Package /> },
      { href: '#', label: 'Direcciones', icon: <MapPin /> },
      { href: '#', label: 'Métodos de pago', icon: <CreditCard /> },
      { href: '#', label: 'Favoritos', icon: <Heart /> },
    ],
  },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('CUSTOMER');

  return (
    <DashboardShell
      title="Mi cuenta"
      email={session.user?.email}
      nav={nav}
      signOutSlot={<SignOutButton />}
    >
      {children}
    </DashboardShell>
  );
}
