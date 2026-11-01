"use client";

import { useState } from "react";

interface RuleSheetProps {
  title: string;
  lines: string[];
}

export default function RuleSheet({ title, lines }: RuleSheetProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rule-sheet">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-[10px] font-semibold text-[#a9452f]">
          <span aria-hidden>📌</span>
          事件规则 · {title}
        </span>
        <span className="text-[8px] text-[#8b7358]">{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <ul className="space-y-1.5 border-t px-3 pb-3 pt-2.5">
          {lines.map((line, index) => (
            <li key={line} className="flex gap-2 text-[10px] leading-4 text-[#5e4d3b]">
              <span className="font-mono text-[9px] text-[#a9452f]">{index + 1}.</span>
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
