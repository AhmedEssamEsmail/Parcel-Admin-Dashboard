"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { MobileNav } from "@/components/layout/mobile-nav";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "??" },
  { href: "/zone-performance", label: "City Performance", icon: "???" },
  { href: "/exceptions", label: "Exceptions", icon: "??" },
  { href: "/promise-reliability", label: "Promise Reliability", icon: "??" },
  { href: "/route-efficiency", label: "Route Efficiency", icon: "???" },
  { href: "/data-quality", label: "Data Quality", icon: "??" },
  { href: "/raw-delivery-stages", label: "Raw Delivery Stages", icon: "??" },
  { href: "/upload", label: "Upload", icon: "??" },
  { href: "/schedule", label: "Schedule", icon: "???" },
  { href: "/settings", label: "Settings", icon: "??" },
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
      <div className="app-nav__mobile-left">
        <MobileNav links={LINKS} activePath={pathname} onLogout={logout} />
        <div className="app-nav__brand">Parcel Admin Dashboard</div>
      </div>
      <nav className="app-nav__links">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""}>
            {link.label}
          </Link>
        ))}
      </nav>
      <button className="btn btn-ghost app-nav__logout-desktop" onClick={logout} type="button">
        Logout
      </button>
    </header>
  );
}
