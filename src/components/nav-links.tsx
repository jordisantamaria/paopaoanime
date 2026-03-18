"use client";

import Link from "next/link";

const links = [
  { href: "/", label: "最新エピソード" },
  { href: "/schedule", label: "週間スケジュール" },
];

export function NavLinks() {
  return (
    <>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-sm font-bold text-white/70 hover:text-white transition-colors"
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}
