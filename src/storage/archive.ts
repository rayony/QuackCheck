import { z } from "zod";
import type { AssessmentSessionRecord, HistoryArchiveExport, ImportMergeResult } from "../domain/types.ts";

const KNOWN = ["1.0.0", "1.0.1", "1.0.2", "1.0.3"] as const;

const SessionSchema = z
  .object({
    schemaVersion: z.enum(KNOWN),
    sessionId: z.string().min(1),
    updatedAtIso: z.string().min(1),
    episodeId: z.string().min(1),
    createdAtIso: z.string().min(1),
    sport: z.enum(["unspecified", "road_running", "trail_running", "cycling", "triathlon"]),
    marks: z.array(z.object({ markId: z.string(), regionId: z.string(), side: z.string() }).passthrough()),
    safetyScreen: z.enum(["hit", "no_hit_on_asked_items", "incomplete"]),
    safetyAnswers: z.array(z.object({ ruleId: z.string(), answer: z.string() }).passthrough()),
    hypotheses: z.array(z.object({ conditionId: z.string() }).passthrough()),
  })
  .passthrough();

const ArchiveSchema = z.object({
  schemaVersion: z.enum(KNOWN),
  app: z.literal("quackcheck"),
  exportedAtIso: z.string(),
  sessions: z.array(SessionSchema),
});

export function parseArchive(raw: unknown):
  | { ok: true; sessions: AssessmentSessionRecord[] }
  | { ok: false; rejectedReasonZh: string } {
  const parsed = ArchiveSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, rejectedReasonZh: "這份檔案的版本或格式不支援，沒有寫入本機紀錄。" };
  }
  return { ok: true, sessions: parsed.data.sessions as unknown as AssessmentSessionRecord[] };
}

export function mergeSessions(
  local: AssessmentSessionRecord[],
  incoming: AssessmentSessionRecord[],
): ImportMergeResult & { sessions: AssessmentSessionRecord[] } {
  const map = new Map(local.map((session) => [session.sessionId, session]));
  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  for (const session of incoming) {
    const prev = map.get(session.sessionId);
    if (!prev) {
      map.set(session.sessionId, { ...session, schemaVersion: "1.0.3" });
      addedCount += 1;
      continue;
    }
    if (session.updatedAtIso > prev.updatedAtIso) {
      map.set(session.sessionId, { ...session, schemaVersion: "1.0.3" });
      updatedCount += 1;
    } else {
      skippedCount += 1;
    }
  }
  return {
    addedCount,
    updatedCount,
    skippedCount,
    sessions: [...map.values()].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso)),
  };
}

export function toExport(sessions: AssessmentSessionRecord[]): HistoryArchiveExport {
  return {
    schemaVersion: "1.0.3",
    app: "quackcheck",
    exportedAtIso: new Date().toISOString(),
    sessions,
  };
}
