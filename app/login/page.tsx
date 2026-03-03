"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState("/dashboard");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(params.get("next") || "/dashboard");
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Login failed.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>Parcel Admin Dashboard</h1>
        <p className="muted">Enter the shared password to continue.</p>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="btn" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
