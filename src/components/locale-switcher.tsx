"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchLocale(target: "ja" | "en") {
    startTransition(() => {
      router.replace(pathname, { locale: target });
    });
  }

  return (
    <div className={`flex items-center gap-1 text-xs ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
      <button
        onClick={() => switchLocale("ja")}
        className={`px-1 cursor-pointer ${locale === "ja" ? "text-accent font-bold" : "text-text-muted hover:text-text-primary"}`}
      >
        JA
      </button>
      <span className="text-text-muted">/</span>
      <button
        onClick={() => switchLocale("en")}
        className={`px-1 cursor-pointer ${locale === "en" ? "text-accent font-bold" : "text-text-muted hover:text-text-primary"}`}
      >
        EN
      </button>
    </div>
  );
}
