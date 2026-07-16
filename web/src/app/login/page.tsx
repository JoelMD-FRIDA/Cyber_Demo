"use client";

import { useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { AuthCardBrand } from "@/components/layout/auth-card-brand";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isEmail = identifier.includes("@");

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body = isEmail
        ? { email: identifier, password }
        : { username: identifier, password };
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      const redirectPath = new URLSearchParams(window.location.search).get("redirect");
      const destination = redirectPath?.startsWith("/") && !redirectPath.startsWith("//")
        ? redirectPath
        : "/";
      router.push(destination);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="frida-auth-shell">
      <Card size="sm" className="frida-auth-card">
        <AuthCardBrand title="DomainCheck Admin" />
        <CardHeader className="pt-5">
          <CardTitle className="text-xl font-semibold text-[var(--frida-header-text)]">Sign in</CardTitle>
          <CardDescription>
            Enter your email (or username) and password to access your account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="identifier" className="text-sm font-medium">
                Email or Username
              </label>
              <Input
                id="identifier"
                type="text"
                placeholder="name@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button type="submit" className="h-10 w-full bg-[var(--frida-primary)] font-semibold text-white hover:bg-[var(--frida-gradient-start)]" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-foreground hover:underline">
                Register
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
