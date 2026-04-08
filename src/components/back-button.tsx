"use client";

import { useTranslations } from "next-intl";

export function BackButton() {
  const t = useTranslations("common");

  return (
    <button
      onClick={() => {
        if (window.history.length > 1 && document.referrer.includes(window.location.host)) {
          window.history.back();
        } else {
          window.location.href = "/";
        }
      }}
      className="mb-4 inline-block text-sm text-accent hover:text-accent-hover cursor-pointer"
    >
      &larr; {t("back")}
    </button>
  );
}
