import { RED_FLAGS } from "./knowledge.ts";
import {
  DURATION_CHOICES,
  REGION_LABEL,
  SIDE_LABEL,
  SPORT_LABEL,
  type AssessmentSessionRecord,
  type PainMark,
} from "./types.ts";

const ANSWER_LABEL = {
  yes: "是",
  no: "否",
  unsure: "不確定",
  skipped: "跳過",
} as const;

const ONSET_LABEL: Record<NonNullable<PainMark["onset"]>, string> = {
  sudden_pop: "突然啪一聲",
  trauma: "扭傷或撞擊",
  gradual_days: "數日內漸進",
  gradual_weeks: "數週以上",
};

const WARM: Record<NonNullable<PainMark["warmUp"]>, string> = {
  eases: "熱身後減輕",
  unchanged: "熱身後差不多",
  worsens: "熱身後更痛",
};

const NEXT: Record<NonNullable<PainMark["nextDay"]>, string> = {
  better: "第二天較好",
  same: "第二天差不多",
  worse: "第二天更差",
};

const WB: Record<NonNullable<PainMark["weightBearing"]>, string> = {
  run_ok: "仍可跑",
  walk_only: "只能走",
  walk_pain: "走路也痛",
  cannot_four_steps: "走不到四步",
};

const SWELL: Record<NonNullable<PainMark["swelling"]>, string> = {
  none: "沒有明顯腫",
  local: "睇得到腫",
  calf_diffuse: "小腿整段腫",
  muscle_knot: "摸到硬塊或硬結",
};

const QUALITY: Record<NonNullable<PainMark["painQuality"]>, string> = {
  sharp: "銳而局限",
  diffuse: "悶而擴散",
  burning: "灼熱或麻",
  stiff: "緊繃",
};

const SCREEN: Record<AssessmentSessionRecord["safetyScreen"], string> = {
  hit: "有題目答「是」，或痛史裡已有走不到四步／突然啪一聲。只準備就醫。",
  no_hit_on_asked_items: "已回答的題目沒有勾選「是」。這並不因此知道有沒有骨折、斷裂或血栓。",
  incomplete: "還有題目未答、跳過或不確定。不能把這次當作已經問完。",
};

function painWords(score: number): string {
  if (score <= 1) return "幾乎不痛";
  if (score <= 3) return "輕微";
  if (score <= 5) return "中等";
  if (score <= 7) return "頗痛";
  if (score <= 9) return "很痛";
  return "痛到要停";
}

function markLine(mark: PainMark): string {
  const duration = DURATION_CHOICES.find((item) => item.id === mark.durationBucket);
  const bits = [
    `${SIDE_LABEL[mark.side]}${REGION_LABEL[mark.regionId]}`,
    mark.targetLabelZh ? `點選：${mark.targetLabelZh}` : "",
    mark.zoneDetail ? `細分：${mark.zoneDetail}` : "",
    mark.onset ? ONSET_LABEL[mark.onset] : "起病未填",
    duration ? duration.label : mark.durationDays !== undefined ? `約 ${mark.durationDays} 日` : "日數未填",
    mark.course === "intermittent"
      ? "偶發性痛"
      : mark.course === "spontaneous"
        ? "自發痛"
        : mark.course === "tender"
          ? "按壓先痛"
          : mark.course === "continuous" || mark.course === "steady"
            ? "持續痛"
            : "",
    mark.triggers?.length ? `觸發：${mark.triggers.join("、")}` : "",
    mark.triggerNote ? `觸發補充：${mark.triggerNote}` : "",
    mark.vasNow !== undefined ? `而家痛感 ${mark.vasNow}/10（${painWords(mark.vasNow)}）` : "",
    mark.vasWorst !== undefined ? `最痛 ${mark.vasWorst}/10（${painWords(mark.vasWorst)}）` : "",
    mark.painQuality ? QUALITY[mark.painQuality] : "",
    mark.warmUp ? WARM[mark.warmUp] : "",
    mark.nextDay ? NEXT[mark.nextDay] : "",
    mark.nightPain === undefined ? "" : mark.nightPain ? "有夜間痛" : "沒有夜間痛",
    mark.swelling ? SWELL[mark.swelling] : "",
    mark.weightBearing ? WB[mark.weightBearing] : "",
  ];
  return bits.filter(Boolean).join("；");
}

