"use client";

import { useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  const jaHref = pathname;
  const enHref = `/en${pathname}`;

  return (
    <div className="flex items-center gap-1 text-xs">
      <a
        href={jaHref}
        className={`px-1 ${locale === "ja" ? "text-accent font-bold" : "text-text-muted hover:text-text-primary"}`}
      >
        JA
      </a>
      <span className="text-text-muted">/</span>
      <a
        href={enHref}
        className={`px-1 ${locale === "en" ? "text-accent font-bold" : "text-text-muted hover:text-text-primary"}`}
      >
        EN
      </a>
    </div>
  );
}
