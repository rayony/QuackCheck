export type SportType = "unspecified" | "road_running" | "trail_running" | "cycling" | "triathlon";

export type TargetKind =
  | "muscle"
  | "tendon"
  | "fascia_band"
  | "bone"
  | "bursa"
  | "nerve"
  | "joint"
  | "other";

export type SafetyScreen = "hit" | "no_hit_on_asked_items" | "incomplete";
export type HypothesisFit = "low" | "moderate";
export type ResponseLanguageMode = "zh-TW-only" | "auto";

export type RegionId =
  | "lat_knee"
  | "ant_knee"
  | "med_knee"
  | "post_knee"
  | "med_tibia"
  | "ant_shin"
  | "post_calf"
  | "achilles"
  | "plantar"
  | "dorsum_foot"
  | "heel"
  | "lat_ankle"
  | "med_ankle"
  | "lat_hip"
  | "groin"
  | "deep_glute"
  | "ant_thigh"
  | "post_thigh"
  | "med_thigh"
  | "low_back"
  | "upper_back"
  | "neck"
  | "shoulder"
  | "elbow"
  | "wrist";

export type ZoneDetail =
  | "retro_patellar"
  | "patellar_tendon"
  | "shin_diffuse"
  | "shin_focal"
  | "achilles_mid"
  | "achilles_insertion"
  | "unspecified";

export type ContextHintTag =
  | "ankle_twist"
  | "impact_fall"
  | "heavy_lifting"
  | "mileage_spike"
  | "downhill_overload"
  | "bike_fit_change"
  | "new_footwear"
  | "long_travel_or_immobility"
  | "fluoroquinolone"
  | "sudden_pop"
  | "night_pain"
  | "neurological"
  | "systemic_unwell"
  | "other";

export type ContraindicationFlag =
  | "pregnant"
  | "anticoagulant"
  | "implanted_device"
  | "skin_broken_or_allergy";

export type TherapyModality =
  | "load_management"
  | "rehab_exercise"
  | "trigger_point"
  | "mobility"
  | "foam_roller"
  | "massage_gun"
  | "taping"
  | "iastm"
  | "haipai_tuina"
  | "magnetic_fork";

export type DurationBucket = "within_1d" | "d1_3" | "about_1w" | "over_1w";

export type PainCourse = "steady" | "continuous" | "intermittent" | "spontaneous" | "tender";

export interface PainMark {
  markId: string;
  side: "left" | "right" | "bilateral";
  regionId: RegionId;
  targetKind?: TargetKind;
  targetLabelZh?: string;
  /** 中段／附著點、髕腱／髕骨後、脛骨一大段／一指骨面。規格外的可選欄，供分流用。 */
  zoneDetail?: ZoneDetail;
  surfacePoint?: [number, number, number];
  meshName?: string;
  painQuality?: "sharp" | "diffuse" | "burning" | "stiff";
  vasNow?: number;
  vasWorst?: number;
  onset?: "sudden_pop" | "trauma" | "gradual_days" | "gradual_weeks";
  durationDays?: number;
  durationBucket?: DurationBucket;
  course?: PainCourse;
  /** 偶發性痛的預設觸發，存顯示用字句 */
  triggers?: string[];
  triggerNote?: string;
  warmUp?: "eases" | "unchanged" | "worsens";
  nextDay?: "better" | "same" | "worse";
  nightPain?: boolean;
  swelling?: "none" | "local" | "calf_diffuse" | "muscle_knot";
  weightBearing?: "run_ok" | "walk_only" | "walk_pain" | "cannot_four_steps";
}

export interface UserContextHint {
  stage: "pre_test" | "during_test";
  tags: ContextHintTag[];
  freeTextNote: string;
  userHypothesis?: string;
  linkedTestId?: string;
}

export interface RedFlagRule {
  id: string;
  universal: boolean;
  triggerRegions?: RegionId[];
  triggerHintTags?: ContextHintTag[];
  questionZh: string;
  questionEn: string;
  clinicalBasis: string;
  urgency: "emergency_now" | "same_day_clinician";
  cannotRuleOutZh: string;
  sourceKey: string;
}

export interface SafetyAnswer {
  ruleId: string;
  answer: "yes" | "no" | "unsure" | "skipped";
  urgency?: "emergency_now" | "same_day_clinician";
}

export interface TestCue {
  labelZh: string;
  pattern: string;
  approach: "medial" | "lateral" | "front" | "back";
  layer: "bone" | "muscle";
}

export interface OrthopedicTest {
  id: string;
  regionId: RegionId;
  nameZh: string;
  nameEn: string;
  targetConditionIds: string[];
  stepsZh: string[];
  stopConditionZh: string;
  positiveMeaningZh: string;
  cannotRuleOutZh: string;
  sourceKey: string;
  cue?: TestCue;
}

