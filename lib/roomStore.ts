import type { RoomAction, RoomPlayer, RoomView } from "./types";

export interface Room extends RoomView {
  pending: RoomAction[];
  createdAt: number;
  updatedAt: number;
}

const globalStore = globalThis as unknown as { __qunxiRooms?: Map<string, Room> };
const rooms = globalStore.__qunxiRooms ?? new Map<string, Room>();
globalStore.__qunxiRooms = rooms;

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

function makeCode(): string {
  return Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
}

export function cleanupRooms(): void {
  const cutoff = Date.now() - ROOM_TTL_MS;
  for (const [code, room] of rooms) {
    if (room.updatedAt < cutoff) rooms.delete(code);
  }
}

export function createRoom(
  hostId: string,
  humanIds: string[],
  groupName: string,
  hostName: string,
): Room {
  cleanupRooms();

  let code = makeCode();
  while (rooms.has(code)) code = makeCode();

  const now = Date.now();
  const host: RoomPlayer = {
    memberId: humanIds[0],
    name: hostName,
    clientId: hostId,
    joinedAt: now,
  };

  const room: Room = {
    code,
    groupName,
    hostId,
    humanIds,
    version: 1,
    players: [host],
    state: null,
    pending: [],
    createdAt: now,
    updatedAt: now,
  };

  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | undefined {
  cleanupRooms();
  return rooms.get(code.trim().toUpperCase());
}

export function toView(room: Room, includePending: boolean): RoomView {
  const view: RoomView = {
    code: room.code,
    groupName: room.groupName,
    hostId: room.hostId,
    humanIds: room.humanIds,
    version: room.version,
    players: room.players,
    state: room.state,
  };
  if (includePending) view.pending = room.pending;
  return view;
}

export function touchRoom(room: Room): void {
  room.updatedAt = Date.now();
  room.version += 1;
}

export function removeRoom(code: string, hostId: string): boolean {
  const room = rooms.get(code.trim().toUpperCase());
  if (!room || room.hostId !== hostId) return false;
  rooms.delete(room.code);
  return true;
}
