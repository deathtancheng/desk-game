"use client";

import {
  activePlayers,
  getCurrentPlan,
  getCurrentRuleType,
  getRoundPrompt,
} from "@/lib/gameEngine";
import type { GameState } from "@/lib/types";

const KIND_LABEL = {
  negotiation: "谈判",
  bidding: "竞标",
  escape: "逃脱",
} as const;

const pad = (value: number) => String(value).padStart(2, "0");

export default function EventCard({ game, className = "" }: { game: GameState; className?: string }) {
  const active = activePlayers(game);
  const kind = getCurrentRuleType(game);
  const plan = getCurrentPlan(game);
  const prompt = getRoundPrompt(game.config, game.round, active.length);
  const noElimination = plan?.twist?.key === "amnesty";

  return (
    <div className={`event-deck ${className}`}>
      <div className="event-card">
        <span className="event-card-pin" aria-hidden />
        <div className="event-card-top">
          <span className="event-card-number">
            EVENT <b>{pad(game.round)}</b> / {pad(game.config.maxEvents)}
          </span>
          <span className="event-seal">{KIND_LABEL[kind]}</span>
        </div>

        <div className="event-card-kicker">{prompt.badge} · 第 {game.round} 张事件牌</div>
        <h2 className="event-card-title">{prompt.title}</h2>
        <p className="event-card-sub">{prompt.subtitle}</p>
        {plan?.stakes && <p className="event-card-stakes">{plan.stakes}</p>}

        {(plan?.twist || plan?.bounty) && (
          <div className="event-card-stamps">
            {plan?.twist && (
              <div className="event-stamp twist">
                <div className="event-stamp-label">变数 · {plan.twist.title}</div>
                <p>{plan.twist.desc}</p>
              </div>
            )}
            {plan?.bounty && (
              <div className="event-stamp bounty">
                <div className="event-stamp-label">悬赏 · {plan.bounty.title}</div>
                <p>{plan.bounty.desc}</p>
              </div>
            )}
          </div>
        )}

        <div className="event-card-foot">
          <span className="event-card-rule">
            <i aria-hidden />
            {noElimination ? "本事件缓刑 · 无人出局" : "结算后最低分出局"}
          </span>
          <span className="event-card-remain">
            <b>{active.length}</b> 人留在桌上
          </span>
        </div>
      </div>
    </div>
  );
}
