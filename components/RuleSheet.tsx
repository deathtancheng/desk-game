"use client";

import { useState } from "react";

interface RuleSheetProps {
  title: string;
  lines: string[];
}

export default function RuleSheet({ title, lines }: RuleSheetProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-neon/20 bg-neon/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold text-neon">
          <span>📌</span>
          群公告 · {title}
        </span>
        <span className="text-[9px] text-muted">{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <ul className="space-y-1.5 border-t border-neon/10 px-3 pb-3 pt-2.5">
          {lines.map((line, index) => (
            <li key={line} className="flex gap-2 text-[10px] leading-4 text-white/60">
              <span className="font-mono text-[9px] text-neon">{index + 1}.</span>
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
