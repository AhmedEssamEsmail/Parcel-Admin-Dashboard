"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { MobileNav } from "@/components/layout/mobile-nav";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/zone-performance", label: "Zone Performance" },
  { href: "/data-quality", label: "Data Quality" },
  { href: "/raw-delivery-stages", label: "Raw Delivery Stages" },
  { href: "/upload", label: "Upload" },
  { href: "/schedule", label: "Schedule" },
  { href: "/settings", label: "Settings" },
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
      <MobileNav />
      <button className="btn btn-ghost" onClick={logout} type="button">
        Logout
      </button>
    </header>
  );
}
