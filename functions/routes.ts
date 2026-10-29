import { handlePersona } from "./persona.ts";

type BackendErrorConstructor = new (code: string, status: number) => Error;

interface RoomPlayer {
  memberId: string;
  name: string;
  clientId: string;
  joinedAt: number;
}

interface RoomAction {
  id: string;
  memberId: string;
  clientId: string;
  action: unknown;
  createdAt: number;
}

interface RoomState {
  phase?: string;
  pendingIndex?: number;
  players?: { memberId?: string }[];
  [key: string]: unknown;
}

interface RoomData {
  code: string;
  groupName: string;
  hostId: string;
  humanIds: string[];
  version: number;
  players: RoomPlayer[];
  state: RoomState | null;
  pending: RoomAction[];
  createdAt: number;
  updatedAt: number;
}

interface RoomRow {
  data: RoomData;
  version: number;
}

interface RoomView {
  code: string;
  groupName: string;
  hostId: string;
  humanIds: string[];
  version: number;
  players: RoomPlayer[];
  state: RoomState | null;
  pending?: RoomAction[];
}

interface Dependencies {
  db: any;
  BackendError: BackendErrorConstructor;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_BODY = 64 * 1024;
const MAX_STATE_BODY = 1024 * 1024;

export function application({ db, BackendError }: Dependencies) {
  const fail = (code: string, status: number): never => {
    throw new BackendError(code, status);
  };

  const rows = (result: any): any[] => {
    if (result?.error) {
      fail(result.error.code || "database_error", result.error.status || 503);
    }
    return result?.data ?? [];
  };

  const makeCode = (): string =>
    Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");

  async function readJson(request: Request, limit = MAX_BODY): Promise<any> {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("application/json")) fail("invalid_input", 400);
    const declared = Number(request.headers.get("content-length") || 0);
    if (declared > limit) fail("payload_too_large", 413);
    const text = await request.text();
    if (text.length > limit) fail("payload_too_large", 413);
    try {
      return JSON.parse(text);
    } catch {
      fail("invalid_input", 400);
    }
  }

  async function readRoom(code: string): Promise<RoomRow | null> {
    const result = await db.from("qunxi_rooms").select("data,version").eq("code", code).limit(1);
    const found = rows(result);
    return found.length > 0 ? (found[0] as RoomRow) : null;
  }

  function roomOf(row: RoomRow): RoomData {
    return typeof row.data === "string" ? (JSON.parse(row.data) as RoomData) : row.data;
  }

  async function mutateRoom(code: string, mutate: (room: RoomData) => boolean): Promise<RoomData> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const row = await readRoom(code);
      if (!row) fail("room_not_found", 404);
      const room = roomOf(row);
      if (!mutate(room)) return room;

      const nextVersion = row.version + 1;
      room.version = nextVersion;
      room.updatedAt = Date.now();

      const result = await db
        .from("qunxi_rooms")
        .update({
          data: room,
          version: nextVersion,
          updated_at: new Date(room.updatedAt).toISOString(),
        })
        .eq("code", code)
        .eq("version", row.version)
        .select("data,version");

