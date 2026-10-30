export type RuleType = "negotiation" | "bidding" | "escape";

export type SkillKey =
  | "extra_gp"
  | "force_proposal"
  | "immune_ooc"
  | "save_group"
  | "slack_bonus"
  | "radio";

export type Screen = "import" | "compiling" | "lobby" | "board" | "settlement";

export type ActionKind =
  | "propose"
  | "support"
  | "meme"
  | "pass"
  | "volunteer"
  | "bid"
  | "abstain"
  | "coalition"
  | "contribute"
  | "blame";

export interface Stats {
  influence: number;
  reliability: number;
  mystery: number;
  scapegoat: number;
}

export interface Member {
  id: string;
  name: string;
  emoji: string;
  tags: string[];
  stats: Stats;
  desire: string;
  quote: string;
  meme: string;
  messageCount: number;
  activeHour: string;
  skill: {
    key: SkillKey;
    name: string;
    desc: string;
  };
}

export interface ChatSignal {
  negotiation: number;
  bidding: number;
  escape: number;
  totalMessages: number;
  activeMembers: number;
  memeCount: number;
  topKeywords: string[];
}

export interface GameEvent {
  title: string;
  quote: string;
  stakes: string;
  difficulty: number;
}

export interface Lot {
  id: string;
  name: string;
  flavor: string;
  values: Record<string, number>;
}

export interface Challenge {
  id: string;
  name: string;
  flavor: string;
  requirement: number;
}

export type GoalKey =
  | "never_assigned"
  | "target_assigned"
  | "compensation_2"
  | "proposal_passed"
  | "get_lot"
  | "deny_lot"
  | "cheap_win"
  | "unsold_lot"
  | "slack_pass"
  | "mvp"
  | "blame_target"
  | "save_group";

export interface GameConfig {
  groupName: string;
  ruleType: RuleType;
  ruleTitle: string;
  ruleSheet: string[];
  rounds: number;
  members: Member[];
  event: GameEvent;
  events: GameEvent[];
  lots: Lot[];
  challenges: Challenge[];
  signals: ChatSignal;
}

export interface ActionChoice {
  kind: ActionKind;
  targetId?: string;
  amount?: number;
  bid?: number;
  contribution?: number;
  useSkill?: boolean;
}

export interface PlayerState {
  memberId: string;
  isHuman: boolean;
  gp: number;
  tokens: number;
  goalKey: GoalKey;
  goalText: string;
  goalTargetId?: string;
  goalLotId?: string;
  goalDone: boolean;
  skillKey: SkillKey;
  skillName: string;
  skillDesc: string;
  skillUsed: boolean;
  personaHits: number;
  ooc: number;
  scapegoat: number;
  assignedCount: number;
  compensationReceived: number;
  proposalsPassed: number;
  wonLots: string[];
  totalContribution: number;
  zeroRounds: number;
  cheapWin: boolean;
  played: ActionChoice | null;
  actionHistory: ActionChoice[];
}

export interface ChatMessage {
  id: string;
  kind: "event" | "player" | "system" | "host" | "result" | "title";
  author?: string;
  emoji?: string;
  text: string;
  tone?: "normal" | "good" | "bad" | "glow";
}

export interface RoundResult {
  round: number;
  headline: string;
  detail: string;
  lines: string[];
  deltas: Record<string, number>;
  personaLine?: string;
  judgeSource?: "llm" | "local";
}

export interface PersonaVerdict {
  id: string;
  delta: -1 | 0 | 1;
  tag?: string;
  line: string;
}

export interface PersonaActionPayload {
  kind: ActionKind;
  amount?: number;
  bid?: number;
  contribution?: number;
  label: string;
  detail: string;
  targetName?: string;
}

export interface PersonaJudgePlayer {
  id: string;
  name: string;
  tags: string[];
  action: PersonaActionPayload;
}

export interface PersonaJudgeRequest {
  ruleType: RuleType;
  round: number;
  event: string;
  players: PersonaJudgePlayer[];
}

export interface PersonaJudgeResponse {
  verdicts: PersonaVerdict[];
  source: "llm" | "mock";
  model?: string;
}

export interface RoomPlayer {
  memberId: string;
  name: string;
  clientId: string;
  joinedAt: number;
}

export interface RoomAction {
  id: string;
  memberId: string;
  clientId: string;
  action: ActionChoice;
  createdAt: number;
}

export interface RoomView {
  code: string;
  groupName: string;
  hostId: string;
  humanIds: string[];
  version: number;
  players: RoomPlayer[];
  state: GameState | null;
  pending?: RoomAction[];
}

export interface GameState {
  config: GameConfig;
  players: PlayerState[];
  round: number;
  phase: "action" | "resolve" | "done";
  log: ChatMessage[];
  pendingIndex: number;
  lastResult: RoundResult | null;
  history: RoundResult[];
  hostName: string;
  hostEmoji: string;
  passedChallenges: number;
  unsoldLots: number;
}

export interface YearbookEntry {
  member: Member;
  player: PlayerState;
  title: string;
  quote: string;
}

export interface Yearbook {
  entries: YearbookEntry[];
  moments: string[];
  radar: { label: string; value: number }[];
  summary: string;
}
