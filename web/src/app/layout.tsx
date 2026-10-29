import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { SessionContinuity } from "@/components/session-continuity";
import { I18nProvider } from "@/lib/i18n";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: {
    default: "Frida DomainCheck",
    template: "%s — Frida DomainCheck",
  },
  description: "Domain verification and management platform",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialLocale = cookieStore.get("locale")?.value === "en" ? "en" : "de";
  return (
    <html lang={initialLocale}>
      <body className="flex min-h-screen flex-col">
        <I18nProvider initialLocale={initialLocale}>
          <SessionContinuity />
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
