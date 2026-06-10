"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { AuthCardBrand } from "@/components/layout/auth-card-brand";

export default function ActivatePage() {
  const params = useParams();
  const token = params.token as string;
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function activate() {
      try {
        const res = await fetch(`/api/auth/activate/${token}`);
        const data = await res.json();

        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "Account activated successfully. You can now log in.");
        } else {
          setStatus("error");
          setMessage(data.error || "Activation failed. The link may be invalid or expired.");
        }
      } catch {
        setStatus("error");
        setMessage("An unexpected error occurred. Please try again.");
      }
    }

    if (token) {
      activate();
    } else {
      setStatus("error");
      setMessage("Invalid activation link.");
    }
  }, [token]);

  return (
    <div className="frida-auth-shell">
      <Card size="sm" className="frida-auth-card">
        <AuthCardBrand title="Account Activation" />
        <CardHeader className="pt-5">
          <CardTitle>Account Activation</CardTitle>
          <CardDescription>
            {status === "loading" ? "Verifying your activation link..." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" && (
            <div className="flex items-center justify-center py-4">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          {status === "success" && (
            <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
              {message}
            </div>
          )}
          {status === "error" && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {message}
            </div>
          )}
        </CardContent>
        {status !== "loading" && (
          <CardFooter>
            <Link href="/login" className="w-full">
              <Button className="h-10 w-full">
                {status === "success" ? "Sign in" : "Back to login"}
              </Button>
            </Link>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
