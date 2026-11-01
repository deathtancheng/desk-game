"use client";

import { create } from "zustand";
import { DEMO_CHAT, DEMO_GROUP_NAME, DEMO_MEMBERS } from "@/lib/demoData";
import { deriveSignals, parseChat } from "@/lib/parser";
import { buildConfig, selectRule } from "@/lib/compiler";
import { appendChatMessage, createGame, nextRound as advanceRound, playHumanAction, trimChatImages } from "@/lib/gameEngine";
import { createCloudRoom as createCloudRoomApi, getCloudClientId, closeCloudRoom as closeCloudRoomApi, updateCloudSeats as updateCloudSeatsApi } from "@/lib/cloudClient";
import type { ActionChoice, ChatMessage, GameConfig, GameState, Screen } from "@/lib/types";

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
  postChat: (authorId: string, text: string, options?: { emoji?: string; image?: string; big?: boolean }) => void;
  ingestChats: (messages: ChatMessage[]) => void;
  setCloudMode: (enabled: boolean) => void;
  createCloudRoom: () => Promise<void>;
  quickCreateRoom: (humanCount: number, hostMemberId?: string) => Promise<void>;
  setCloudHostMemberId: (memberId: string) => void;
  updateCloudSeats: (humanIds: string[], hostMemberId?: string) => Promise<void>;
  closeCloudRoom: () => Promise<void>;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({  screen: "import",
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
    );

    set({
      screen: "compiling",
      usedDemoChat,
      ruleReason: choice.reason,
      config,
      humanIds: state.humanIds.length >= 1 ? state.humanIds : DEMO_MEMBERS.slice(0, 3).map((m) => m.id),
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
    if (state.humanIds.length < 1) {
      set({ cloudError: "至少选 1 个真人位置。" });
      return;
    }
    const game = createGame(
      state.config,
      state.humanIds,
      state.cloudMode ? state.cloudHostMemberId ?? undefined : undefined,
    );
    set({
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

    const remainingHumans = state.game.players.filter(
      (player) => player.isHuman && !player.eliminated && !player.played,
    ).length;
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

  postChat: (authorId, text, options) => {
    const state = get();
    if (!state.game) return;
    if (!text.trim() && !options?.image) return;
    set({ game: appendChatMessage(state.game, authorId, text, options) });
  },

  ingestChats: (messages) => {
    const state = get();
    if (!state.game || messages.length === 0) return;
    const members = new Map(state.game.config.members.map((member) => [member.id, member]));
    const existing = new Set(state.game.log.map((message) => message.id));
    const fresh = messages
      .filter((message) => !existing.has(message.id))
      .map((message) => {
        const member = message.memberId ? members.get(message.memberId) : undefined;
        return {
          ...message,
          kind: "chat" as const,
          text: typeof message.text === "string" ? message.text : "",
          author: message.author ?? member?.name,
          emoji: message.emoji ?? member?.emoji,
          avatar: message.avatar ?? member?.emoji,
        };
      });
    if (fresh.length === 0) return;
    set({ game: trimChatImages({ ...state.game, log: [...state.game.log, ...fresh] }) });
  },

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
    if (state.humanIds.length < 1) {
      set({ cloudError: "至少选 1 个真人位置。" });
      return;
    }

    try {
      const clientId = getCloudClientId();
      const hostId =
        state.cloudHostMemberId && state.humanIds.includes(state.cloudHostMemberId)
          ? state.cloudHostMemberId
          : state.humanIds[0];
      const orderedHumanIds = [hostId, ...state.humanIds.filter((memberId) => memberId !== hostId)];
      const room = await createCloudRoomApi(clientId, orderedHumanIds, state.groupName);
      set({
        cloudMode: true,
        cloudRole: "host",
        humanIds: orderedHumanIds,
        roomCode: room.code,
        cloudClientId: clientId,
        cloudHostMemberId: hostId,
        cloudError: null,
      });
    } catch (error) {
      set({ cloudError: error instanceof Error ? error.message : "创建房间失败。" });
    }
  },

  setCloudHostMemberId: (memberId) => {
    set({ cloudHostMemberId: memberId });
  },

  quickCreateRoom: async (humanCount, hostMemberId) => {
    const state = get();
    const count = Math.max(1, Math.min(10, Math.floor(humanCount) || 3));
    const hostMember =
      DEMO_MEMBERS.find((member) => member.id === hostMemberId) ?? DEMO_MEMBERS[0];
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
    );
    const humanIds = [
      hostMember.id,
      ...DEMO_MEMBERS.filter((member) => member.id !== hostMember.id)
        .slice(0, count - 1)
        .map((member) => member.id),
    ];

    try {
      const clientId = getCloudClientId();
      const room = await createCloudRoomApi(clientId, humanIds, config.groupName);
      set({
        screen: "lobby",
        config,
        humanIds,
        usedDemoChat,
        ruleReason: choice.reason,
        game: null,
        judging: false,
        judgeError: null,
        judgeSource: null,
        cloudMode: true,
        cloudRole: "host",
        roomCode: room.code,
        cloudClientId: clientId,
        cloudHostMemberId: hostMember.id,
        cloudError: null,
      });
    } catch (error) {
      set({ cloudError: error instanceof Error ? error.message : "创建房间失败。" });
      throw error;
    }
  },

  updateCloudSeats: async (nextHumanIds, hostMemberId) => {
    const state = get();
    if (!state.roomCode || !state.cloudClientId) {
      set({
        humanIds: nextHumanIds,
        cloudHostMemberId: hostMemberId ?? state.cloudHostMemberId,
      });
      return;
    }
    try {
      const room = await updateCloudSeatsApi(
        state.roomCode,
        state.cloudClientId,
        nextHumanIds,
        hostMemberId,
      );
      set({
        humanIds: room.humanIds,
        cloudHostMemberId: hostMemberId ?? state.cloudHostMemberId,
        cloudError: null,
      });
    } catch (error) {
      set({ cloudError: error instanceof Error ? error.message : "调整席位失败。" });
      throw error;
    }
  },

  closeCloudRoom: async () => {
    const state = get();
    if (state.roomCode && state.cloudClientId) {
      try {
        await closeCloudRoomApi(state.roomCode, state.cloudClientId);
      } catch {
        // 房间可能已经过期；本地照常收尾
      }
    }
    get().reset();
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
      cloudClientId: null,
      cloudHostMemberId: null,
      cloudError: null,
    }),
}));
