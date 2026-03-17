"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "最新エピソード" },
  { href: "/schedule", label: "週間スケジュール" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => {
        const isActive =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm font-bold transition-opacity ${
              isActive ? "text-white" : "text-white/60 hover:text-white/90"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
