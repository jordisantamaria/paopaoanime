"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function NavLinks() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const links = [
    { href: "/", label: t("latestEpisodes") },
    { href: "/schedule", label: t("weeklySchedule") },
  ];

  return (
    <>
      {links.map((link) => {
        const isActive =
          link.href === "/"
            ? false
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm font-bold transition-colors ${
              isActive ? "text-white" : "text-white/70 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
