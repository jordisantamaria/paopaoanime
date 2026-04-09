"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 text-xs">
      <Link
        href={pathname}
        locale="ja"
        className={`px-1 ${locale === "ja" ? "text-accent font-bold" : "text-text-muted hover:text-text-primary"}`}
      >
        JA
      </Link>
      <span className="text-text-muted">/</span>
      <Link
        href={pathname}
        locale="en"
        className={`px-1 ${locale === "en" ? "text-accent font-bold" : "text-text-muted hover:text-text-primary"}`}
      >
        EN
      </Link>
    </div>
  );
}
