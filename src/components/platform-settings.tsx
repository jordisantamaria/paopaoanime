"use client";

import { useState, useTransition } from "react";
import { PlatformId } from "@/lib/types";
import { platforms } from "@/lib/platforms";
import { PLATFORM_ORDER } from "@/lib/constants";
import { savePlatformPreferences } from "@/actions/platform-preferences";

type Props = {
  initialPreferences: PlatformId[];
};

export function PlatformSettings({ initialPreferences }: Props) {
  const [preferred, setPreferred] = useState<PlatformId[]>(initialPreferences);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);

  // Platforms not yet in the preferred list
  const remaining = PLATFORM_ORDER.filter((p) => !preferred.includes(p));

  function addPlatform(pid: PlatformId) {
    setSaved(false);
    setPreferred((prev) => [...prev, pid]);
  }

  function removePlatform(pid: PlatformId) {
    setSaved(false);
    setPreferred((prev) => prev.filter((p) => p !== pid));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setSaved(false);
    setPreferred((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setSaved(false);
    setPreferred((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function handleSave() {
    startSaving(async () => {
      await savePlatformPreferences(preferred);
      setSaved(true);
    });
  }

  return (
    <div>
      <h2 className="mb-2 text-sm font-bold text-text-primary">
        利用プラットフォーム
      </h2>
      <p className="mb-4 text-xs text-text-muted">
        使っているプラットフォームを選んで優先順に並べると、ホーム画面でそのプラットフォームのアニメが上に表示されます。
      </p>

      {/* Selected platforms - ordered */}
      {preferred.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {preferred.map((pid, i) => {
            const p = platforms[pid];
            return (
              <div
                key={pid}
                className="flex items-center gap-2 rounded border border-accent/30 bg-bg-card px-3 py-2"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="text-sm font-bold text-text-primary flex-1">
                  {p.name}
                </span>
                <button
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="text-xs text-text-muted hover:text-accent disabled:opacity-30 cursor-pointer disabled:cursor-default"
                  title="上に移動"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveDown(i)}
                  disabled={i === preferred.length - 1}
                  className="text-xs text-text-muted hover:text-accent disabled:opacity-30 cursor-pointer disabled:cursor-default"
                  title="下に移動"
                >
                  ▼
                </button>
                <button
                  onClick={() => removePlatform(pid)}
                  className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
                  title="削除"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Available platforms to add */}
      {remaining.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-xs text-text-muted">追加:</p>
          <div className="flex flex-wrap gap-1.5">
            {remaining.map((pid) => {
              const p = platforms[pid];
              return (
                <button
                  key={pid}
                  onClick={() => addPlatform(pid)}
                  className="flex items-center gap-1.5 rounded-sm border border-border bg-bg-card px-2.5 py-1 text-xs text-text-muted hover:border-accent hover:text-accent cursor-pointer transition-colors"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent/90 disabled:opacity-50 cursor-pointer transition-colors"
      >
        {saving ? "保存中..." : "保存"}
      </button>
      {saved && (
        <span className="ml-3 text-sm text-green-400">保存しました</span>
      )}
    </div>
  );
}
