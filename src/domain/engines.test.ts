import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findBanned } from "./bannedWords.ts";
import { formatHandoff } from "./handoffFormatter.ts";
import { buildHypotheses } from "./hypothesisEngine.ts";
import {
  ACTIVITY_CONSIDER,
  ACTIVITY_PAUSE,
  DIET_DISCUSS,
  DIET_LIMIT,
  GEAR,
  RED_FLAGS,
  TESTS,
  THERAPIES,
} from "./knowledge.ts";
import { computeSafetyScreen, isHistoryIncomplete, requiredRuleIds } from "./redFlagEngine.ts";
import { visibleTherapies } from "./therapyFilter.ts";
import { KNOWLEDGE_GRAPH_VERSION, type AssessmentSessionRecord, type PainMark } from "./types.ts";
import { mergeSessions, parseArchive } from "../storage/archive.ts";

function mark(over: Partial<PainMark> = {}): PainMark {
  return {
    markId: "m1",
    side: "right",
    regionId: "lat_knee",
    painQuality: "sharp",
    vasNow: 4,
    vasWorst: 6,
    onset: "gradual_days",
    durationDays: 12,
    warmUp: "unchanged",
    nextDay: "same",
    nightPain: false,
    swelling: "none",
    weightBearing: "walk_only",
    ...over,
  };
}

function answered(ids: string[], yesId?: string) {
  return ids.map((ruleId) => ({
    ruleId,
    answer: ruleId === yesId ? ("yes" as const) : ("no" as const),
  }));
}

describe("safety", () => {
  it("TC-SF-01 cannot walk four steps is a hit and hides therapies", () => {
    const marks = [mark({ weightBearing: "cannot_four_steps", onset: "trauma" })];
    const ids = requiredRuleIds(marks, []);
    const safety = computeSafetyScreen(ids, answered(ids), marks);
    assert.equal(safety, "hit");
    assert.equal(visibleTherapies({ safety, hypotheses: [], flags: [], marks, reds: false }).length, 0);
  });

  it("TC-SF-02 unions rules across marks", () => {
    const marks = [mark(), mark({ markId: "m2", side: "left", regionId: "post_calf" })];
    const ids = requiredRuleIds(marks, []);
    assert.ok(ids.includes("rf_dvt"));
    assert.ok(ids.includes("rf_cardiopulm"));
    assert.equal(new Set(ids).size, ids.length);
  });

  it("TC-SF-03 one yes fails the whole session", () => {
    const marks = [mark(), mark({ markId: "m2", regionId: "post_calf" })];
    const ids = requiredRuleIds(marks, []);
    assert.equal(computeSafetyScreen(ids, answered(ids, "rf_dvt"), marks), "hit");
  });

  it("TC-SF-04 skipped question stays incomplete and only load advice remains", () => {
    const marks = [mark()];
    const ids = requiredRuleIds(marks, []);
    const answers = ids.map((ruleId) => ({ ruleId, answer: "skipped" as const }));
    const safety = computeSafetyScreen(ids, answers, marks);
    assert.equal(safety, "incomplete");
    const cards = visibleTherapies({
      safety,
      hypotheses: buildHypotheses({
        sport: "road_running",
        ultraDistance: false,
        marks,
        tags: [],
        historyIncomplete: false,
        safetyScreen: safety,
      }),
      flags: [],
      marks,
      reds: false,
    });
    assert.deepEqual(cards.map((card) => card.id), ["load_cut"]);
  });

  it("TC-SF-05 low back forces the saddle question", () => {
    const ids = requiredRuleIds([mark({ regionId: "low_back" })], []);
    assert.ok(ids.includes("rf_cauda_equina"));
  });

  it("TC-SF-06 fluoroquinolone yes is a hit", () => {
    const marks = [mark({ regionId: "achilles", zoneDetail: "achilles_mid" })];
    const ids = requiredRuleIds(marks, ["fluoroquinolone"]);
    assert.ok(ids.includes("rf_fluoroquinolone"));
    assert.equal(computeSafetyScreen(ids, answered(ids, "rf_fluoroquinolone"), marks), "hit");
  });

  it("TC-SF-07 implanted device and anticoagulant hide gun, magnet and IASTM", () => {
    const marks = [mark({ regionId: "lat_hip" }), mark({ markId: "m2", regionId: "post_calf" })];
    const hypotheses = buildHypotheses({
      sport: "road_running",
      ultraDistance: false,
      marks,
      tags: [],
      historyIncomplete: false,
      safetyScreen: "no_hit_on_asked_items",
    });
    const open = visibleTherapies({
      safety: "no_hit_on_asked_items",
      hypotheses,
      flags: [],
      marks,
      reds: false,
    });
    const locked = visibleTherapies({
      safety: "no_hit_on_asked_items",
      hypotheses,
      flags: ["implanted_device", "anticoagulant"],
      marks,
      reds: false,
    });
    assert.ok(open.some((card) => card.id === "massage_gun"));
    assert.equal(locked.some((card) => card.modality === "massage_gun"), false);
    assert.equal(locked.some((card) => card.modality === "magnetic_fork"), false);
    assert.equal(locked.some((card) => card.modality === "iastm"), false);
    assert.ok(locked.some((card) => card.modality === "rehab_exercise" || card.modality === "load_management"));
  });

  it("TC-SF-08 pregnancy hides pressure tools", () => {
    const marks = [mark({ regionId: "deep_glute" }), mark({ markId: "m2", regionId: "lat_hip" })];
    const hypotheses = buildHypotheses({
      sport: "running" as "road_running",
      ultraDistance: false,
      marks,
      tags: [],
      historyIncomplete: false,
      safetyScreen: "no_hit_on_asked_items",
    });
    const cards = visibleTherapies({
      safety: "no_hit_on_asked_items",
      hypotheses,
      flags: ["pregnant"],
      marks,
      reds: false,
    });
    for (const modality of ["magnetic_fork", "iastm", "massage_gun", "haipai_tuina", "trigger_point"] as const) {
      assert.equal(cards.some((card) => card.modality === modality), false, modality);
    }
  });
});

