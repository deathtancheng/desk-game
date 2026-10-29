"use client";

import { useEffect, useState } from "react";
import { getMemberOf } from "@/lib/gameEngine";
import type { ActionChoice, GameState, PlayerState } from "@/lib/types";

interface ActionPanelProps {
  game: GameState;
  player: PlayerState;
  onAction: (choice: ActionChoice) => void;
  onShowGoal: () => void;
}

type Mode = "idle" | "propose" | "meme" | "blame" | "coalition";

function Tile({
  title,
  desc,
  active,
  onClick,
  tone = "normal",
}: {
  title: string;
  desc: string;
  active?: boolean;
  onClick: () => void;
  tone?: "normal" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-left transition ${
        active
          ? "border-neon/60 bg-neon/10"
          : tone === "danger"
            ? "border-ember/25 bg-ember/[0.04] hover:border-ember/50"
            : "border-line bg-panel2/50 hover:border-neon/40"
      }`}
    >
      <div className="text-xs font-semibold text-white/85">{title}</div>
      <div className="mt-0.5 text-[9px] leading-4 text-muted">{desc}</div>
    </button>
  );
}

export default function ActionPanel({ game, player, onAction, onShowGoal }: ActionPanelProps) {
  const member = getMemberOf(game, player);
  const [mode, setMode] = useState<Mode>("idle");
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState(1);
  const [bid, setBid] = useState(1);
  const [contribution, setContribution] = useState(1);

  const others = game.players.filter((item) => item.memberId !== player.memberId);
  const lot = game.config.lots[game.round - 1] ?? game.config.lots[game.config.lots.length - 1];
  const challenge =
    game.config.challenges[game.round - 1] ?? game.config.challenges[game.config.challenges.length - 1];
  const privateValue = lot?.values[player.memberId] ?? 1;

  useEffect(() => {
    setMode("idle");
    setTargetId("");
    setAmount(1);
    setBid(1);
    setContribution(1);
  }, [player.memberId, game.round]);

  if (player.played) {
    return (
      <div className="rounded-xl border border-line/60 bg-panel2/40 p-4">
        <div className="text-xs font-semibold text-white/70">已提交，等待其他群友……</div>
        <div className="mt-1 text-[10px] leading-5 text-muted">
          幽灵群友会按人设出牌；所有人出完后，群主统一揭晓。
        </div>
      </div>
    );
  }

  const pickMode = (next: Mode) => {
    setMode(next);
    if (!targetId) setTargetId(others[0]?.memberId ?? "");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-line/60 bg-panel2/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{member.emoji}</span>
          <div>
            <div className="text-xs font-bold text-white/85">{member.name} 的回合</div>
            <div className="text-[9px] text-muted">{member.tags.join(" / ")}</div>
          </div>
        </div>
        <button type="button" className="btn-ghost !px-2.5 !py-1.5 text-[10px]" onClick={onShowGoal}>
          看隐藏诉求
        </button>
      </div>

      {game.config.ruleType === "negotiation" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Tile
              title="提议"
              desc="指定一个人接活"
              active={mode === "propose"}
              onClick={() => pickMode("propose")}
            />
            <Tile title="附议" desc="支持当前提案" onClick={() => onAction({ kind: "support" })} />
            <Tile title="自荐" desc="我来，拿 1 点补偿" onClick={() => onAction({ kind: "volunteer" })} />
            <Tile title="梗料" desc="用真实群梗施压" active={mode === "meme"} onClick={() => pickMode("meme")} />
            <Tile title="装死" desc="弃权，等下一位" tone="danger" onClick={() => onAction({ kind: "pass" })} />
          </div>

          {mode === "propose" && (
            <div className="rounded-xl border border-neon/20 bg-neon/[0.03] p-3">
              <div className="text-[10px] font-semibold text-neon">选一个接活的人</div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {others.map((item) => {
                  const target = getMemberOf(game, item);
                  return (
                    <button
                      key={item.memberId}
                      type="button"
                      onClick={() => setTargetId(item.memberId)}
                      className={`rounded-lg border px-1.5 py-2 text-[10px] transition ${
                        targetId === item.memberId
                          ? "border-neon/60 bg-neon/10 text-neon"
                          : "border-line/60 bg-ink/30 text-white/65"
                      }`}
                    >
                      <div className="text-base">{target.emoji}</div>
                      <div className="mt-0.5">{target.name}</div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 text-[10px] font-semibold text-neon">补偿点数</div>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAmount(value)}
                    className={`rounded-lg border px-2 py-1.5 text-[10px] transition ${
                      amount === value
                        ? "border-neon/60 bg-neon/10 text-neon"
                        : "border-line/60 bg-ink/30 text-white/60"
                    }`}
                  >
                    {value} 点
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn-primary mt-3 w-full !py-2 text-xs"
                disabled={!targetId}
                onClick={() => onAction({ kind: "propose", targetId, amount })}
              >
                发出提案
              </button>
            </div>
          )}

          {mode === "meme" && (
            <div className="rounded-xl border border-ember/20 bg-ember/[0.03] p-3">
              <div className="text-[10px] font-semibold text-ember">把谁的梗料甩出来？</div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {others.map((item) => {
                  const target = getMemberOf(game, item);
                  return (
                    <button
                      key={item.memberId}
                      type="button"
                      onClick={() => setTargetId(item.memberId)}
                      className={`rounded-lg border px-1.5 py-2 text-[10px] transition ${
                        targetId === item.memberId
                          ? "border-ember/60 bg-ember/10 text-ember"
                          : "border-line/60 bg-ink/30 text-white/65"
                      }`}
                    >
                      <div className="text-base">{target.emoji}</div>
                      <div className="mt-0.5">{target.name}</div>
                      <div className="mt-0.5 truncate text-[8px] text-muted">「{target.meme}」</div>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="btn-ghost mt-3 w-full !py-2 text-xs"
                disabled={!targetId}
                onClick={() => onAction({ kind: "meme", targetId })}
              >
                甩出梗料
              </button>
            </div>
          )}

          <p className="text-[9px] leading-4 text-muted">
            人设提示：像你的标签 +1，出戏 -1。当前标签：{member.tags.join(" / ")}。
          </p>
        </>
      )}

      {game.config.ruleType === "bidding" && lot && (
        <>
          <div className="rounded-xl border border-line/60 bg-ink/30 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-white/85">{lot.name}</div>
              <span className="pill">本回合拍品</span>
            </div>
            <p className="mt-1 text-[10px] leading-5 text-muted">{lot.flavor}</p>
            <div className="mt-2.5 rounded-lg border border-neon/20 bg-neon/[0.05] px-2.5 py-2 text-[10px] text-neon">
              你的隐藏估值：{privateValue} 点（只有你看得到）
            </div>
          </div>

          <div className="rounded-xl border border-neon/20 bg-neon/[0.03] p-3">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold text-neon">暗标</span>
              <span className="text-muted">你有 {player.gp} 点</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[0, 1, 2, 3].map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={value > player.gp}
                  onClick={() => setBid(value)}
                  className={`rounded-lg border px-2 py-2 font-mono text-sm transition disabled:opacity-30 ${
                    bid === value
                      ? "border-neon/60 bg-neon/10 text-neon"
                      : "border-line/60 bg-ink/30 text-white/60"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn-primary mt-3 w-full !py-2 text-xs"
              onClick={() => onAction({ kind: "bid", bid })}
            >
              确认暗标 {bid} 点
            </button>
            <button
              type="button"
              className="mt-2 w-full rounded-lg border border-line/60 bg-panel2/40 px-2 py-2 text-[10px] text-white/55 transition hover:border-neon/30"
              onClick={() => onAction({ kind: "abstain" })}
            >
              弃权，直接 +1 点
            </button>
            <button
              type="button"
              className="mt-2 w-full rounded-lg border border-mint/25 bg-mint/[0.04] px-2 py-2 text-[10px] text-mint/80 transition hover:border-mint/50"
              onClick={() => pickMode("coalition")}
            >
              联合：拉一个人一起压价，双方各 +2
            </button>
          </div>

          {mode === "coalition" && (
            <div className="rounded-xl border border-mint/20 bg-mint/[0.03] p-3">
              <div className="text-[10px] font-semibold text-mint">选一个联合对象</div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {others.map((item) => {
                  const target = getMemberOf(game, item);
                  return (
                    <button
                      key={item.memberId}
                      type="button"
                      onClick={() => setTargetId(item.memberId)}
                      className={`rounded-lg border px-1.5 py-2 text-[10px] transition ${
                        targetId === item.memberId
                          ? "border-mint/60 bg-mint/10 text-mint"
                          : "border-line/60 bg-ink/30 text-white/65"
                      }`}
                    >
                      <div className="text-base">{target.emoji}</div>
                      <div className="mt-0.5">{target.name}</div>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="btn-ghost mt-3 w-full !py-2 text-xs"
                disabled={!targetId}
                onClick={() => onAction({ kind: "coalition", targetId })}
              >
                发出联合邀请
              </button>
              <p className="mt-2 text-[9px] leading-4 text-muted">
                必须对方也选你才生效；双方各 +2 点，本回合不出价。
              </p>
            </div>
          )}

          <p className="text-[9px] leading-4 text-muted">
            最高价得标并支付；同分看影响力。隐藏估值是你的私心，别让他们看出来。
          </p>
        </>
      )}

      {game.config.ruleType === "escape" && challenge && (
        <>
          <div className="rounded-xl border border-line/60 bg-ink/30 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-white/85">{challenge.name}</div>
              <span className="pill">需要 {challenge.requirement} 点</span>
            </div>
            <p className="mt-1 text-[10px] leading-5 text-muted">{challenge.flavor}</p>
            <div className="mt-2.5 flex items-center justify-between rounded-lg border border-line/50 bg-panel2/40 px-2.5 py-2 text-[10px]">
              <span className="text-muted">你剩余出力</span>
              <span className="font-mono font-bold text-neon">{player.tokens} / 3</span>
            </div>
          </div>

          {mode !== "blame" ? (
            <div className="rounded-xl border border-neon/20 bg-neon/[0.03] p-3">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-semibold text-neon">暗选出力</span>
                <span className="text-muted">总出力达标即通过</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={value > player.tokens}
                    onClick={() => setContribution(value)}
                    className={`rounded-lg border px-2 py-2 font-mono text-sm transition disabled:opacity-30 ${
                      contribution === value
                        ? "border-neon/60 bg-neon/10 text-neon"
                        : "border-line/60 bg-ink/30 text-white/60"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn-primary mt-3 w-full !py-2 text-xs"
                onClick={() => onAction({ kind: "contribute", contribution })}
              >
                确认出力 {contribution} 点
              </button>
              <button
                type="button"
                className="mt-2 w-full rounded-lg border border-ember/25 bg-ember/[0.04] px-2 py-2 text-[10px] text-ember/80 transition hover:border-ember/50"
                onClick={() => pickMode("blame")}
              >
                甩锅：本回合出 0，失败时把锅转给别人
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-ember/20 bg-ember/[0.03] p-3">
              <div className="text-[10px] font-semibold text-ember">把锅甩给谁？</div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {others.map((item) => {
                  const target = getMemberOf(game, item);
                  return (
                    <button
                      key={item.memberId}
                      type="button"
                      onClick={() => setTargetId(item.memberId)}
                      className={`rounded-lg border px-1.5 py-2 text-[10px] transition ${
                        targetId === item.memberId
                          ? "border-ember/60 bg-ember/10 text-ember"
                          : "border-line/60 bg-ink/30 text-white/65"
                      }`}
                    >
                      <div className="text-base">{target.emoji}</div>
                      <div className="mt-0.5">{target.name}</div>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="btn-ghost mt-3 w-full !py-2 text-xs"
                disabled={!targetId}
                onClick={() => onAction({ kind: "blame", targetId })}
              >
                确认甩锅
              </button>
              <button
                type="button"
                className="mt-2 w-full text-[10px] text-muted underline-offset-2 hover:underline"
                onClick={() => setMode("idle")}
              >
                算了，还是出力
              </button>
            </div>
          )}
          <p className="text-[9px] leading-4 text-muted">
            出力会消耗全程 3 点；最低贡献者吃摸鱼标记。全群通关有额外奖励。
          </p>
        </>
      )}
    </div>
  );
}
