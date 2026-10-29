import type { ActionChoice, GameState, RoomView } from "./types";

const CLIENT_KEY = "qunxi-cloud-client-id";

export function getCloudClientId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(CLIENT_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(CLIENT_KEY, id);
  return id;
}

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error || `请求失败（${response.status}）`;
}

export async function createCloudRoom(
  hostId: string,
  humanIds: string[],
  groupName: string,
): Promise<RoomView> {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostId, humanIds, groupName }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as RoomView;
}

export async function fetchCloudRoom(code: string, clientId?: string): Promise<RoomView | null> {
  const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}${query}`, {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as RoomView;
}

export async function joinCloudRoom(
  code: string,
  clientId: string,
  memberId: string,
): Promise<RoomView> {
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, memberId }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as RoomView;
}

export async function submitCloudAction(
  code: string,
  clientId: string,
  memberId: string,
  action: ActionChoice,
): Promise<void> {
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, memberId, action }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function publishCloudState(
  code: string,
  hostId: string,
  state: GameState,
): Promise<void> {
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostId, state }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function ackCloudAction(
  code: string,
  hostId: string,
  actionId: string,
): Promise<void> {
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/ack`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostId, actionId }),
  });
  if (!response.ok) throw new Error(await readError(response));
}
