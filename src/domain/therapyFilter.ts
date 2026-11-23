import { GEAR, THERAPIES } from "./knowledge.ts";
import type {
  ContraindicationFlag,
  GearItem,
  Hypothesis,
  PainMark,
  SafetyScreen,
  TherapyCard,
} from "./types.ts";

function mustRuleOutRegions(hypotheses: Hypothesis[]): Set<string> {
  const regions = new Set<string>();
  for (const item of hypotheses) {
    if (item.role === "must_rule_out_first") {
      for (const region of item.regionIds) regions.add(region);
    }
  }
  return regions;
}

function insertion(marks: PainMark[]): boolean {
  return marks.some(
    (mark) =>
      mark.regionId === "achilles" &&
      (mark.zoneDetail === "achilles_insertion" || /附著|跟骨/.test(mark.targetLabelZh ?? "")),
  );
}

export function visibleTherapies(input: {
  safety: SafetyScreen;
  hypotheses: Hypothesis[];
  flags: ContraindicationFlag[];
  marks: PainMark[];
  reds: boolean;
}): TherapyCard[] {
  if (input.safety === "hit") return [];
  const flagged = new Set(input.flags);
  const blockedRegions = mustRuleOutRegions(input.hypotheses);
  const ids = new Set(input.hypotheses.map((item) => item.conditionId));
  const onlyReferral =
    ids.size > 0 && [...ids].every((id) => id === "low_back_referral" || id === "neuro_clue");

  return THERAPIES.filter((card) => {
    if (input.safety === "incomplete") return card.id === "load_cut";
    if (onlyReferral && card.modality !== "load_management") return false;
    if (card.conditionIds.length > 0 && !card.conditionIds.some((id) => ids.has(id))) return false;
    if (card.blockedByFlags?.some((flag) => flagged.has(flag))) return false;
    if (card.highIntensity && input.reds) return false;
    if (card.id === "df_endrange" && insertion(input.marks)) return false;
    if (card.blockedIfMustRuleOut && card.targetRegionIds.some((region) => blockedRegions.has(region))) {
      return false;
    }
    return true;
  });
}

export function visibleGear(hypotheses: Hypothesis[]): GearItem[] {
  const ids = new Set(hypotheses.map((item) => item.conditionId));
  return GEAR.filter((item) => item.conditionIds.some((id) => ids.has(id)));
}

export function groupTherapies(cards: TherapyCard[]) {
  return {
    do_first: cards.filter((card) => card.tier === "do_first"),
    alongside: cards.filter((card) => card.tier === "alongside"),
    learn_more: cards.filter((card) => card.tier === "learn_more"),
  };
}