describe("clinical", () => {
  it("TC-CL-01 lateral knee lists IT band and upstream hip", () => {
    const marks = [mark()];
    const list = buildHypotheses({
      sport: "road_running",
      ultraDistance: false,
      marks,
      tags: ["downhill_overload"],
      historyIncomplete: isHistoryIncomplete(marks),
      safetyScreen: "no_hit_on_asked_items",
    });
    const itbs = list.find((item) => item.conditionId === "itbs");
    const hip = list.find((item) => item.conditionId === "glute_med_tfl");
    assert.equal(itbs?.role, "local_pain_site");
    assert.equal(hip?.role, "upstream_contributor");
    assert.ok(itbs && itbs.fit !== "moderate" ? itbs.fit === "low" : true);
    assert.ok(itbs && (itbs.fit === "low" || itbs.fit === "moderate"));
    assert.notEqual(itbs?.fit, "high" as string);
    assert.ok(itbs && itbs.fit === "moderate");
  });

  it("TC-CL-02 bone-stress sorts ahead of MTSS and hides rollers", () => {
    const marks = [
      mark({
        regionId: "med_tibia",
        nightPain: true,
        weightBearing: "walk_pain",
        zoneDetail: "shin_focal",
        warmUp: "worsens",
      }),
    ];
    const list = buildHypotheses({
      sport: "road_running",
      ultraDistance: false,
      marks,
      tags: [],
      historyIncomplete: false,
      safetyScreen: "no_hit_on_asked_items",
    });
    const bone = list.findIndex((item) => item.conditionId === "bone_stress");
    const mtss = list.findIndex((item) => item.conditionId === "mtss");
    assert.ok(bone >= 0 && bone < mtss);
    assert.equal(list[bone]?.role, "must_rule_out_first");
    const cards = visibleTherapies({
      safety: "no_hit_on_asked_items",
      hypotheses: list,
      flags: [],
      marks,
      reds: false,
    });
    assert.equal(cards.some((card) => card.modality === "foam_roller"), false);
    assert.equal(cards.some((card) => card.modality === "massage_gun"), false);
  });

  it("TC-CL-03 insertional Achilles hides end-range stretch", () => {
    const marks = [mark({ regionId: "achilles", zoneDetail: "achilles_insertion", warmUp: "eases" })];
    const list = buildHypotheses({
      sport: "road_running",
      ultraDistance: false,
      marks,
      tags: [],
      historyIncomplete: false,
      safetyScreen: "no_hit_on_asked_items",
    });
    assert.ok(list.some((item) => item.conditionId === "achilles_insertion"));
    const cards = visibleTherapies({
      safety: "no_hit_on_asked_items",
      hypotheses: list,
      flags: [],
      marks,
      reds: false,
    });
    assert.equal(cards.some((card) => card.id === "df_endrange"), false);
  });

  it("TC-CL-04 missing behaviour caps fit at low", () => {
    const marks = [mark({ warmUp: undefined })];
    const incomplete = isHistoryIncomplete(marks);
    assert.equal(incomplete, true);
    const list = buildHypotheses({
      sport: "road_running",
      ultraDistance: false,
      marks,
      tags: ["downhill_overload"],
      historyIncomplete: incomplete,
      safetyScreen: "no_hit_on_asked_items",
    });
    assert.ok(list.every((item) => item.fit === "low"));
  });

  it("TC-CL-05 keeps the user's own guess words", () => {
    const marks = [mark()];
    const list = buildHypotheses({
      sport: "road_running",
      ultraDistance: false,
      marks,
      tags: ["downhill_overload"],
      userHypothesis: "腓骨肌拉傷",
      historyIncomplete: false,
      safetyScreen: "no_hit_on_asked_items",
    });
    const itbs = list.find((item) => item.conditionId === "itbs");
    assert.equal(itbs?.userGuess, "unsupported");
    assert.match(itbs?.userGuessNoteZh ?? "", /腓骨肌拉傷/);
  });
});

