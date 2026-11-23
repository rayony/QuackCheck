import { RED_FLAGS, RULE_ORDER } from "./knowledge.ts";
import type {
  ContextHintTag,
  PainMark,
  RedFlagRule,
  SafetyAnswer,
  SafetyScreen,
} from "./types.ts";

const ANKLE_REGIONS = new Set(["lat_ankle", "med_ankle", "heel", "dorsum_foot"]);
const BONE_REGIONS = new Set(["med_tibia", "plantar", "heel", "ant_shin"]);
const CAUDA_REGIONS = new Set(["deep_glute", "lat_hip", "low_back"]);

export function collectTags(tags: ContextHintTag[], marks: PainMark[]): Set<ContextHintTag> {
  const set = new Set(tags);
  for (const mark of marks) {
    if (mark.onset === "sudden_pop") set.add("sudden_pop");
    if (mark.onset === "trauma") set.add("impact_fall");
    if (mark.nightPain) set.add("night_pain");
    if (mark.painQuality === "burning") set.add("neurological");
    if (mark.swelling === "calf_diffuse") set.add("long_travel_or_immobility");
  }
  return set;
}

export function requiredRules(marks: PainMark[], tags: ContextHintTag[]): RedFlagRule[] {
  const tagSet = collectTags(tags, marks);
  const regions = new Set(marks.map((mark) => mark.regionId));
  const selected = RED_FLAGS.filter((rule) => {
    if (rule.universal) return true;
    if (rule.id === "rf_cauda_equina") {
      if ([...regions].some((region) => CAUDA_REGIONS.has(region))) return true;
      if (tagSet.has("heavy_lifting") || tagSet.has("neurological")) return true;
      return false;
    }
    if (rule.id === "rf_ottawa_weight") {
      if (tagSet.has("ankle_twist") || tagSet.has("impact_fall")) return true;
      if ([...regions].some((region) => ANKLE_REGIONS.has(region))) return true;
      return marks.some(
        (mark) => mark.onset === "trauma" || mark.weightBearing === "cannot_four_steps",
      );
    }
    if (rule.id === "rf_bone_stress") {
      if ([...regions].some((region) => BONE_REGIONS.has(region))) return true;
      return marks.some((mark) => mark.nightPain === true || mark.warmUp === "worsens");
    }
    const regionHit = rule.triggerRegions?.some((region) => regions.has(region)) ?? false;
    const tagHit = rule.triggerHintTags?.some((tag) => tagSet.has(tag)) ?? false;
    return regionHit || tagHit;
  });
  return selected.sort((a, b) => RULE_ORDER.indexOf(a.id) - RULE_ORDER.indexOf(b.id));
}

export function requiredRuleIds(marks: PainMark[], tags: ContextHintTag[]): string[] {
  return requiredRules(marks, tags).map((rule) => rule.id);
}

export function computeSafetyScreen(
  requiredRuleIdsInput: string[],
  answers: SafetyAnswer[],
  marks: PainMark[],
): SafetyScreen {
  const answerMap = new Map(answers.map((answer) => [answer.ruleId, answer]));
  for (const ruleId of requiredRuleIdsInput) {
    if (answerMap.get(ruleId)?.answer === "yes") return "hit";
  }
  if (marks.some((mark) => mark.weightBearing === "cannot_four_steps" || mark.onset === "sudden_pop")) {
    return "hit";
  }
  for (const ruleId of requiredRuleIdsInput) {
    const answer = answerMap.get(ruleId)?.answer;
    if (!answer || answer === "skipped" || answer === "unsure") return "incomplete";
  }
  return "no_hit_on_asked_items";
}

export function screenUrgency(
  marks: PainMark[],
  answers: SafetyAnswer[],
): "emergency_now" | "same_day_clinician" | null {
  if (marks.some((mark) => mark.weightBearing === "cannot_four_steps" || mark.onset === "sudden_pop")) {
    return "emergency_now";
  }
  const yes = answers.filter((answer) => answer.answer === "yes");
  if (yes.length === 0) return null;
  const rules = new Map(RED_FLAGS.map((rule) => [rule.id, rule]));
  if (yes.some((answer) => rules.get(answer.ruleId)?.urgency === "emergency_now")) return "emergency_now";
  return "same_day_clinician";
}

const HISTORY_KEYS: (keyof PainMark)[] = [
  "side",
  "onset",
  "durationDays",
  "vasNow",
  "vasWorst",
  "painQuality",
  "warmUp",
  "nextDay",
  "nightPain",
  "swelling",
  "weightBearing",
];

export function isHistoryIncomplete(marks: PainMark[]): boolean {
  if (marks.length === 0) return true;
  return marks.some((mark) =>
    HISTORY_KEYS.some((key) => {
      const value = mark[key];
      return value === undefined || value === null || value === "";
    }),
  );
}
