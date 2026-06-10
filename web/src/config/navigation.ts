import {
  HomeIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  KeyIcon,
  ShieldCheckIcon,
  LogInIcon,
  UserPlusIcon,
  UsersIcon,
  Building2Icon,
  FolderTreeIcon,
  FileTextIcon,
  ShieldIcon,
  MailIcon,
  FileCode2Icon,
  KeyRoundIcon,
  TicketIcon,
  FileUpIcon,
  TimerIcon,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type NavItem = {
  title: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

export const navigationByRole: Record<string, NavGroup[]> = {
  anonymous: [
    {
      items: [
        { title: "Home", href: "/", icon: HomeIcon },
        { title: "Login", href: "/login", icon: LogInIcon },
        { title: "Register", href: "/register", icon: UserPlusIcon },
      ],
    },
  ],
  user: [
    {
      items: [
        { title: "Home", href: "/", icon: HomeIcon },
        { title: "Domain Check", href: "/dashboard/domain-check", icon: GlobeIcon },
        { title: "Profile", href: "/profile", icon: ShieldCheckIcon },
      ],
    },
  ],
  admin: [
    {
      items: [
        { title: "Home", href: "/", icon: HomeIcon },
        { title: "Domain Check", href: "/dashboard/domain-check", icon: GlobeIcon },
        { title: "Profile", href: "/profile", icon: ShieldCheckIcon },
      ],
    },
    {
      label: "Admin",
      items: [
        { title: "Dashboard", href: "/admin", icon: LayoutDashboardIcon },
        { title: "Users", href: "/admin/users", icon: UsersIcon },
        { title: "Providers", href: "/admin/providers", icon: Building2Icon },
        { title: "Categories", href: "/admin/categories", icon: FolderTreeIcon },
        { title: "Master Data", href: "/admin/master-data", icon: FileUpIcon },
        { title: "PGP Certs", href: "/admin/pgp", icon: KeyIcon },
        { title: "API Credentials", href: "/admin/credentials", icon: ShieldCheckIcon },
        { title: "Registration Keys", href: "/admin/registration-keys", icon: TicketIcon },
        { title: "Email Accounts", href: "/admin/email-accounts", icon: MailIcon },
        { title: "Email Templates", href: "/admin/email-templates", icon: FileCode2Icon },
        { title: "Forgot Password", href: "/admin/forgot-password", icon: KeyRoundIcon },
        { title: "Scheduled Jobs", href: "/admin/jobs", icon: TimerIcon },
      ],
    },
  ],
};

export const footerLinks: NavItem[] = [
  { title: "Impressum", href: "/impressum", icon: FileTextIcon },
  { title: "Datenschutz", href: "/datenschutz", icon: ShieldIcon },
];
