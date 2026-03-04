"use client";

import Link from "next/link";
import { useState } from "react";

type MobileNavLink = {
  href: string;
  label: string;
  icon: string;
};

type MobileNavProps = {
  links: MobileNavLink[];
  activePath: string;
  onLogout: () => Promise<void>;
};

export function MobileNav({ links, activePath, onLogout }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="mobile-menu-btn"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Toggle menu"
        type="button"
      >
        {isOpen ? "✕" : "☰"}
      </button>

      {isOpen && (
        <div className="mobile-menu-overlay" onClick={() => setIsOpen(false)}>
          <nav className="mobile-menu" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-menu__links">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={activePath === link.href ? "active" : ""}
                  onClick={() => setIsOpen(false)}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              ))}
            </div>

            <div className="mobile-menu__footer">
              <button
                className="mobile-menu__logout"
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  void onLogout();
                }}
              >
                Logout
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