export function formatHandoff(
  record: AssessmentSessionRecord,
  target: "physiotherapist" | "orthopedist",
): string {
  const hint = record.userHints[0];
  const lines: string[] = [
    `# 半桶庸醫 QuackCheck 就診摘要`,
    ``,
    `這份摘要整理自使用者自己的描述，供與註冊物理治療師或骨科醫生討論。它不是醫療診斷，也不表示已知有沒有骨折或斷裂。`,
    ``,
    `- 運動：${record.sport === "unspecified" ? "未填" : SPORT_LABEL[record.sport]}${record.ultraDistance ? "（自述超長距離）" : ""}`,
    `- 訓練量自評：${record.loadSpikeSelfReport ? "近期有明顯增加" : "沒有報告驟增"}`,
    `- 安全篩檢：${SCREEN[record.safetyScreen]}`,
    `- 個人禁忌：${record.contraindications.length ? record.contraindications.join("、") : "沒有勾選"}`,
    `- 全身線索自述：${record.redsSystemicClueSelfReport ? "有反覆骨痛、月經變化或進食／體重明顯不足的自述，建議向醫生提及" : "沒有勾選"}`,
    ``,
    `## 痛點`,
    ...record.marks.map((mark) => `- ${markLine(mark)}`),
    ``,
    `## 原話與猜測`,
    `- ${hint?.freeTextNote || "（沒有自由文字）"}`,
    `- 個人猜測：${hint?.userHypothesis || "（沒有）"}`,
    ``,
    `## 紅旗逐題`,
    ...record.safetyAnswers.map((answer) => {
      const rule = RED_FLAGS.find((item) => item.id === answer.ruleId);
      return `- ${rule?.questionZh ?? answer.ruleId} → ${ANSWER_LABEL[answer.answer]}`;
    }),
    ``,
    `## 規則列出的假設（最高只到中度吻合）`,
    ...record.hypotheses.map(
      (item) =>
        `- ${item.titleZh}（${item.titleEn}）／${item.role}／吻合 ${item.fit}。支持：${item.supports.join("、") || "—"}。保留意見：${item.against.join("、") || "—"}。${item.userGuessNoteZh ?? ""}`,
    ),
    ``,
    `## 自我檢查`,
    ...(record.selfTests.length
      ? record.selfTests.map(
          (test) =>
            `- ${test.testId}：${test.outcome === "negative" ? "這一下沒有重現你的痛" : test.outcome}${test.userNote ? `。筆記：${test.userNote}` : ""}`,
        )
      : ["- （沒有做）"]),
    ``,
    `## 納入摘要的處理方向`,
    ...(record.selectedTherapyIds.length
      ? record.selectedTherapyIds.map((id) => `- ${id}`)
      : ["- （沒有選）"]),
  ];

  if (target === "orthopedist") {
    lines.push(
      ``,
      `## 給骨科醫生討論的問句`,
      `- 若骨痛持續，X 光有機會看不到早期骨應力，是否需要進一步影像？`,
      `- 若痛在肌腱，是否需要超聲波？`,
      `- 若深層軟組織或神經症狀持續，是否需要磁力共振？`,
      `- 這些是問句，不是指示照哪一種。`,
    );
  } else {
    lines.push(
      ``,
      `## 給物理治療師`,
      `- 請把「覺得痛的位置」和「上游」分開看。`,
      `- 使用者想保留的訓練限制，見上面的訓練量與原話。`,
    );
  }

  lines.push(``, `知識圖譜 ${record.knowledgeGraphVersion} · 紀錄 ${record.createdAtIso}`);
  return lines.join("\n");
}
