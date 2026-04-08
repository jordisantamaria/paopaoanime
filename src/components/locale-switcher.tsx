"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: "ja" | "en") {
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <div className="flex items-center gap-1 text-xs">
      <button
        onClick={() => switchLocale("ja")}
        className={`cursor-pointer px-1 ${locale === "ja" ? "text-accent font-bold" : "text-text-muted hover:text-text-primary"}`}
      >
        JA
      </button>
      <span className="text-text-muted">/</span>
      <button
        onClick={() => switchLocale("en")}
        className={`cursor-pointer px-1 ${locale === "en" ? "text-accent font-bold" : "text-text-muted hover:text-text-primary"}`}
      >
        EN
      </button>
    </div>
  );
}
