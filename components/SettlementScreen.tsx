"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { motion } from "framer-motion";
import { getMemberOf, rankPlayers } from "@/lib/gameEngine";
import { buildYearbook } from "@/lib/titles";
import { useGameStore } from "@/store/gameStore";
import YearbookPoster from "./YearbookPoster";

export default function SettlementScreen() {
  const game = useGameStore((state) => state.game);
  const reset = useGameStore((state) => state.reset);
  const posterRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDate(new Date().toLocaleDateString("zh-CN"));
  }, []);

  const yearbook = useMemo(() => (game ? buildYearbook(game) : null), [game]);

  if (!game || !yearbook) return null;

  const ranked = rankPlayers(game);
  const titleById = new Map(yearbook.entries.map((entry) => [entry.player.memberId, entry.title]));

  const download = async () => {
    if (!posterRef.current || downloading) return;
    setDownloading(true);
    setError("");
    try {
      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#070a0e",
      });
      const link = document.createElement("a");
      link.download = `群戏-${game.config.groupName}-群年鉴.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError("海报生成失败，可以直接截屏保存。");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8">
      <div className="flex flex-col justify-between gap-4 pt-4 lg:flex-row lg:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-mint/25 bg-mint/5 px-3 py-1.5 text-[10px] tracking-[0.18em] text-mint">
            本局结束 · 群年鉴已生成
          </div>
          <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight sm:text-5xl">
            这一局，<span className="text-neon glow-text">群年鉴</span>已生成。
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">{yearbook.summary}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" onClick={download} disabled={downloading}>
            {downloading ? "正在生成海报…" : "保存群年鉴"}
          </button>
          <button className="btn-ghost" onClick={reset}>
            再来一局
          </button>
        </div>
      </div>

      {error && <div className="mt-3 text-[11px] text-ember">{error}</div>}

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {ranked.slice(0, 3).map((player, index) => {
          const member = getMemberOf(game, player);
          const accent = index === 0 ? "neon" : index === 1 ? "mint" : "ember";
          const accentClass =
            accent === "neon"
              ? "border-neon/40 bg-neon/[0.05]"
              : accent === "mint"
                ? "border-mint/30 bg-mint/[0.04]"
                : "border-ember/30 bg-ember/[0.04]";
          return (
            <motion.div
              key={player.memberId}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className={`rounded-2xl border p-4 ${accentClass} ${index === 0 ? "sm:-translate-y-1" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.2em] text-white/35">第 {index + 1} 名</span>
                {index === 0 && <span className="rounded-full bg-neon/15 px-2 py-0.5 text-[8px] text-neon">本局群主</span>}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl">
                  {member.emoji}
                </div>
                <div>
                  <div className="text-base font-black">{member.name}</div>
                  <div className="text-[10px] text-muted">{titleById.get(player.memberId) ?? "最佳群友"}</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="font-mono text-2xl font-black text-white">{player.gp}</div>
                  <div className="text-[8px] tracking-[0.12em] text-muted">群地位</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px]">
                <span className={player.goalDone ? "text-mint" : "text-white/40"}>
                  {player.goalText} {player.goalDone ? "✓" : "—"}
                </span>
                {player.scapegoat > 0 && <span className="text-ember">背锅 {player.scapegoat}</span>}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] tracking-[0.24em] text-muted">你们的群年鉴</div>
          <div className="mt-1 text-sm font-bold text-white/80">保存这张，发给今晚没来的人</div>
        </div>
        <span className="pill hidden sm:inline-flex">打印或发群都好看</span>
      </div>

      <div className="chat-scroll mt-3 overflow-x-auto pb-3">
        <div ref={posterRef} className="mx-auto w-[720px]">
          <YearbookPoster yearbook={yearbook} game={game} date={date} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/60 bg-panel2/30 px-4 py-3">
        <div className="text-[10px] leading-5 text-muted">
          这一局只属于你们 {game.players.length} 个人。群戏默认不上传原文、不用真头像，游戏结束即删除。
        </div>
        <button className="btn-ghost !px-3 !py-2 text-xs" onClick={reset}>
          回到首页
        </button>
      </div>
    </div>
  );
}
