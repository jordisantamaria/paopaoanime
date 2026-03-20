"use client";

import { PlatformId } from "@/lib/types";
import { platforms } from "@/lib/platforms";
import { PLATFORM_ORDER } from "@/lib/constants";

type Props = {
  available: PlatformId[];
  selected: PlatformId[];
  onChange: (selected: PlatformId[]) => void;
};

export function PlatformFilter({ available, selected, onChange }: Props) {
  function toggle(pid: PlatformId) {
    if (selected.includes(pid)) {
      onChange(selected.filter((s) => s !== pid));
    } else {
      onChange([...selected, pid]);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {PLATFORM_ORDER.filter((pid) => available.includes(pid)).map((pid) => {
        const p = platforms[pid];
        const isActive = selected.includes(pid);
        return (
          <button
            key={pid}
            onClick={() => toggle(pid)}
            className={`cursor-pointer rounded-sm px-2.5 py-1 text-xs font-bold transition-colors border ${
              isActive
                ? "bg-accent text-white border-accent"
                : "bg-bg-card text-text-muted border-border hover:text-accent hover:border-accent"
            }`}
          >
            {p.name}
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="cursor-pointer rounded-sm px-2 py-1 text-xs text-text-muted hover:text-accent"
        >
          クリア
        </button>
      )}
    </div>
  );
}
