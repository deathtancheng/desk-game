"use client";

import { useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/types";
import { getMemberOf } from "@/lib/gameEngine";
import PawnIcon from "./PawnIcon";

interface ScoreboardProps {
  game: GameState;
  currentId?: string;
  phase?: GameState["phase"];
}

export default function Scoreboard({ game, currentId, phase = "action" }: ScoreboardProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const ordered = [...game.players].sort((a, b) => {
    if (Boolean(a.eliminated) !== Boolean(b.eliminated)) return a.eliminated ? 1 : -1;
    return b.gp - a.gp;
  });

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const check = () => setOverflow(rail.scrollWidth > rail.clientWidth + 2);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [game.players.length, currentId, phase]);

  return (
    <div className={`score-rail-shell ${overflow ? "is-overflow" : ""}`}>
      <div
        ref={railRef}
        className="score-rail chat-scroll"
        aria-label={`群地位积分轨，共 ${ordered.length} 人${overflow ? "，可左右滑动" : ""}`}
        tabIndex={overflow ? 0 : undefined}
      >
        <span className="score-rail-label">
          <PawnIcon className="h-3 w-3" />
          群地位
          <span className="score-rail-count">{ordered.length} 人</span>
        </span>
        {ordered.map((player, index) => {
          const member = getMemberOf(game, player);
          const active = phase === "action" && currentId === player.memberId && !player.eliminated;
          const out = Boolean(player.eliminated);
          return (
            <div
              key={player.memberId}
              className={`score-token ${active ? "active" : ""} ${out ? "out" : ""} ${index === 0 ? "first" : ""}`}
              title={`${member.name} · ${player.gp} 点${out ? " · 已出局" : active ? " · 正在行动" : ""}`}
            >
              <span className="score-rank">{index + 1}</span>
              <span className="score-avatar">{member.emoji}</span>
              <span className="score-name">{member.name}</span>
              {active && <PawnIcon className="score-pawn" />}
              <span className="score-gp">{player.gp}</span>
              {out ? (
                <span className="score-out">出局</span>
              ) : (
                !player.isHuman && <span className="score-ai">AI</span>
              )}
              {player.goalDone && <span className="score-goal">✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
