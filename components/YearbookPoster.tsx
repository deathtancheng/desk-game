"use client";

import type { GameState, Yearbook } from "@/lib/types";
import RadarChart from "./RadarChart";

interface YearbookPosterProps {
  yearbook: Yearbook;
  game: GameState;
  date: string;
}

const INK = "#241f1a";
const MUTED = "#7a6d5f";
const ACCENT = "#b4552f";
const SAGE = "#5f7a58";
const BORDER = "#d8cbb8";
const CARD = "#fffaf0";

export default function YearbookPoster({ yearbook, game, date }: YearbookPosterProps) {
  return (
    <div
      style={{
        width: 720,
        minHeight: 960,
        backgroundImage:
          "radial-gradient(rgba(36,31,26,0.035) 0.6px, transparent 0.6px), radial-gradient(rgba(255,255,255,0.55) 0.6px, transparent 0.6px), linear-gradient(165deg, #f7efdf 0%, #f1e6d4 55%, #efe2cc 100%)",
        backgroundSize: "6px 6px, 9px 9px, 100% 100%",
        border: `1px solid ${BORDER}`,
        borderRadius: 24,
        padding: 30,
        color: INK,
        position: "relative",
        overflow: "hidden",
        fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.5)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -100,
          width: 300,
          height: 300,
          borderRadius: 999,
          background: "radial-gradient(circle, rgba(180,85,47,0.14), transparent 68%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -140,
          left: -120,
          width: 320,
          height: 320,
          borderRadius: 999,
          background: "radial-gradient(circle, rgba(95,122,88,0.12), transparent 68%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 64,
          width: 74,
          height: 20,
          background: "rgba(180,85,47,0.18)",
          transform: "rotate(-2deg)",
          borderRadius: 2,
        }}
      />

      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: "0.28em", color: MUTED }}>群戏 · 群年鉴</div>
          <div
            style={{
              marginTop: 8,
              fontFamily: '"Songti SC", "STSong", serif',
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            我们这一局
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: MUTED }}>
            {game.config.groupName} · {game.config.ruleTitle}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              display: "inline-block",
              padding: "4px 9px",
              borderRadius: 999,
              border: `1px solid ${BORDER}`,
              background: "#f3e3d4",
              color: ACCENT,
              fontSize: 9,
              letterSpacing: "0.14em",
            }}
          >
            {game.config.maxEvents} 个事件 · {game.players.length} 人 · 淘汰赛
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: MUTED }}>{date}</div>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          marginTop: 16,
          padding: "12px 14px",
          borderRadius: 12,
          border: `1px solid ${BORDER}`,
          background: "rgba(255,250,240,0.68)",
          fontSize: 11,
          lineHeight: 1.7,
          color: "#4a4036",
        }}
      >
        {yearbook.summary}
      </div>

      <div style={{ position: "relative", marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
        {yearbook.entries.map((entry, index) => (
          <div
            key={entry.member.id}
            style={{
              borderRadius: 13,
              border: index === 0 ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
              background: index === 0 ? "#fff6ea" : CARD,
              padding: 11,
              boxShadow: index === 0 ? "0 8px 18px rgba(180,85,47,0.08)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 20 }}>{entry.member.emoji}</span>
                <div>
                  <div style={{ fontFamily: '"Songti SC", "STSong", serif', fontSize: 13, fontWeight: 800 }}>
                    {entry.member.name}
                  </div>
                  <div style={{ fontSize: 9, color: MUTED }}>{entry.title}</div>
                  {entry.player.eliminated && (
                    <div style={{ marginTop: 2, fontSize: 8, color: ACCENT }}>第 {entry.player.eliminatedAt ?? "?"} 个事件出局</div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 800, color: ACCENT }}>
                  {entry.player.gp}
                </div>
                <div style={{ fontSize: 8, color: MUTED }}>群地位</div>
              </div>
            </div>
            <div
              style={{
                marginTop: 7,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
                fontSize: 9,
                color: entry.player.goalDone ? SAGE : MUTED,
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.player.goalText}
              </span>
              <span>{entry.player.goalDone ? "达成 +3" : "未达成"}</span>
            </div>
            <div
              style={{
                marginTop: 5,
                fontFamily: '"Songti SC", "STSong", serif',
                fontStyle: "italic",
                fontSize: 9,
                lineHeight: 1.5,
                color: "#6f6255",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
              }}
            >
              “{entry.quote}”
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "relative",
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "230px 1fr",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div
          style={{
            borderRadius: 14,
            border: `1px solid ${BORDER}`,
            background: "rgba(255,250,240,0.62)",
            padding: 8,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <RadarChart data={yearbook.radar} />
        </div>
        <div>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", color: MUTED }}>本局名场面</div>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 7 }}>
            {yearbook.moments.slice(0, 3).map((moment, index) => (
              <div
                key={`${moment}-${index}`}
                style={{ display: "flex", gap: 7, fontSize: 10, lineHeight: 1.5, color: "#4a4036" }}
              >
                <span style={{ color: ACCENT, fontWeight: 800 }}>0{index + 1}</span>
                <span>{moment}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          marginTop: 18,
          paddingTop: 12,
          borderTop: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontFamily: '"Songti SC", "STSong", serif', fontSize: 11, fontWeight: 700, color: INK }}>
            群戏 · 把群聊改编成一局游戏
          </div>
          <div style={{ marginTop: 2, fontSize: 8, color: MUTED }}>
            本局只属于你们 {game.players.length} 个人 · 游戏结束即删除
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 22 }}>
          {[3, 6, 2, 8, 4, 7, 2, 5, 9, 3, 6, 2, 8, 4, 7, 3, 5].map((height, index) => (
            <span
              key={index}
              style={{
                width: 2,
                height,
                borderRadius: 1,
                background: index % 3 === 0 ? ACCENT : "rgba(36,31,26,0.32)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
