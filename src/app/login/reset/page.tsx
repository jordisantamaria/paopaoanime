"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/actions/reset-password";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!token || !email) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="rounded-lg bg-bg-card border border-border p-8">
          <h1 className="text-xl font-bold mb-2">無効なリンク</h1>
          <p className="text-sm text-text-secondary mb-6">このリセットリンクは無効です。</p>
          <Link href="/login/forgot" className="text-sm text-accent hover:underline">
            もう一度リセットを申請する
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="rounded-lg bg-bg-card border border-border p-8">
          <svg className="mx-auto mb-4 h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <h1 className="text-xl font-bold mb-2">パスワードを変更しました</h1>
          <p className="text-sm text-text-secondary mb-6">新しいパスワードでログインしてください。</p>
          <Link
            href="/login"
            className="inline-block rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-white hover:bg-accent/90"
          >
            ログインへ
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await resetPassword(email, token, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setDone(true);
  }

  return (
    <div className="mx-auto max-w-md py-10 sm:py-16">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">新しいパスワードを設定</h1>
      </div>

      <div className="rounded-lg bg-bg-card border border-border p-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="新しいパスワード（8文字以上）"
            className="w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-accent px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent/90 cursor-pointer disabled:opacity-50"
          >
            {loading ? "処理中..." : "パスワードを変更"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    }>
      <ResetForm />
    </Suspense>
  );
}