      if (rows(result).length > 0) return room;
    }
    fail("room_busy", 409);
  }

  function view(room: RoomData, includePending: boolean): RoomView {
    const value: RoomView = {
      code: room.code,
      groupName: room.groupName,
      hostId: room.hostId,
      humanIds: room.humanIds,
      version: room.version,
      players: room.players,
      state: room.state,
    };
    if (includePending) value.pending = room.pending;
    return value;
  }

  async function createRoom(request: Request): Promise<Response> {
    const body = await readJson(request);
    const hostId = body?.hostId;
    const humanIds = body?.humanIds;
    const groupName =
      typeof body?.groupName === "string" && body.groupName.trim()
        ? body.groupName.trim().slice(0, 40)
        : "306 不熄灯";

    if (typeof hostId !== "string" || !hostId || hostId.length > 120) {
      fail("invalid_input", 400);
    }
    if (
      !Array.isArray(humanIds) ||
      humanIds.length < 2 ||
      humanIds.length > 6 ||
      !humanIds.every((value: unknown) => typeof value === "string" && value.length <= 24)
    ) {
      fail("invalid_input", 400);
    }

    const now = Date.now();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = makeCode();
      const room: RoomData = {
        code,
        groupName,
        hostId,
        humanIds,
        version: 1,
        players: [{ memberId: humanIds[0], name: "房主", clientId: hostId, joinedAt: now }],
        state: null,
        pending: [],
        createdAt: now,
        updatedAt: now,
      };

      const result = await db.from("qunxi_rooms").insert({
        code,
        data: room,
        version: 1,
        updated_at: new Date(now).toISOString(),
      });

      if (!result?.error) return Response.json(view(room, true));
      if (result.error.code !== "23505") {
        fail(result.error.code || "database_error", result.error.status || 503);
      }
    }

    fail("room_code_unavailable", 503);
  }

  async function joinRoom(code: string, request: Request): Promise<Response> {
    const body = await readJson(request);
    const clientId = body?.clientId;
    const memberId = body?.memberId;
    if (typeof clientId !== "string" || !clientId || typeof memberId !== "string" || !memberId) {
      fail("invalid_input", 400);
    }

    const room = await mutateRoom(code, (current) => {
      if (!current.humanIds.includes(memberId)) fail("invalid_member", 400);
      const existing = current.players.find((player) => player.memberId === memberId);
      if (existing) {
        if (existing.clientId !== clientId) fail("seat_taken", 409);
        return false;
      }
      current.players.push({ memberId, clientId, name: "群友", joinedAt: Date.now() });
      return true;
    });

    return Response.json(view(room, false));
  }

  async function submitAction(code: string, request: Request): Promise<Response> {
    const body = await readJson(request);
    const clientId = body?.clientId;
    const memberId = body?.memberId;
    const action = body?.action;
    if (
      typeof clientId !== "string" ||
      !clientId ||
      typeof memberId !== "string" ||
      !memberId ||
      !action ||
      typeof action !== "object" ||
      typeof action.kind !== "string"
    ) {
      fail("invalid_input", 400);
    }

    const room = await mutateRoom(code, (current) => {
      const claim = current.players.find((player) => player.memberId === memberId);
      if (!claim || claim.clientId !== clientId) fail("not_joined", 403);
      if (!current.state) fail("not_started", 409);
      if (current.state.phase !== "action") fail("not_action_phase", 409);
      const active = current.state.players?.[current.state.pendingIndex ?? -1];
      if (!active || active.memberId !== memberId) fail("not_your_turn", 409);

      current.pending = current.pending.filter((item) => item.memberId !== memberId);
      current.pending.push({
        id: crypto.randomUUID(),
        memberId,
        clientId,
        action,
        createdAt: Date.now(),
      });
      return true;
    });

    return Response.json({ ok: true, version: room.version });
  }

  async function publishState(code: string, request: Request): Promise<Response> {
    const body = await readJson(request, MAX_STATE_BODY);
    const hostId = body?.hostId;
    const state = body?.state;
    if (typeof hostId !== "string" || !hostId || !state || typeof state !== "object") {
      fail("invalid_input", 400);
    }

    const room = await mutateRoom(code, (current) => {
      if (current.hostId !== hostId) fail("host_only", 403);
      current.state = state as RoomState;
      return true;
    });

    return Response.json({ ok: true, version: room.version });
  }

  async function ackAction(code: string, request: Request): Promise<Response> {
    const body = await readJson(request);
    const hostId = body?.hostId;
    const actionId = body?.actionId;
    if (typeof hostId !== "string" || !hostId || typeof actionId !== "string" || !actionId) {
      fail("invalid_input", 400);
    }

    const room = await mutateRoom(code, (current) => {
      if (current.hostId !== hostId) fail("host_only", 403);
      const before = current.pending.length;
      current.pending = current.pending.filter((item) => item.id !== actionId);
      return current.pending.length !== before;
    });

    return Response.json({ ok: true, version: room.version });
  }

  return async (context: { request: Request }): Promise<Response> => {
    const request = context.request;
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(\/.*)?$/);
    if (!match) fail("not_found", 404);
    const path = match[1] || "/";
    const method = request.method.toUpperCase();

    if (path === "/health" && method === "GET") {
      return Response.json({ ok: true, service: "qunxi" });
    }

    if (path === "/persona" && method === "POST") {
      return handlePersona(request, fail);
    }

    if (path === "/rooms" && method === "POST") {
      return createRoom(request);
    }

    const roomMatch = path.match(/^\/rooms\/([A-Z0-9]{5})(\/[a-z]+)?$/);
    if (roomMatch) {
      const code = roomMatch[1];
      const suffix = roomMatch[2] || "";

      if (suffix === "" && method === "GET") {
        const row = await readRoom(code);
        if (!row) fail("room_not_found", 404);
        const room = roomOf(row);
        const clientId = url.searchParams.get("clientId");
        return Response.json(view(room, clientId === room.hostId));
      }
      if (suffix === "/join" && method === "POST") return joinRoom(code, request);
      if (suffix === "/action" && method === "POST") return submitAction(code, request);
      if (suffix === "/state" && method === "POST") return publishState(code, request);
      if (suffix === "/ack" && method === "POST") return ackAction(code, request);
    }

    fail("not_found", 404);
  };
}
