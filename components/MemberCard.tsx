"use client";

import type { Member, PlayerState } from "@/lib/types";

interface MemberCardProps {
  member: Member;
  isHuman: boolean;
  onToggle?: () => void;
  player?: PlayerState;
  highlight?: boolean;
  compact?: boolean;
}

const STAT_LABELS: { key: keyof Member["stats"]; label: string }[] = [
  { key: "influence", label: "影响" },
  { key: "reliability", label: "靠谱" },
  { key: "mystery", label: "神秘" },
  { key: "scapegoat", label: "背锅" },
];

export default function MemberCard({ member, isHuman, onToggle, player, highlight, compact }: MemberCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-xl ${
              isHuman
                ? "border-neon/50 bg-neon/10 shadow-neon"
                : "border-dashed border-white/20 bg-white/[0.03] opacity-80"
            }`}
          >
            {member.emoji}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-sm font-bold text-white/90">{member.name}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                  isHuman ? "bg-neon/15 text-neon" : "bg-white/5 text-muted"
                }`}
              >
                {isHuman ? "真人" : "幽灵群友"}
              </span>
            </div>
            <div className="mt-0.5 font-serif text-[10px] italic text-muted">{member.quote}</div>
          </div>
        </div>
        {player && (
          <div className="text-right">
            <div className="font-mono text-lg font-black text-neon">{player.gp}</div>
            <div className="text-[9px] tracking-[0.12em] text-muted">群地位</div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {member.tags.map((tag) => (
          <span key={tag} className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-white/55">
            {tag}
          </span>
        ))}
      </div>

      {!compact && (
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {STAT_LABELS.map((stat) => (
            <div key={stat.key} className="rounded-lg border border-line/50 bg-ink/30 px-1.5 py-1.5 text-center">
              <div className="font-mono text-[11px] font-bold text-white/80">{member.stats[stat.key]}</div>
              <div className="text-[8px] tracking-[0.08em] text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {player && (
        <div className="mt-3 rounded-lg border border-line/50 bg-ink/30 px-2.5 py-2">
          <div className="text-[9px] tracking-[0.1em] text-muted">隐藏诉求</div>
          <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px]">
            <span className={player.goalDone ? "text-mint" : "text-white/70"}>{player.goalText}</span>
            <span className={player.goalDone ? "text-mint" : "text-white/30"}>{player.goalDone ? "达成 +3" : "未达成"}</span>
          </div>
        </div>
      )}

      {highlight && (
        <div className="mt-3 flex items-center gap-1.5 text-[9px] text-neon">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon" />
          正在行动
        </div>
      )}
    </>
  );

  const className = `relative w-full rounded-2xl border p-3.5 text-left transition ${
    isHuman
      ? "border-neon/35 bg-neon/[0.04] hover:border-neon/60"
      : "border-line/70 bg-panel2/40 hover:border-white/20"
  } ${highlight ? "ring-1 ring-neon/40" : ""}`;

  if (onToggle) {
    return (
      <button type="button" className={className} onClick={onToggle}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
