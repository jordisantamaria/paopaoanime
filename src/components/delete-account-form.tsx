"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/actions/user";
import { signOut } from "next-auth/react";

export function DeleteAccountForm() {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, startDeleting] = useTransition();

  function handleDelete() {
    startDeleting(async () => {
      await deleteAccount();
      await signOut({ callbackUrl: "/" });
    });
  }

  return (
    <div className="rounded border border-red-500/30 bg-red-500/5 p-5">
      <h2 className="text-sm font-bold text-red-400">アカウント削除</h2>
      <p className="mt-2 text-xs text-text-secondary">
        アカウントを削除すると、すべてのデータ（切り捨てリスト、プラットフォーム設定など）が完全に削除されます。この操作は取り消せません。
      </p>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="mt-4 rounded bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 cursor-pointer transition-colors"
        >
          アカウントを削除する
        </button>
      ) : (
        <div className="mt-4">
          <p className="mb-2 text-xs text-text-primary">
            確認のため「<span className="font-bold">削除</span>」と入力してください：
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded border border-red-500/30 bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-red-500 focus:outline-none"
            placeholder="削除"
            autoFocus
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleDelete}
              disabled={confirmText !== "削除" || deleting}
              className="rounded bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {deleting ? "削除中..." : "完全に削除する"}
            </button>
            <button
              onClick={() => {
                setConfirming(false);
                setConfirmText("");
              }}
              className="rounded border border-border px-4 py-2 text-sm text-text-muted hover:text-text-primary cursor-pointer transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
