"use client";

import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="mb-4 inline-block text-sm text-accent hover:text-accent-hover cursor-pointer"
    >
      &larr; 戻る
    </button>
  );
}
