"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { MobileNav } from "@/components/layout/mobile-nav";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "DB" },
  { href: "/zone-performance", label: "City Performance", icon: "CP" },
  { href: "/exceptions", label: "Exceptions", icon: "EX" },
  { href: "/promise-reliability", label: "Promise Reliability", icon: "PR" },
  { href: "/route-efficiency", label: "Route Efficiency", icon: "RE" },
  { href: "/raw-delivery-stages", label: "Raw Delivery Stages", icon: "RD" },
  { href: "/volume", label: "Volume", icon: "VO" },
  { href: "/distributions", label: "Distributions", icon: "DI" },
  { href: "/settings", label: "Settings", icon: "ST" },
];

function withGlobalParams(href: string, searchParams: URLSearchParams): string {
  const nextParams = new URLSearchParams();
  const warehouse = searchParams.get("warehouse");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (warehouse) nextParams.set("warehouse", warehouse);
  if (from) nextParams.set("from", from);
  if (to) nextParams.set("to", to);

  const query = nextParams.toString();
  return query ? `${href}?${query}` : href;
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const normalizedPathname = pathname.startsWith("/settings/") ? "/settings" : pathname;
  const serializedParams =
    typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="app-nav">
      <div className="app-nav__mobile-left">
        <MobileNav links={LINKS.map((link) => ({ ...link, href: withGlobalParams(link.href, serializedParams) }))} activePath={normalizedPathname} onLogout={logout} />
        <div className="app-nav__brand">Parcel Admin Dashboard</div>
      </div>
      <nav className="app-nav__links">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={withGlobalParams(link.href, serializedParams)}
            className={normalizedPathname === link.href ? "active" : ""}
          >
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
