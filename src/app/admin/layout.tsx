import {
  CreditCard,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  Package,
  Settings2,
  ShoppingBag,
  Ticket,
  Truck,
  Users,
} from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { SignOutButton } from '@/components/sign-out-button';
import { DashboardShell, type DashboardNavGroup } from '@/components/dashboard-shell';

// Rutas "#" y sub-items son placeholders visuales — todavía no hay páginas detrás.
const nav: DashboardNavGroup[] = [
  {
    label: 'Panel',
    items: [{ href: '/admin', label: 'Resumen', icon: <LayoutDashboard /> }],
  },
  {
    label: 'Catálogo',
    items: [
      {
        href: '#',
        label: 'Productos',
        icon: <ShoppingBag />,
        items: [
          { href: '#', label: 'Todos los productos' },
          { href: '#', label: 'Categorías' },
          { href: '#', label: 'Inventario' },
        ],
      },
      { href: '#', label: 'Colecciones', icon: <LayoutGrid /> },
    ],
  },
  {
    label: 'Ventas',
    items: [
      {
        href: '#',
        label: 'Pedidos',
        icon: <Package />,
        items: [
          { href: '#', label: 'Todos los pedidos' },
          { href: '#', label: 'Devoluciones' },
        ],
      },
      { href: '#', label: 'Clientes', icon: <Users /> },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '#', label: 'Cupones', icon: <Ticket /> },
      { href: '#', label: 'Promociones', icon: <Megaphone /> },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { href: '#', label: 'General', icon: <Settings2 /> },
      { href: '#', label: 'Envíos', icon: <Truck /> },
      { href: '#', label: 'Pagos', icon: <CreditCard /> },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('ADMIN', 'STAFF');

  return (
    <DashboardShell
      title="Panel de administración"
      email={session.user?.email}
      nav={nav}
      signOutSlot={<SignOutButton />}
    >
      {children}
    </DashboardShell>
  );
}
