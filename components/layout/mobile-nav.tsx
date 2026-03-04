"use client";

import { useState } from "react";
import Link from "next/link";

const MOBILE_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/zone-performance", label: "Zone Performance", icon: "🗺️" },
  { href: "/data-quality", label: "Data Quality", icon: "🔍" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
  { href: "/upload", label: "Upload", icon: "📤" },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="mobile-menu-btn"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Toggle menu"
      >
        {isOpen ? "✕" : "☰"}
      </button>

      {isOpen && (
        <div className="mobile-menu-overlay" onClick={() => setIsOpen(false)}>
          <nav className="mobile-menu" onClick={(event) => event.stopPropagation()}>
            {MOBILE_LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)}>
                {link.icon} {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}