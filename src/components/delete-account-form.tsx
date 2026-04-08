"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/actions/user";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";

export function DeleteAccountForm() {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, startDeleting] = useTransition();
  const t = useTranslations("deleteAccount");

  function handleDelete() {
    startDeleting(async () => {
      await deleteAccount();
      await signOut({ callbackUrl: "/" });
    });
  }

  return (
    <div className="rounded border border-red-500/30 bg-red-500/5 p-5">
      <h2 className="text-sm font-bold text-red-400">{t("title")}</h2>
      <p className="mt-2 text-xs text-text-secondary">
        {t("description")}
      </p>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="mt-4 rounded bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 cursor-pointer transition-colors"
        >
          {t("deleteButton")}
        </button>
      ) : (
        <div className="mt-4">
          <p className="mb-2 text-xs text-text-primary">
            {t("confirmPrompt", { word: t("confirmWord") })}
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded border border-red-500/30 bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-red-500 focus:outline-none"
            placeholder={t("confirmWord")}
            autoFocus
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleDelete}
              disabled={confirmText !== t("confirmWord") || deleting}
              className="rounded bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {deleting ? t("deleting") : t("confirmDelete")}
            </button>
            <button
              onClick={() => {
                setConfirming(false);
                setConfirmText("");
              }}
              className="rounded border border-border px-4 py-2 text-sm text-text-muted hover:text-text-primary cursor-pointer transition-colors"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
