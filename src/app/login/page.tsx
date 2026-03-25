"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signup } from "@/actions/signup";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user) router.replace("/drops");
  }, [session, router]);

  if (status === "loading" || session?.user) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignup) {
        const result = await signup(email, password);
        if (result.error) {
          setError(result.error);
          setLoading(false);
          return;
        }
      }

      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(isSignup ? "アカウント作成後のログインに失敗しました。" : "メールアドレスまたはパスワードが正しくありません。");
        setLoading(false);
        return;
      }

      router.replace("/drops");
    } catch {
      setError("エラーが発生しました。もう一度お試しください。");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-10 sm:py-16">
      <div className="text-center mb-8">
        <img src="/logo.png" alt="PaoPaoAnime" className="h-10 w-auto mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">
          {isSignup ? "アカウント作成" : "PaoPaoAnimeにログイン"}
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed">
          ログインすると、もっと便利にアニメを管理できます。
        </p>
      </div>

      <div className="rounded-lg bg-bg-card border border-border p-6 mb-6">
        <div className="space-y-3">
          <button
            onClick={() => signIn("google", { callbackUrl: "/drops" })}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-white px-4 py-3 text-sm font-bold text-gray-800 transition-colors hover:bg-gray-50 cursor-pointer"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Googleで{isSignup ? "登録" : "ログイン"}
          </button>

          <div className="flex items-center gap-3 text-text-muted text-xs">
            <div className="flex-1 border-t border-border" />
            <span>または</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3" action="/login">
            <input
              type="email"
              id="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス"
              autoComplete="email"
              className="w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <input
              type="password"
              id="password"
              name="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? "パスワード（8文字以上）" : "パスワード"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              className="w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />

            {!isSignup && (
              <div className="text-right">
                <a href="/login/forgot" className="text-xs text-text-muted hover:text-accent">
                  パスワードをお忘れですか？
                </a>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-accent px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent/90 cursor-pointer disabled:opacity-50"
            >
              {loading ? "処理中..." : isSignup ? "アカウント作成" : "ログイン"}
            </button>
          </form>

          <p className="text-center text-xs text-text-muted pt-1">
            {isSignup ? "既にアカウントをお持ちですか？" : "アカウントをお持ちでないですか？"}{" "}
            <button
              type="button"
              onClick={() => { setIsSignup(!isSignup); setError(""); }}
              className="text-accent hover:underline cursor-pointer"
            >
              {isSignup ? "ログイン" : "新規登録"}
            </button>
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-bg-card border border-border p-5">
        <h2 className="text-sm font-bold mb-3">ログインするとできること</h2>
        <ul className="space-y-3">
          <li className="flex gap-3 text-sm text-text-secondary">
            <span className="shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent/15 text-accent text-xs font-bold">1</span>
            <div>
              <span className="font-bold text-text-primary">興味のないアニメを非表示</span>
              <br />
              <span className="text-xs text-text-muted">見ないアニメをホーム画面から隠して、自分だけのリストに。</span>
            </div>
          </li>
          <li className="flex gap-3 text-sm text-text-secondary">
            <span className="shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent/15 text-accent text-xs font-bold">2</span>
            <div>
              <span className="font-bold text-text-primary">最新エピソードをすばやく確認</span>
              <br />
              <span className="text-xs text-text-muted">非表示にした作品を除外して、見たいアニメだけチェック。</span>
            </div>
          </li>
          <li className="flex gap-3 text-sm text-text-secondary">
            <span className="shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent/15 text-accent text-xs font-bold">3</span>
            <div>
              <span className="font-bold text-text-primary">今後の新機能もいち早く</span>
              <br />
              <span className="text-xs text-text-muted">お気に入り登録や通知など、便利な機能を追加予定。</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
