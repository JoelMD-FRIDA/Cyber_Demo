import {
  HomeIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  UsersIcon,
  Building2Icon,
  FolderTreeIcon,
  ShieldCheckIcon,
  TicketIcon,
  FileTextIcon,
  ShieldIcon,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

export type NavItem = {
  title: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

const commonItems: NavItem[] = [
  { title: 'nav.home', href: '/', icon: HomeIcon },
  { title: 'nav.domainCheck', href: '/dashboard/domain-check', icon: GlobeIcon },
  { title: 'nav.profile', href: '/profile', icon: ShieldCheckIcon },
];

export const navigationByRole: Record<string, NavGroup[]> = {
  anonymous: [{ items: [{ title: 'nav.home', href: '/', icon: HomeIcon }] }],
  user: [{ items: commonItems }],
  admin: [
    { items: commonItems },
    {
      label: 'nav.admin',
      items: [
        { title: 'nav.dashboard', href: '/admin', icon: LayoutDashboardIcon },
        { title: 'nav.users', href: '/admin/users', icon: UsersIcon },
        { title: 'nav.providers', href: '/admin/providers', icon: Building2Icon },
        { title: 'nav.categories', href: '/admin/categories', icon: FolderTreeIcon },
        { title: 'nav.registrationKeys', href: '/admin/registration-keys', icon: TicketIcon },
      ],
    },
  ],
};

export const footerLinks: NavItem[] = [
  { title: 'nav.imprint', href: '/impressum', icon: FileTextIcon },
  { title: 'nav.privacy', href: '/datenschutz', icon: ShieldIcon },
];
