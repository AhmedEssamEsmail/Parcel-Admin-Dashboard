"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/raw-delivery-stages", label: "Raw Delivery Stages" },
  { href: "/upload", label: "Upload" },
  { href: "/schedule", label: "Schedule" },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="app-nav">
      <div className="app-nav__brand">Parcel Admin Dashboard</div>
      <nav className="app-nav__links">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname === link.href ? "active" : ""}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <button className="btn btn-ghost" onClick={logout} type="button">
        Logout
      </button>
    </header>
  );
}
