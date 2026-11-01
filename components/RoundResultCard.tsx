"use client";

import type { GameState } from "@/lib/types";
import { getMemberOf } from "@/lib/gameEngine";

interface RoundResultCardProps {
  game: GameState;
  onNext: () => void;
  onSettle: () => void;
  readOnly?: boolean;
}

export default function RoundResultCard({ game, onNext, onSettle, readOnly = false }: RoundResultCardProps) {
  const result = game.lastResult;
  if (!result) return null;
  const done = game.phase === "done";
  const eliminated = new Set(result.eliminatedIds ?? []);
  const winner = result.winnerId ? game.players.find((player) => player.memberId === result.winnerId) : null;

  return (
    <div className="rounded-2xl border border-neon/30 bg-neon/[0.04] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-neon/15 px-2 py-0.5 text-[9px] tracking-[0.14em] text-neon">
            第 {result.round} / {game.config.maxEvents} 个事件结算
          </span>
          {result.judgeSource && (
            <span
              className={`rounded-full px-2 py-0.5 text-[8px] tracking-[0.1em] ${
                result.judgeSource === "llm" ? "bg-mint/10 text-mint" : "bg-white/5 text-muted"
              }`}
            >
              {result.judgeSource === "llm" ? "LLM 判定" : "本地兜底"}
            </span>
          )}
        </div>
        {done && <span className="text-[9px] text-mint">本局结束</span>}
      </div>

      <h3 className="mt-2 font-serif text-lg font-bold text-white">{result.headline}</h3>
      <p className="mt-1 text-[11px] leading-5 text-white/60">{result.detail}</p>

      {winner && done && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-mint/25 bg-mint/[0.05] px-3 py-2 text-[11px] text-mint">
          <span className="text-base">{getMemberOf(game, winner).emoji}</span>
          本局冠军 · {getMemberOf(game, winner).name} · {winner.gp} 点
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {game.players.map((player) => {
          const delta = result.deltas[player.memberId] ?? 0;
          const member = getMemberOf(game, player);
          const out = eliminated.has(player.memberId) || player.eliminated;
          return (
            <span
              key={player.memberId}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] ${
                out
                  ? "border-ember/25 bg-ember/[0.06] text-ember/80"
                  : delta > 0
                    ? "border-mint/25 bg-mint/[0.06] text-mint"
                    : delta < 0
                      ? "border-ember/25 bg-ember/[0.06] text-ember"
                      : "border-line/60 bg-panel2/40 text-white/45"
              }`}
            >
              {member.emoji} {member.name}
              <span className="font-mono font-bold">{delta > 0 ? `+${delta}` : delta}</span>
              {out && <span className="text-[8px]">出局</span>}
            </span>
          );
        })}
      </div>

      {result.lines.length > 0 && (
        <div className="chat-scroll mt-3 max-h-36 space-y-1.5 overflow-y-auto rounded-xl border border-line/50 bg-ink/30 p-2.5">
          {result.lines.slice(0, 8).map((line, index) => (
            <div key={`${line}-${index}`} className="flex gap-1.5 text-[10px] leading-4 text-white/55">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-neon/60" />
              {line}
            </div>
          ))}
        </div>
      )}

      {readOnly ? (
        <div className="mt-4 rounded-xl border border-dashed border-line/70 px-3 py-2.5 text-center text-[10px] leading-5 text-muted">
          {done ? "本局结束，等房主展示群年鉴…" : "等房主开始下一个事件…"}
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          {done ? (
            <button className="btn-primary flex-1 !py-2.5 text-xs" onClick={onSettle}>
              查看群年鉴
            </button>
          ) : (
            <button className="btn-primary flex-1 !py-2.5 text-xs" onClick={onNext}>
              下一个随机事件
            </button>
          )}
        </div>
      )}
    </div>
  );
}
