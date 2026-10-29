"use client";

import type { GameState } from "@/lib/types";
import { getMemberOf } from "@/lib/gameEngine";

interface ScoreboardProps {
  game: GameState;
  currentId?: string;
}

export default function Scoreboard({ game, currentId }: ScoreboardProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto chat-scroll pb-1">
      <span className="shrink-0 text-[9px] tracking-[0.16em] text-muted">群地位</span>
      {game.players.map((player) => {
        const member = getMemberOf(game, player);
        const active = currentId === player.memberId;
        return (
          <div
            key={player.memberId}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 ${
              active ? "border-neon/50 bg-neon/10" : "border-line/60 bg-panel2/40"
            }`}
          >
            <span className="text-sm">{member.emoji}</span>
            <span className="font-serif text-[10px] text-white/70">{member.name}</span>
            <span className="font-mono text-xs font-bold text-neon">{player.gp}</span>
            {!player.isHuman && <span className="rounded bg-white/5 px-1 text-[8px] text-muted">幽灵</span>}
            {player.goalDone && <span className="text-[9px] text-mint">✓</span>}
          </div>
        );
      })}
    </div>
  );
}
