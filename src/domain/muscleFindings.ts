import type { Hypothesis, PainMark, RegionId } from "@/domain/types";

export type MuscleFinding = {
  id: string;
  labelZh: string;
  reasonZh: string;
  pattern: string;
};

type Rule = MuscleFinding & {
  regions?: RegionId[];
  conditions?: string[];
};

const RULES: Rule[] = [
  {
    id: "lat-knee-local",
    regions: ["lat_knee"],
    conditions: ["itbs"],
    labelZh: "股外側肌、髂脛束",
    reasonZh: "膝外側痛可以係股外側肌同髂脛束本地受拉，不一定係關節本身。",
    pattern: "vastus lateralis|iliotibial",
  },
  {
    id: "lat-knee-upstream",
    regions: ["lat_knee", "lat_hip"],
    conditions: ["itbs", "glute_med_tfl"],
    labelZh: "臀中肌、闊筋膜張肌",
    reasonZh: "按觸發點同張力嘅講法，臀中肌、闊筋膜張肌可以令膝外側覺得痛。呢個係上游線索，不是判斷。",
    pattern: "gluteus medius|gluteus minimus|tensor fasciae latae",
  },
  {
    id: "ant-knee",
    regions: ["ant_knee"],
    conditions: ["pfps", "patellar_tendon"],
    labelZh: "股四頭肌",
    reasonZh: "膝前面痛有時同股內側肌、股直肌嘅負荷或牽涉有關，可以同治療師對髕股關節同髕腱。",
    pattern: "vastus medialis|vastus lateralis|rectus femoris|vastus intermedius",
  },
  {
    id: "post-knee",
    regions: ["post_knee"],
    labelZh: "膝後肌、腓腸肌",
    reasonZh: "膝後面可以係膕肌，或者腓腸肌近端。金色只係標出值得討論嘅肌肉。",
    pattern: "popliteus|gastrocnemius",
  },
  {
    id: "calf",
    regions: ["post_calf"],
    conditions: ["calf_load"],
    labelZh: "腓腸肌、比目魚肌",
    reasonZh: "小腿肚痛多數先討論腓腸肌同比目魚肌嘅負荷。比目魚肌嘅牽涉可以去到腳跟同足底。",
    pattern: "gastrocnemius|soleus|plantaris",
  },
  {
    id: "achilles-muscle",
    regions: ["achilles", "heel"],
    conditions: ["achilles_rupture_clue"],
    labelZh: "小腿三頭肌",
    reasonZh: "跟腱同腳跟痛，常見同腓腸肌、比目魚肌一齊討論。如果有啪一聲，要先當面看，唔好當係普通肌肉痛。",
    pattern: "gastrocnemius|soleus",
  },
  {
    id: "plantar-referral",
    regions: ["plantar"],
    conditions: ["plantar_fascia"],
    labelZh: "足底肌、小腿後肌",
    reasonZh: "足底痛可以係足底筋膜本地，亦可由比目魚肌、脛後肌嘅牽涉引起。金色係討論起點。",
    pattern: "abductor hallucis|flexor digitorum brevis|quadratus plantae|soleus|tibialis posterior",
  },
  {
    id: "shin",
    regions: ["med_tibia", "ant_shin"],
    conditions: ["mtss", "bone_stress"],
    labelZh: "脛後肌、比目魚肌",
    reasonZh: "小腿內側痛要同時討論軟組織同骨面。如果越跑越痛、一指骨面，先同醫生討論骨應力，唔好當係普通肌肉痠。",
    pattern: "tibialis posterior|soleus|flexor digitorum longus|tibialis anterior",
  },
  {
    id: "shin-bone",
    regions: ["med_tibia"],
    conditions: ["bone_stress"],
    labelZh: "脛骨",
    reasonZh: "打開「骨骼」先睇到脛骨。骨面痛要先當面評估，模型上嘅顏色不是判斷有沒有骨應力。",
    pattern: "\\btibia\\b|body of tibia|medial surface of tibia",
  },
  {
    id: "hip-lateral",
    regions: ["lat_hip"],
    conditions: ["glute_med_tfl"],
    labelZh: "臀中肌、臀小肌",
    reasonZh: "臀外側痛好常見係臀中肌、臀小肌或闊筋膜張肌，可以牽涉到大腿外側。",
    pattern: "gluteus medius|gluteus minimus|tensor fasciae latae",
  },
  {
    id: "deep-glute",
    regions: ["deep_glute"],
    conditions: ["deep_glute"],
    labelZh: "梨狀肌、臀大肌",
    reasonZh: "臀深層痛可以同梨狀肌、閉孔內肌一齊討論，有時會牽涉到大腿後側。不是判斷神經有沒有受壓。",
    pattern: "piriformis|gluteus maximus|gemellus|obturator internus|quadratus femoris",
  },
  {
    id: "hamstring",
    regions: ["post_thigh"],
    labelZh: "大腿後肌",
    reasonZh: "大腿後面先討論股二頭肌、半腱肌、半膜肌。近坐骨嘅痛要同治療師分清係肌腱定係腰痛牽涉。",
    pattern: "biceps femoris|semitendinosus|semimembranosus",
  },
  {
    id: "quad",
    regions: ["ant_thigh"],
    labelZh: "股四頭肌",
    reasonZh: "大腿前面多數係股直肌同股外側、股內側肌。股直肌跨越髖同膝，兩頭都可以覺得緊。",
    pattern: "rectus femoris|vastus lateralis|vastus medialis|vastus intermedius",
  },
  {
    id: "adductor",
    regions: ["med_thigh", "groin"],
    labelZh: "內收肌、髂腰肌",
    reasonZh: "鼠蹊同大腿內側可以係內收肌，或者髂腰肌。模型標出嚟係方便你指給治療師，不是判斷拉傷等級。",
    pattern: "adductor|gracilis|pectineus|iliacus|psoas",
  },
  {
    id: "low-back",
    regions: ["low_back"],
    conditions: ["low_back_referral"],
    labelZh: "腰方肌、豎脊肌、臀中肌",
    reasonZh: "下背痛有時係腰方肌或豎脊肌，臀中肌嘅牽涉亦可以覺得係腰痛。如果有腳麻或大小便異常，先去急症，唔好喺度對肌肉。",
    pattern: "quadratus lumborum|iliocostalis lumborum|multifidus|gluteus medius",
  },
  {
    id: "upper-back",
    regions: ["upper_back"],
    labelZh: "斜方肌、菱形肌",
    reasonZh: "上背緊多數先睇斜方肌同菱形肌。金色係可能相關嘅肌肉，不是判斷。",
    pattern: "trapezius|rhomboid",
  },
  {
    id: "neck",
    regions: ["neck"],
    labelZh: "胸鎖乳突肌、斜方肌",
    reasonZh: "頸痛常見同胸鎖乳突肌、上斜方肌、肩胛提肌有關，可以牽涉到頭同肩。",
    pattern: "sternocleidomastoid|trapezius|splenius|levator scapulae",
  },
  {
    id: "shoulder",
    regions: ["shoulder"],
    labelZh: "旋轉袖、三角肌",
    reasonZh: "肩痛可以係岡下肌、岡上肌或肩胛下肌嘅牽涉，三角肌有時只係覺得痛嘅位置。",
    pattern: "infraspinatus|supraspinatus|subscapularis|deltoid|teres minor",
  },
  {
    id: "elbow",
    regions: ["elbow"],
    labelZh: "前臂伸屈肌",
    reasonZh: "肘痛多數先討論肱橈肌、伸腕肌或屈腕肌，唔好一開始就當係關節。",
    pattern: "brachioradialis|extensor carpi|flexor carpi|anconeus|brachialis",
  },
  {
    id: "wrist",
    regions: ["wrist"],
    labelZh: "前臂肌",
    reasonZh: "手腕痛可以係前臂伸肌或屈肌嘅肌腱負荷。金色標出常見相關肌肉。",
    pattern: "extensor carpi|flexor carpi|extensor digitorum|flexor digitorum",
  },
];

export function findingsFor(marks: PainMark[], hypotheses: Hypothesis[]): MuscleFinding[] {
  const regions = new Set(marks.map((mark) => mark.regionId));
  const conditions = new Set(hypotheses.map((item) => item.conditionId));
  const picked: MuscleFinding[] = [];
  for (const rule of RULES) {
    const regionHit = rule.regions?.some((region) => regions.has(region)) ?? false;
    const conditionHit = rule.conditions?.some((condition) => conditions.has(condition)) ?? false;
    if (!regionHit && !conditionHit) continue;
    picked.push({ id: rule.id, labelZh: rule.labelZh, reasonZh: rule.reasonZh, pattern: rule.pattern });
    if (picked.length >= 4) break;
  }
  return picked;
}
