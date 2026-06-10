"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { navigationByRole } from "@/config/navigation";

type UserRole = "anonymous" | "user" | "admin";

interface AppSidebarProps {
  userRole?: UserRole | null;
}

export function AppSidebar({ userRole = null }: AppSidebarProps) {
  const pathname = usePathname();
  const navGroups = userRole === "admin"
    ? (navigationByRole.admin ?? []).filter((group) => group.label === "Admin")
    : [];

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-[var(--stitch-outline-variant)]/70 bg-[var(--stitch-surface-container-lowest)] shadow-none"
    >
      <SidebarHeader className="min-h-[var(--stitch-topbar-height)] justify-center border-b border-[var(--stitch-outline-variant)]/70 bg-[var(--stitch-surface-container-lowest)] px-0 py-[var(--stitch-space-sm)]">
        <div className="flex items-center gap-[var(--frida-space-small)] px-[var(--frida-space-medium)] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Image
            src="/frida-icon.png"
            alt="FRIDA"
            width={32}
            height={32}
            className="size-[var(--frida-logo-size)] shrink-0 rounded-[var(--frida-radius-default)]"
            unoptimized
          />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-[16px] font-semibold leading-6 text-[var(--stitch-primary)]">Admin Console</span>
            <span className="text-[11px] font-semibold leading-4 text-[var(--stitch-on-surface-variant)]">
              Cybersecurity Oversight
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-[var(--stitch-space-md)]">
        {navGroups.map((group, groupIndex) => (
          <SidebarGroup key={groupIndex} className="px-[var(--frida-space-small)] py-[var(--frida-space-small)]">
            {group.label && (
              <SidebarGroupLabel className="h-auto px-[var(--frida-space-small)] pb-[var(--frida-space-small)] pt-0 text-xs font-bold uppercase tracking-wide text-[var(--stitch-on-surface-variant)]">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        className="h-10 rounded-[var(--stitch-control-radius)] border-l-4 border-transparent px-[var(--stitch-space-md)] text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--stitch-on-surface-variant)] transition-colors hover:bg-[var(--stitch-surface-container)] hover:text-[var(--stitch-primary)] data-active:border-[var(--stitch-primary)] data-active:bg-[var(--stitch-surface-container)] data-active:text-[var(--stitch-primary)] group-data-[collapsible=icon]:size-[var(--frida-sidebar-width-collapsed)]! group-data-[collapsible=icon]:p-0! [&_svg]:size-5"
                      >
                        <Link href={item.href} prefetch={false} className="flex h-full min-w-0 flex-1 items-center gap-[var(--frida-space-small)] group-data-[collapsible=icon]:justify-center">
                          <Icon className="size-4" />
                          <span className="truncate group-data-[collapsible=icon]:hidden">
                            {item.title}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-[var(--stitch-outline-variant)]/70 px-[var(--frida-space-medium)] py-[var(--frida-space-medium)] group-data-[collapsible=icon]:px-0">
        <div className="flex items-center gap-[var(--frida-space-small)] text-xs font-semibold text-[var(--stitch-on-surface-variant)] group-data-[collapsible=icon]:hidden">
          <span>v0.1.0</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
