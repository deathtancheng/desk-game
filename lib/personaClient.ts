import { cloudApiBase } from "./apiBase";
import type { PersonaJudgeRequest, PersonaVerdict } from "./types";

const JUDGE_TIMEOUT_MS = 9000;

export async function judgePersonaBatch(
  request: PersonaJudgeRequest,
): Promise<{ verdicts: PersonaVerdict[]; source: "llm" | "mock" }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);

  try {
    const response = await fetch(`${cloudApiBase()}/persona`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`persona api ${response.status}`);
    }

    const data = (await response.json()) as {
      verdicts?: PersonaVerdict[];
      source?: "llm" | "mock";
    };

    if (!Array.isArray(data.verdicts) || data.verdicts.length === 0) {
      throw new Error("persona api returned no verdicts");
    }

    return {
      verdicts: data.verdicts,
      source: data.source === "mock" ? "mock" : "llm",
    };
  } finally {
    clearTimeout(timeout);
  }
}
