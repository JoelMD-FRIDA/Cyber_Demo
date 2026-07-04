"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoonIcon, SunIcon, LogOutIcon, GlobeIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { navigationByRole } from "@/config/navigation";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";


type UserRole = "anonymous" | "user" | "admin";

interface HeaderProps {
  userRole?: UserRole | null;
  userName?: string;
  onLogout?: () => void;
  onToggleDark?: () => void;
  isDark?: boolean;
  hasSidebar?: boolean;
}

export function Header({
  userRole = null,
  userName,
  onLogout,
  onToggleDark,
  isDark = false,
  hasSidebar = false,
}: HeaderProps) {
  const pathname = usePathname();
  const navItems = userRole ? navigationByRole[userRole]?.[0]?.items ?? [] : [];
  const [locale, setLocale] = useState<"de" | "en">("de");

  useEffect(() => {
    const saved = localStorage.getItem("locale") as "de" | "en" | null;
    if (saved) {
      setLocale(saved);
    }
  }, []);

  const handleLocaleChange = (newLocale: "de" | "en") => {
    setLocale(newLocale);
    localStorage.setItem("locale", newLocale);
    document.documentElement.lang = newLocale;
  };

  return (
    <header className="sticky top-0 z-50 flex h-[var(--stitch-topbar-height)] min-h-[var(--stitch-topbar-height)] w-full items-center border-b border-[var(--stitch-outline-variant)]/70 bg-[var(--stitch-surface-container-lowest)] px-[var(--stitch-space-lg)] text-[var(--stitch-on-surface)] shadow-none">
      <div className="flex min-w-0 items-center gap-[var(--frida-space-small)]">
        {hasSidebar && (
          <SidebarTrigger className="text-[var(--stitch-primary)] hover:bg-[var(--stitch-surface-container)] hover:text-[var(--stitch-on-secondary-fixed-variant)]" />
        )}
        <Link href="/" className="flex min-w-0 items-center gap-[var(--frida-space-small)]">
          <Image
            src="/frida-icon.png"
            alt="FRIDA"
            width={32}
            height={32}
            className="size-[var(--frida-logo-size)] shrink-0 drop-shadow-sm"
            unoptimized
          />
          <span className="hidden truncate text-[20px] font-bold tracking-tight text-[var(--stitch-primary)] sm:inline">
            Frida DomainCheck
          </span>
        </Link>
      </div>

      <nav className="ml-[var(--frida-space-large)] hidden items-center gap-[var(--frida-space-small)] md:flex">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} prefetch={false}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 gap-[var(--stitch-space-sm)] rounded-[var(--stitch-control-radius)] px-[var(--stitch-space-md)] text-[14px] font-semibold text-[var(--stitch-on-surface-variant)] hover:bg-[var(--stitch-surface-container)] hover:text-[var(--stitch-primary)]",
                  isActive && "bg-[var(--stitch-primary)] text-white hover:bg-[var(--stitch-on-secondary-fixed-variant)] hover:text-white"
                )}
              >
                <Icon className="size-4" />
                {item.title}
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-[var(--frida-space-small)]">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-center text-[var(--stitch-primary)] hover:bg-[var(--stitch-surface-container)] hover:text-[var(--stitch-on-secondary-fixed-variant)] rounded-[var(--stitch-control-radius)] size-8 transition-all active:scale-[0.98] outline-none focus-visible:ring-3 focus-visible:ring-[var(--stitch-primary)]/25" aria-label="Sprache ändern">
            <GlobeIcon className="size-4" />
            <ChevronDownIcon className="size-3 ml-1" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[80px] p-1">
            <DropdownMenuItem
              onClick={() => handleLocaleChange("de")}
              className={cn(
                "data-[state=checked]:bg-[var(--stitch-primary)] data-[state=checked]:text-white",
                locale === "de" && "bg-[var(--stitch-primary)] text-white"
              )}
              data-state={locale === "de" ? "checked" : "unchecked"}
            >
              DE
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleLocaleChange("en")}
              className={cn(
                "data-[state=checked]:bg-[var(--stitch-primary)] data-[state=checked]:text-white",
                locale === "en" && "bg-[var(--stitch-primary)] text-white"
              )}
              data-state={locale === "en" ? "checked" : "unchecked"}
            >
              EN
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {onToggleDark && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleDark}
            className="text-[var(--stitch-primary)] hover:bg-[var(--stitch-surface-container)] hover:text-[var(--stitch-on-secondary-fixed-variant)]"
            aria-label="Toggle dark mode"
          >
            {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
          </Button>
        )}

        {userName ? (
          <div className="flex items-center gap-[var(--frida-space-small)]">
            <Link href="/profile" prefetch={false} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--stitch-primary)]">
              <Avatar className="size-8 cursor-pointer transition-opacity hover:opacity-80">
                <AvatarFallback className="bg-[var(--stitch-primary)] text-xs font-semibold text-white">
                  {userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              className="text-[var(--stitch-on-surface-variant)] hover:bg-[var(--stitch-surface-container)] hover:text-[var(--stitch-primary)]"
              aria-label="Logout"
            >
              <LogOutIcon className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