export interface SelfTestResult {
  testId: string;
  outcome: "positive" | "negative" | "unsure";
  userNote?: string;
}

export interface Hypothesis {
  conditionId: string;
  titleZh: string;
  titleEn: string;
  fit: HypothesisFit;
  role: "local_pain_site" | "upstream_contributor" | "must_rule_out_first";
  supports: string[];
  against: string[];
  regionIds: RegionId[];
  userGuess: "supported" | "unsupported" | "insufficient" | "not_provided";
  userGuessNoteZh?: string;
  evidenceNoteZh: string;
  sourceKey: string;
}

export interface WhitelistedVideoRef {
  videoId: string;
  format: "standard" | "shorts";
  titleZh: string;
  startSec?: number;
}

export interface TherapyCard {
  id: string;
  modality: TherapyModality;
  tier: "do_first" | "alongside" | "learn_more";
  evidence: "high" | "moderate" | "emerging" | "traditional" | "low";
  titleZh: string;
  titleEn: string;
  dosageZh: string;
  contraindicationsZh: string[];
  blockedByFlags?: ContraindicationFlag[];
  blockedIfMustRuleOut?: boolean;
  highIntensity?: boolean;
  conditionIds: string[];
  targetRegionIds: RegionId[];
  externalGuideUrl?: string;
  youtubeVideos?: WhitelistedVideoRef[];
  youtubePlaylistUrl?: string;
  sourceKey: string;
}

export interface GearItem {
  itemZh: string;
  itemEn: string;
  whenToUseZh: string;
  whenToWeanOffZh: string;
  referenceCatalogUrl?: string;
  conditionIds: string[];
}

export interface AssessmentSessionRecord {
  schemaVersion: "1.0.3";
  knowledgeGraphVersion: string;
  sessionId: string;
  episodeId: string;
  createdAtIso: string;
  updatedAtIso: string;
  sport: SportType;
  ultraDistance: boolean;
  loadSpikeSelfReport: boolean;
  contraindications: ContraindicationFlag[];
  redsSystemicClueSelfReport: boolean;
  marks: PainMark[];
  userHints: UserContextHint[];
  safetyScreen: SafetyScreen;
  safetyAnswers: SafetyAnswer[];
  hypotheses: Hypothesis[];
  selfTests: SelfTestResult[];
  selectedTherapyIds: string[];
  handoffTarget?: "physiotherapist" | "orthopedist";
  responseLanguageMode: ResponseLanguageMode;
  aiSummaryNote?: string;
}

export interface HistoryArchiveExport {
  schemaVersion: "1.0.3";
  app: "quackcheck";
  exportedAtIso: string;
  sessions: AssessmentSessionRecord[];
}

export interface ImportMergeResult {
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  rejectedReasonZh?: string;
}

export const KNOWLEDGE_GRAPH_VERSION = "1.0.3";
export const SCHEMA_VERSION = "1.0.3" as const;

export const SPORT_LABEL: Record<SportType, string> = {
  unspecified: "未填",
  road_running: "路跑",
  trail_running: "越野跑",
  cycling: "單車",
  triathlon: "三項鐵人",
};

export const DURATION_CHOICES: { id: DurationBucket; label: string; days: number }[] = [
  { id: "within_1d", label: "1日內", days: 1 },
  { id: "d1_3", label: "1–3 日", days: 3 },
  { id: "about_1w", label: "約 1 星期", days: 7 },
  { id: "over_1w", label: "超過 1 星期", days: 14 },
];

export const TRIGGER_PRESETS = [
  "跑咗幾個鐘",
  "落斜",
  "起步頭幾步",
  "坐低一陣",
  "單車騎一陣",
  "游完",
] as const;

export const REGION_LABEL: Record<RegionId, string> = {
  lat_knee: "膝外側",
  ant_knee: "膝前方",
  med_knee: "膝內側",
  post_knee: "膝後側",
  med_tibia: "小腿內側",
  ant_shin: "小腿前側",
  post_calf: "小腿後側",
  achilles: "阿基里斯腱",
  plantar: "足底內側",
  dorsum_foot: "足背",
  heel: "腳跟",
  lat_ankle: "踝外側",
  med_ankle: "踝內側",
  lat_hip: "臀外側",
  groin: "鼠蹊／髖前",
  deep_glute: "臀深層",
  ant_thigh: "大腿前側",
  post_thigh: "大腿後側",
  med_thigh: "大腿內側",
  low_back: "下背",
  upper_back: "上背",
  neck: "頸",
  shoulder: "肩",
  elbow: "肘",
  wrist: "手腕／手掌",
};

export const SIDE_LABEL = {
  left: "左",
  right: "右",
  bilateral: "兩側",
} as const;
