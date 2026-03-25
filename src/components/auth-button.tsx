"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export function AuthButton() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (status === "loading") {
    return <div className="h-7 w-7 rounded-full bg-white/20 animate-pulse" />;
  }

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="rounded bg-white/10 px-3 py-1 text-xs font-bold text-white hover:bg-white/20 transition-colors"
      >
        ログイン
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 cursor-pointer"
      >
        {session.user.image ? (
          <img
            src={session.user.image}
            alt=""
            className="h-7 w-7 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-40 rounded border border-border bg-bg-card text-text-primary shadow-lg z-50">
          <Link
            href="/drops"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm hover:bg-bg-card-hover"
          >
            切り捨てリスト
          </Link>
          <button
            onClick={() => signOut()}
            className="block w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-bg-card-hover cursor-pointer"
          >
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}
