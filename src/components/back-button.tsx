"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        if (window.history.length > 1 && document.referrer.includes(window.location.host)) {
          router.back();
        } else {
          router.push("/");
        }
      }}
      className="mb-4 inline-block text-sm text-accent hover:text-accent-hover cursor-pointer"
    >
      &larr; 戻る
    </button>
  );
}
