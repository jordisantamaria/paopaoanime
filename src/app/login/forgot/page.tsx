"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/actions/reset-password";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await requestPasswordReset(email);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="rounded-lg bg-bg-card border border-border p-8">
          <svg className="mx-auto mb-4 h-12 w-12 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
          <h1 className="text-xl font-bold mb-2">メールを確認してください</h1>
          <p className="text-sm text-text-secondary leading-relaxed mb-6">
            アカウントが存在する場合、パスワードリセット用の<br />リンクをメールで送信しました。
          </p>
          <Link href="/login" className="text-sm text-accent hover:underline">
            ログインページに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-10 sm:py-16">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">パスワードをリセット</h1>
        <p className="text-sm text-text-secondary leading-relaxed">
          登録したメールアドレスを入力してください。<br />リセット用のリンクを送信します。
        </p>
      </div>

      <div className="rounded-lg bg-bg-card border border-border p-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            className="w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-accent px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent/90 cursor-pointer disabled:opacity-50"
          >
            {loading ? "送信中..." : "リセットリンクを送信"}
          </button>
        </form>

        <p className="text-center text-xs text-text-muted pt-3">
          <Link href="/login" className="text-accent hover:underline">
            ログインページに戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
