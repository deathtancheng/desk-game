"use client";

import { useEffect, useState } from "react";
import CloudGuestBoard from "@/components/CloudGuestBoard";
import { fetchCloudRoom, getCloudClientId, joinCloudRoom } from "@/lib/cloudClient";
import { DEMO_MEMBERS } from "@/lib/demoData";
import type { RoomView } from "@/lib/types";

interface GuestSession {
  roomCode: string;
  clientId: string;
  memberId: string;
}

export default function JoinScreen() {
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<RoomView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState<GuestSession | null>(null);
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    setClientId(getCloudClientId());

    const params = new URLSearchParams(window.location.search);
    const initial = (params.get("join") || params.get("code") || "").toUpperCase();
    if (initial) {
      setCode(initial);
      void lookup(initial);
    }

    const saved = window.sessionStorage.getItem("qunxi-guest-session");
    if (!saved) return;
    try {
      const session = JSON.parse(saved) as GuestSession;
      if (!session.roomCode || !session.clientId || !session.memberId) return;
      if (initial && session.roomCode !== initial) {
        window.sessionStorage.removeItem("qunxi-guest-session");
        return;
      }
      void fetchCloudRoom(session.roomCode)
        .then((existing) => {
          if (existing) setJoined(session);
          else window.sessionStorage.removeItem("qunxi-guest-session");
        })
        .catch(() => window.sessionStorage.removeItem("qunxi-guest-session"));
    } catch {
      window.sessionStorage.removeItem("qunxi-guest-session");
    }
  }, []);

  const lookup = async (value: string) => {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      setError("先输入房间号。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const next = await fetchCloudRoom(normalized);
      if (!next) {
        setRoom(null);
        setError("没找到这个房间，可能已经过期。");
        return;
      }
      setRoom(next);
      setCode(normalized);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "查询失败。");
    } finally {
      setLoading(false);
    }
  };

  const join = async (memberId: string) => {
    if (!room) return;
    setLoading(true);
    setError("");
    try {
      const id = clientId || getCloudClientId();
      await joinCloudRoom(room.code, id, memberId);
      const session: GuestSession = { roomCode: room.code, clientId: id, memberId };
      window.sessionStorage.setItem("qunxi-guest-session", JSON.stringify(session));
      setJoined(session);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "加入失败。");
    } finally {
      setLoading(false);
    }
  };

  if (joined) {
    return (
      <CloudGuestBoard
        roomCode={joined.roomCode}
        clientId={joined.clientId}
        memberId={joined.memberId}
      />
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between border-b border-line/40 px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-neon/40 bg-neon/10 font-serif text-sm font-bold text-neon shadow-paper">
            群
          </div>
          <div className="leading-tight">
            <div className="font-serif text-base font-bold tracking-[0.16em] text-white/90">群戏</div>
            <div className="text-[10px] tracking-[0.18em] text-muted">手机加入</div>
          </div>
        </div>
        <a className="btn-ghost !px-3 !py-2 text-[10px]" href="/">
          回到首页
        </a>
      </header>

      <div className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8 sm:px-8">
        <div className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">加入群戏房间</div>
        <p className="mt-2 text-sm leading-6 text-white/55">
          输入房主给的房间号，选一个还没被认领的群友。房主电脑负责结算，你只需要在轮到你时出牌。
        </p>

        <div className="panel mt-6 p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") void lookup(code);
              }}
              placeholder="例如：A7K2M"
              maxLength={5}
              className="flex-1 rounded-xl border border-line bg-ink/40 px-4 py-3 font-mono text-lg tracking-[0.2em] text-white outline-none transition placeholder:tracking-normal placeholder:text-white/20 focus:border-neon/50"
            />
            <button className="btn-primary sm:w-32" onClick={() => void lookup(code)} disabled={loading}>
              {loading ? "查找中…" : "查找房间"}
            </button>
          </div>
          {error && <div className="mt-2 text-[11px] text-ember">{error}</div>}
        </div>

        {room && (
          <div className="panel mt-4 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line/60 px-5 py-4">
              <div>
                <div className="font-serif text-lg font-bold text-white">{room.groupName}</div>
                <div className="mt-0.5 text-[10px] text-muted">
                  房间号 <span className="font-mono text-neon">{room.code}</span>
                  {room.state ? ` · ${room.state.config.ruleTitle}` : " · 还没开局"}
                </div>
              </div>
              <span className="pill">
                {room.players.length} / {room.humanIds.length} 已加入
              </span>
            </div>

            <div className="space-y-2 p-4">
              {room.humanIds.map((memberId) => {
                const member = DEMO_MEMBERS.find((item) => item.id === memberId);
                const claim = room.players.find((player) => player.memberId === memberId);
                const isHost = claim?.clientId === room.hostId;
                const isMine = claim?.clientId === clientId;
                const taken = Boolean(claim) && !isMine;

                return (
                  <div
                    key={memberId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line/60 bg-ink/25 px-3.5 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xl">
                        {member?.emoji ?? "🙂"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif text-sm font-bold text-white/90">
                            {member?.name ?? memberId}
                          </span>
                          {isHost && <span className="rounded-full bg-neon/15 px-1.5 py-0.5 text-[8px] text-neon">房主</span>}
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted">
                          {taken ? "已被认领" : isMine ? "这是你" : "可认领"}
                        </div>
                      </div>
                    </div>

                    {taken ? (
                      <span className="text-[10px] text-muted">已满</span>
                    ) : (
                      <button
                        className="btn-ghost !px-3 !py-2 text-[10px]"
                        onClick={() => void join(memberId)}
                        disabled={loading}
                      >
                        {isMine ? "继续这局" : "选这个身份"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-line/60 px-5 py-3 text-[9px] leading-4 text-muted">
              房主需要保持电脑页面开着。云端模式下隐藏诉求是信任制；牌桌状态会自动同步。
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
