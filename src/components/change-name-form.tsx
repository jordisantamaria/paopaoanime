"use client";

import { useState, useTransition } from "react";
import { updateUserName } from "@/actions/user";

type Props = {
  initialName: string;
};

export function ChangeNameForm({ initialName }: Props) {
  const [name, setName] = useState(initialName);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);

  const isDirty = name.trim() !== initialName;

  function handleSave() {
    setSaved(false);
    startSaving(async () => {
      await updateUserName(name);
      setSaved(true);
    });
  }

  return (
    <div>
      <h2 className="mb-2 text-sm font-bold text-text-primary">表示名</h2>
      <input
        type="text"
        value={name}
        onChange={(e) => {
          setSaved(false);
          setName(e.target.value);
        }}
        className="w-full rounded border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
        maxLength={100}
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !isDirty || name.trim().length === 0}
          className="rounded bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent/90 disabled:opacity-50 cursor-pointer transition-colors"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        {saved && (
          <span className="text-sm text-green-400">保存しました</span>
        )}
      </div>
    </div>
  );
}
