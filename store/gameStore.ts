"use client";

import { create } from "zustand";
import { DEMO_CHAT, DEMO_GROUP_NAME, DEMO_MEMBERS } from "@/lib/demoData";
import { deriveSignals, parseChat } from "@/lib/parser";
import { buildConfig, selectRule } from "@/lib/compiler";
import { createGame, nextRound as advanceRound, playHumanAction } from "@/lib/gameEngine";
import { createCloudRoom as createCloudRoomApi, getCloudClientId } from "@/lib/cloudClient";
import type { ActionChoice, GameConfig, GameState, Screen } from "@/lib/types";

interface GameStore {
  screen: Screen;
  groupName: string;
  rawChat: string;
  usedDemoChat: boolean;
  ruleReason: string;
  config: GameConfig | null;
  game: GameState | null;
  humanIds: string[];
  judging: boolean;
  judgeError: string | null;
  judgeSource: "llm" | "local" | null;
  cloudMode: boolean;
  cloudRole: "host" | "guest" | null;
  roomCode: string | null;
  cloudClientId: string | null;
  cloudHostMemberId: string | null;
  cloudError: string | null;
  setGroupName: (name: string) => void;
  setRawChat: (chat: string) => void;
  setHumanIds: (ids: string[]) => void;
  useDemo: () => void;
  compile: () => void;
  finishCompile: () => void;
  startGame: () => void;
  chooseAction: (choice: ActionChoice) => Promise<void>;
  nextRound: () => void;
  goSettlement: () => void;
  setCloudMode: (enabled: boolean) => void;
  createCloudRoom: () => Promise<void>;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: "import",
  groupName: DEMO_GROUP_NAME,
  rawChat: "",
  usedDemoChat: false,
  ruleReason: "",
  config: null,
  game: null,
  humanIds: DEMO_MEMBERS.slice(0, 3).map((member) => member.id),
  judging: false,
  judgeError: null,
  judgeSource: null,
  cloudMode: false,
  cloudRole: null,
  roomCode: null,
  cloudClientId: null,
  cloudHostMemberId: null,
  cloudError: null,

  setGroupName: (groupName) => set({ groupName }),
  setRawChat: (rawChat) => set({ rawChat }),
  setHumanIds: (humanIds) => set({ humanIds }),

  useDemo: () =>
    set({
      groupName: DEMO_GROUP_NAME,
      rawChat: DEMO_CHAT,
    }),

  compile: () => {
    const state = get();
    const raw = state.rawChat.trim();
    const parsed = raw ? parseChat(raw) : [];
    const usedDemoChat = parsed.length < 8;
    const chat = usedDemoChat ? DEMO_CHAT : raw;
    const signals = deriveSignals(chat, DEMO_MEMBERS);
    const choice = selectRule(signals);
    const config = buildConfig(
      state.groupName.trim() || DEMO_GROUP_NAME,
      choice.ruleType,
      DEMO_MEMBERS,
      signals,
      state.humanIds.length,
    );

    set({
      screen: "compiling",
      usedDemoChat,
      ruleReason: choice.reason,
      config,
      humanIds: state.humanIds.length >= 2 ? state.humanIds : DEMO_MEMBERS.slice(0, 3).map((m) => m.id),
    });
  },

  finishCompile: () => set({ screen: "lobby" }),

  startGame: () => {
    const state = get();
    if (!state.config) return;
    if (state.cloudMode && !state.roomCode) {
      set({ cloudError: "先创建云端房间，再开局。" });
      return;
    }
    const config = buildConfig(
      state.config.groupName,
      state.config.ruleType,
      DEMO_MEMBERS,
      state.config.signals,
      state.humanIds.length,
    );
    const game = createGame(config, state.humanIds);
    set({
      config,
      game,
      screen: "board",
      judging: false,
      judgeError: null,
      judgeSource: null,
      cloudError: null,
    });
  },

  chooseAction: async (choice) => {
    const state = get();
    if (!state.game || state.judging) return;

    const remainingHumans = state.game.players.filter((player) => player.isHuman && !player.played).length;
    if (remainingHumans > 1) {
      const game = await playHumanAction(state.game, choice);
      set({ game });
      return;
    }

    set({ judging: true, judgeError: null });
    try {
      const game = await playHumanAction(state.game, choice);
      set({
        game,
        judging: false,
        judgeSource: game.lastResult?.judgeSource ?? null,
      });
    } catch {
      set({
        judging: false,
        judgeError: "人设判定失败，已切回本地规则，请重新出牌。",
      });
    }
  },

  nextRound: () => {
    const state = get();
    if (!state.game) return;
    if (state.game.phase === "done") {
      set({ screen: "settlement" });
      return;
    }
    set({ game: advanceRound(state.game), judgeSource: null, judgeError: null });
  },

  goSettlement: () => set({ screen: "settlement" }),

  setCloudMode: (enabled) => {
    if (enabled) {
      set({ cloudMode: true, cloudError: null });
      return;
    }
    set({
      cloudMode: false,
      cloudRole: null,
      roomCode: null,
      cloudHostMemberId: null,
      cloudError: null,
    });
  },

  createCloudRoom: async () => {
    const state = get();
    if (state.humanIds.length < 2) {
      set({ cloudError: "至少选 2 个真人位置。" });
      return;
    }

    try {
      const clientId = getCloudClientId();
      const room = await createCloudRoomApi(clientId, state.humanIds, state.groupName);
      set({
        cloudMode: true,
        cloudRole: "host",
        roomCode: room.code,
        cloudClientId: clientId,
        cloudHostMemberId: state.humanIds[0],
        cloudError: null,
      });
    } catch (error) {
      set({ cloudError: error instanceof Error ? error.message : "创建房间失败。" });
    }
  },

  reset: () =>
    set({
      screen: "import",
      rawChat: "",
      usedDemoChat: false,
      ruleReason: "",
      config: null,
      game: null,
      humanIds: DEMO_MEMBERS.slice(0, 3).map((member) => member.id),
      groupName: DEMO_GROUP_NAME,
      judging: false,
      judgeError: null,
      judgeSource: null,
      cloudMode: false,
      cloudRole: null,
      roomCode: null,
      cloudHostMemberId: null,
      cloudError: null,
    }),
}));
