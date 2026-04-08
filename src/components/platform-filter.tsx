"use client";

import { PlatformId } from "@/lib/types";
import { platforms } from "@/lib/platforms";
import { PLATFORM_ORDER } from "@/lib/constants";

type Props = {
  available: PlatformId[];
  selected: PlatformId[];
  onChange: (selected: PlatformId[]) => void;
  preferences?: PlatformId[];
};

export function PlatformFilter({ available, selected, onChange, preferences = [] }: Props) {
  function toggle(pid: PlatformId) {
    if (selected.includes(pid)) {
      onChange(selected.filter((s) => s !== pid));
    } else {
      onChange([...selected, pid]);
    }
  }

  // Show preferred platforms first, then the rest in default order
  const orderedPlatforms = preferences.length > 0
    ? [
        ...preferences.filter((pid) => available.includes(pid)),
        ...PLATFORM_ORDER.filter((pid) => available.includes(pid) && !preferences.includes(pid)),
      ]
    : PLATFORM_ORDER.filter((pid) => available.includes(pid));

  return (
    <div className="flex flex-wrap gap-1.5">
      {orderedPlatforms.map((pid) => {
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
