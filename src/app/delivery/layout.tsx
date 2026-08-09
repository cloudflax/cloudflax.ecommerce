import { History, Route, Truck } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { SignOutButton } from '@/components/sign-out-button';
import { DashboardShell, type DashboardNavGroup } from '@/components/dashboard-shell';

// Rutas "#" son placeholders visuales — todavía no hay páginas detrás.
const nav: DashboardNavGroup[] = [
  {
    label: 'Repartos',
    items: [
      { href: '/delivery', label: 'Entregas de hoy', icon: <Truck /> },
      { href: '#', label: 'Ruta', icon: <Route /> },
      { href: '#', label: 'Historial', icon: <History /> },
    ],
  },
];

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('DELIVERY');

  return (
    <DashboardShell
      title="Panel de repartidor"
      email={session.user?.email}
      nav={nav}
      signOutSlot={<SignOutButton />}
    >
      {children}
    </DashboardShell>
  );
}
