"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import ImportScreen from "./ImportScreen";
import CompileScreen from "./CompileScreen";
import LobbyScreen from "./LobbyScreen";
import GameBoard from "./GameBoard";
import SettlementScreen from "./SettlementScreen";
import JoinScreen from "./JoinScreen";

export default function QunxiApp() {
  const screen = useGameStore((state) => state.screen);
  const reset = useGameStore((state) => state.reset);
  const roomCode = useGameStore((state) => state.roomCode);
  const cloudRole = useGameStore((state) => state.cloudRole);
  const closeCloudRoom = useGameStore((state) => state.closeCloudRoom);
  const [joinMode, setJoinMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname.replace(/\/+$/, "");
    setJoinMode(Boolean(params.get("join") || params.get("code")) || path === "/join");
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [screen]);

  const handleReset = () => {
    if (roomCode && cloudRole === "host") {
      if (window.confirm("结束当前云端房间并重新开始？室友会断开。")) {
        void closeCloudRoom();
      }
      return;
    }
    reset();
  };

  if (joinMode) return <JoinScreen />;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between border-b border-line/40 px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-neon/40 bg-neon/10 font-serif text-sm font-bold text-neon shadow-paper">
            群
          </div>
          <div className="leading-tight">
            <div className="font-serif text-base font-bold tracking-[0.16em] text-white/90">群戏</div>
            <div className="text-[10px] tracking-[0.22em] text-muted">群聊改编局</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="pill hidden sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            本地解析 · 不上传原文
          </span>
          {screen === "import" && (
            <>
              <a className="btn-ghost !px-3 !py-2 text-xs" href="/?join=1">
                联机加入
              </a>
              <button
                type="button"
                className="btn-primary !px-3 !py-2 text-xs"
                onClick={() => window.dispatchEvent(new Event("qunxi-open-host"))}
              >
                开房间
              </button>
            </>
          )}
          {screen !== "import" && (
            <button className="btn-ghost !px-3 !py-2 text-xs" onClick={handleReset}>
              重新开始
            </button>
          )}
        </div>
      </header>

      <div key={screen}>
        {screen === "import" && <ImportScreen />}
        {screen === "compiling" && <CompileScreen />}
        {screen === "lobby" && <LobbyScreen />}
        {screen === "board" && <GameBoard />}
        {screen === "settlement" && <SettlementScreen />}
      </div>
    </main>
  );
}