describe("copy and storage", () => {
  it("TC-CP-02 knowledge and a sample handoff avoid banned phrases", () => {
    const blob = JSON.stringify({ RED_FLAGS, TESTS, THERAPIES, GEAR, DIET_DISCUSS, DIET_LIMIT, ACTIVITY_CONSIDER, ACTIVITY_PAUSE });
    assert.deepEqual(findBanned(blob), []);
    const record: AssessmentSessionRecord = {
      schemaVersion: "1.0.3",
      knowledgeGraphVersion: KNOWLEDGE_GRAPH_VERSION,
      sessionId: "s",
      episodeId: "e",
      createdAtIso: "2026-11-23T00:00:00.000Z",
      updatedAtIso: "2026-11-23T00:00:00.000Z",
      sport: "road_running",
      ultraDistance: false,
      loadSpikeSelfReport: true,
      contraindications: [],
      redsSystemicClueSelfReport: false,
      marks: [mark()],
      userHints: [{ stage: "pre_test", tags: [], freeTextNote: "落斜後膝外側痛", userHypothesis: "腓骨肌拉傷" }],
      safetyScreen: "no_hit_on_asked_items",
      safetyAnswers: [{ ruleId: "rf_cardiopulm", answer: "no" }],
      hypotheses: buildHypotheses({
        sport: "road_running",
        ultraDistance: false,
        marks: [mark()],
        tags: [],
        historyIncomplete: false,
        safetyScreen: "no_hit_on_asked_items",
      }),
      selfTests: [{ testId: "noble_simple", outcome: "negative" }],
      selectedTherapyIds: ["load_cut"],
      responseLanguageMode: "zh-TW-only",
    };
    const md = formatHandoff(record, "orthopedist");
    assert.deepEqual(findBanned(md), []);
    assert.match(md, /逐題|→ 否/);
    assert.match(md, /是否需要/);
  });

  it("TC-CP-03 every gear item has use and wean text", () => {
    for (const item of GEAR) {
      assert.ok(item.whenToUseZh.length > 0);
      assert.ok(item.whenToWeanOffZh.length > 0);
    }
    const diet = JSON.stringify({ DIET_DISCUSS, DIET_LIMIT });
    assert.equal(/布洛芬|NSAID|維他命 D 預防 MTSS/i.test(diet), false);
  });

  it("TC-ST-02 and TC-ST-03 merge is idempotent and rejects unknown schemas", () => {
    const base = {
      schemaVersion: "1.0.3" as const,
      knowledgeGraphVersion: "1.0.3",
      sessionId: "s1",
      episodeId: "e",
      createdAtIso: "2026-11-23T00:00:00.000Z",
      updatedAtIso: "2026-11-23T00:00:00.000Z",
      sport: "road_running" as const,
      ultraDistance: false,
      loadSpikeSelfReport: false,
      contraindications: [],
      redsSystemicClueSelfReport: false,
      marks: [mark()],
      userHints: [],
      safetyScreen: "incomplete" as const,
      safetyAnswers: [],
      hypotheses: [],
      selfTests: [],
      selectedTherapyIds: [],
      responseLanguageMode: "zh-TW-only" as const,
    };
    const first = mergeSessions([], [base]);
    assert.equal(first.addedCount, 1);
    const second = mergeSessions(first.sessions, [base]);
    assert.equal(second.addedCount, 0);
    assert.equal(second.skippedCount, 1);
    const bad = parseArchive({ schemaVersion: "9.9.9", app: "quackcheck", exportedAtIso: "x", sessions: [] });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.match(bad.rejectedReasonZh, /不支援/);
  });
});
