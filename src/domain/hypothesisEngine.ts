import {
  REGION_LABEL,
  type ContextHintTag,
  type Hypothesis,
  type HypothesisFit,
  type PainMark,
  type RegionId,
  type SafetyScreen,
  type SportType,
  type ZoneDetail,
} from "./types.ts";

const ROLE_RANK = {
  must_rule_out_first: 0,
  local_pain_site: 1,
  upstream_contributor: 2,
} as const;

const EPI: Record<string, number> = {
  pfps: 16.7,
  achilles_mid: 10.3,
  achilles_insertion: 10.3,
  mtss: 9.4,
  itbs: 7.9,
  plantar_fascia: 7.9,
  patellar_tendon: 6,
  glute_med_tfl: 5,
  calf_load: 4,
  deep_glute: 3,
  bone_stress: 2,
  dvt_clue: 2,
  achilles_rupture_clue: 2,
  neuro_clue: 2,
  low_back_referral: 1,
};

const GUESS: { re: RegExp; id: string }[] = [
  { re: /腓骨|peroneal|fibularis/i, id: "peroneal_strain" },
  { re: /髂脛|ITBS|ITB/i, id: "itbs" },
  { re: /髕腱|patellar tendon/i, id: "patellar_tendon" },
  { re: /髕股|PFPS/i, id: "pfps" },
  { re: /夾脛|MTSS|shin splint/i, id: "mtss" },
  { re: /骨應力|應力性|stress fracture/i, id: "bone_stress" },
  { re: /足底/i, id: "plantar_fascia" },
  { re: /梨狀|深臀/i, id: "deep_glute" },
  { re: /臀中|闊筋膜|TFL/i, id: "glute_med_tfl" },
  { re: /阿基里斯|achilles/i, id: "achilles_mid" },
];

function zone(mark: PainMark): ZoneDetail | undefined {
  if (mark.zoneDetail) return mark.zoneDetail;
  const label = mark.targetLabelZh ?? "";
  if (/附著|跟骨/.test(label)) return "achilles_insertion";
  if (/髕腱/.test(label)) return "patellar_tendon";
  if (/一指|骨面|局限/.test(label)) return "shin_focal";
  return undefined;
}

function capFit(
  fit: HypothesisFit,
  historyIncomplete: boolean,
  safety: SafetyScreen,
): HypothesisFit {
  if (historyIncomplete || safety === "incomplete") return "low";
  return fit;
}

function fitOf(supports: string[], against: string[]): HypothesisFit {
  if (supports.length >= 2 && against.length === 0) return "moderate";
  return "low";
}

function blank(
  partial: Omit<Hypothesis, "userGuess" | "fit"> & { fit?: HypothesisFit },
  historyIncomplete: boolean,
  safety: SafetyScreen,
): Hypothesis {
  const fit = capFit(partial.fit ?? fitOf(partial.supports, partial.against), historyIncomplete, safety);
  return { ...partial, fit, userGuess: "not_provided" };
}

export function buildHypotheses(input: {
  sport: SportType;
  ultraDistance: boolean;
  marks: PainMark[];
  tags: ContextHintTag[];
  userHypothesis?: string;
  historyIncomplete: boolean;
  safetyScreen: SafetyScreen;
}): Hypothesis[] {
  const { marks, tags, sport, ultraDistance, historyIncomplete, safetyScreen } = input;
  const list: Hypothesis[] = [];
  const regions = new Set(marks.map((mark) => mark.regionId));

  for (const mark of marks) {
    const z = zone(mark);
    const gradual = mark.onset === "gradual_days" || mark.onset === "gradual_weeks";
    const downhill = tags.includes("downhill_overload");
    const load = tags.includes("mileage_spike");
    const focalBone =
      z === "shin_focal" ||
      mark.nightPain === true ||
      mark.warmUp === "worsens" ||
      mark.weightBearing === "walk_pain" ||
      mark.weightBearing === "cannot_four_steps";

    if (mark.regionId === "lat_knee") {
      const supports = ["痛點在膝外側"];
      const against: string[] = [];
      if (gradual) supports.push("起病是漸進的，比較像負荷而不是單一次撞傷");
      if (downhill) supports.push("近期落斜多，膝外側摩擦常被一併提起");
      if (mark.warmUp === "unchanged" || mark.warmUp === "eases") {
        supports.push("熱身後沒有變得更痛");
      }
      if (mark.nightPain) against.push("有夜間痛，不宜只講髂脛束");
      if (mark.onset === "sudden_pop") against.push("有突然啪一聲，先要當面看");
      list.push(
        blank(
          {
            conditionId: "itbs",
            titleZh: "髂脛束相關負荷",
            titleEn: "IT band load",
            role: "local_pain_site",
            supports,
            against,
            regionIds: ["lat_knee"],
            evidenceNoteZh: "膝外側痛時，本地構造與上游臀肌要分開討論。盛行率約 7.9%，不是發生率頭五。",
            sourceKey: "nbk542185",
          },
          historyIncomplete,
          safetyScreen,
        ),
      );
      const up = ["膝外側痛時，臀中肌與闊筋膜張肌是常見要一併看的上游"];
      if (downhill || regions.has("lat_hip")) up.push("有落斜或臀外側也痛，上游線索更多");
      list.push(
        blank(
          {
            conditionId: "glute_med_tfl",
            titleZh: "臀中肌／闊筋膜張肌（上游）",
            titleEn: "Gluteus medius / TFL",
            role: "upstream_contributor",
            supports: up,
            against: [],
            regionIds: ["lat_knee", "lat_hip"],
            evidenceNoteZh: "這是上游檢查區，不是第二個確定問題。",
            sourceKey: "nbk542185",
          },
          historyIncomplete,
          safetyScreen,
        ),
      );
    }

    if (mark.regionId === "ant_knee") {
      const tendon = z === "patellar_tendon";
      const base = ["痛點在膝前方"];
      if (gradual) base.push("漸進起病");
      if (sport === "cycling" || tags.includes("bike_fit_change")) {
        base.push("單車或剛改過設定時，膝前方負荷常被一併討論");
      }
      if (load) base.push("訓練量近期增加");
      if (!tendon) {
        list.push(
          blank(
            {
              conditionId: "pfps",
              titleZh: "髕股關節負荷痛",
              titleEn: "Patellofemoral load",
              role: "local_pain_site",
              supports: base.concat(["較像髕骨後方或周圍，而不是髕腱本體"]),
              against: mark.nightPain ? ["夜間骨痛要先當面評估"] : [],
              regionIds: ["ant_knee"],
              evidenceNoteZh: "非超馬路跑的髕股痛盛行率約 16.7%，發生率約 6.3%。",
              sourceKey: "pmc5095938",
            },
            historyIncomplete,
            safetyScreen,
          ),
        );
      }
      if (tendon || z === undefined) {
        list.push(
          blank(
            {
              conditionId: "patellar_tendon",
              titleZh: "髕腱負荷痛",
              titleEn: "Patellar tendon load",
              role: "local_pain_site",
              supports: tendon
                ? base.concat(["你標的是髕腱本體"])
                : ["位置尚未細分，髕腱與髕股關節並列供討論"],
              against: tendon ? [] : ["尚未指明痛在髕腱本體"],
              regionIds: ["ant_knee"],
              evidenceNoteZh: "起跳、落階時腱本體痛，與髕骨後方痛分開描述。",
              sourceKey: "pmc5095938",
            },
            historyIncomplete,
            safetyScreen,
          ),
        );
      }
    }

    if (mark.regionId === "med_tibia") {
      if (focalBone) {
        const supports = ["小腿內側有骨痛線索"];
        if (mark.nightPain) supports.push("夜間痛");
        if (z === "shin_focal") supports.push("痛窄到大約一指");
        if (mark.weightBearing === "walk_pain" || mark.weightBearing === "cannot_four_steps") {
          supports.push("走路已經痛");
        }
        list.push(
          blank(
            {
              conditionId: "bone_stress",
              titleZh: "骨應力線索（要先當面看）",
              titleEn: "Bone-stress clue",
              role: "must_rule_out_first",
              supports,
              against: [],
              regionIds: ["med_tibia"],
              evidenceNoteZh: "這一項排在夾脛前面。不要滾筒，也不要再跑跑看。",
              sourceKey: "pmc6828998",
            },
            historyIncomplete,
            safetyScreen,
          ),
        );
      }
      const against = focalBone ? ["已有夜間、單點或走路痛，不宜只按夾脛處理"] : [];
      const supports = ["痛在脛骨內側"];
      if (!focalBone && gradual) supports.push("漸進、沒有夜間單點骨痛的描述");
      if (load) supports.push("跑量增加");
      list.push(
        blank(
          {
            conditionId: "mtss",
            titleZh: "內側脛骨壓力（夾脛）方向",
            titleEn: "Medial tibial stress syndrome",
            role: "local_pain_site",
            supports,
            against,
            regionIds: ["med_tibia"],
            evidenceNoteZh: "發生率約 9.4%，盛行率約 9.1%。有骨應力線索時它不是第一句。",
            sourceKey: "pmc8500811",
          },
          historyIncomplete,
          safetyScreen,
        ),
      );
    }

    if (mark.regionId === "post_calf") {
      if (mark.swelling === "calf_diffuse" || tags.includes("long_travel_or_immobility")) {
        list.push(
          blank(
            {
              conditionId: "dvt_clue",
              titleZh: "小腿腫脹線索（要先當面看）",
              titleEn: "Calf clot clue",
              role: "must_rule_out_first",
              supports: ["單側小腿腫或近期久坐不動時，按摩與推拿先停"],
              against: [],
              regionIds: ["post_calf"],
              evidenceNoteZh: "不自行計算風險分數。",
              sourceKey: "pmc6828998",
            },
            historyIncomplete,
            safetyScreen,
          ),
        );
      }
      if (mark.onset === "sudden_pop") {
        list.push(
          blank(
            {
              conditionId: "achilles_rupture_clue",
              titleZh: "突然啪一聲（要先當面看）",
              titleEn: "Sudden pop",
              role: "must_rule_out_first",
              supports: ["小腿或足跟突然啪一聲"],
              against: [],
              regionIds: ["post_calf", "achilles"],
              evidenceNoteZh: "不要用自行擠壓小腿來判斷有沒有斷。",
              sourceKey: "pmc6828998",
            },
            historyIncomplete,
            safetyScreen,
          ),
        );
      }
      const supports = ["痛在小腿後側肌肉範圍"];
      if (gradual) supports.push("漸進起病");
      if (mark.swelling === "muscle_knot") supports.push("摸到硬塊或硬結，不是整段腫起");
      list.push(
        blank(
          {
            conditionId: "calf_load",
            titleZh: "小腿肌肉負荷",
            titleEn: "Calf muscle load",
            role: "local_pain_site",
            supports,
            against:
              mark.swelling === "calf_diffuse" ? ["整段腫脹時不要先按肌肉"] : [],
            regionIds: ["post_calf"],
            evidenceNoteZh: "與阿基里斯腱、深層靜脈栓塞線索並列，不合併成一個名字。",
            sourceKey: "pmc8500811",
          },
          historyIncomplete,
          safetyScreen,
        ),
      );
    }

    if (mark.regionId === "achilles") {
      if (mark.onset === "sudden_pop" || mark.weightBearing === "cannot_four_steps") {
        list.push(
          blank(
            {
              conditionId: "achilles_rupture_clue",
              titleZh: "阿基里斯腱斷裂線索",
              titleEn: "Achilles rupture clue",
              role: "must_rule_out_first",
              supports: ["突然啪一聲或已經不能正常走路"],
              against: [],
              regionIds: ["achilles"],
              evidenceNoteZh: "提踵做不到就要當日評估。",
              sourceKey: "pmc6828998",
            },
            historyIncomplete,
            safetyScreen,
          ),
        );
      }
      const insertion = z === "achilles_insertion";
      const id = insertion ? "achilles_insertion" : "achilles_mid";
      const supports = [insertion ? "痛靠近跟骨附著點" : "痛在腱的中段，或尚未細分所以先按中段討論"];
      if (gradual) supports.push("漸進起病");
      if (mark.warmUp === "eases") supports.push("熱身後痛減輕，比較像肌腱負荷的行為");
      if (ultraDistance && sport === "trail_running") supports.push("超長距離越野時，踝與腱的比例會提高");
      list.push(
        blank(
          {
            conditionId: id,
            titleZh: insertion ? "阿基里斯腱附著點負荷" : "阿基里斯腱中段負荷",
            titleEn: insertion ? "Insertional Achilles load" : "Midportion Achilles load",
            role: "local_pain_site",
            supports,
            against: [],
            regionIds: ["achilles"],
            evidenceNoteZh: insertion
              ? "附著點痛不要把腳踝拉到背屈盡頭。"
              : "非超馬路跑的發生率約 10.3%，盛行率約 6.6%。",
            sourceKey: "pmc8500811",
          },
          historyIncomplete,
          safetyScreen,
        ),
      );
    }

    if (mark.regionId === "plantar") {
      if (focalBone) {
        list.push(
          blank(
            {
              conditionId: "bone_stress",
              titleZh: "足跟骨痛線索（要先當面看）",
              titleEn: "Heel bone-stress clue",
              role: "must_rule_out_first",
              supports: ["足底痛同時有夜間痛、愈走愈痛或很局限的骨點"],
              against: [],
              regionIds: ["plantar"],
              evidenceNoteZh: "不要在這個點上大力刮。",
              sourceKey: "pmc6828998",
            },
            historyIncomplete,
            safetyScreen,
          ),
        );
      }
      const supports = ["痛在足底內側"];
      if (gradual) supports.push("漸進起病");
      if (mark.warmUp === "eases") supports.push("活動幾步後略減，像筋膜負荷的常見描述");
      list.push(
        blank(
          {
            conditionId: "plantar_fascia",
            titleZh: "足底筋膜負荷痛",
            titleEn: "Plantar fascia load",
            role: "local_pain_site",
            supports,
            against: focalBone ? ["有骨痛線索時不要只講筋膜"] : [],
            regionIds: ["plantar"],
            evidenceNoteZh: "發生率約 6.1%，盛行率約 7.9%。不必稱作炎症。",
            sourceKey: "pmc8500811",
          },
          historyIncomplete,
          safetyScreen,
        ),
      );
    }

    if (mark.regionId === "lat_hip") {
      const supports = ["痛在臀外側"];
      if (regions.has("lat_knee")) supports.push("同時有膝外側痛，上游與下游放在一起討論");
      if (downhill) supports.push("落斜多");
      list.push(
        blank(
          {
            conditionId: "glute_med_tfl",
            titleZh: "臀中肌負荷",
            titleEn: "Gluteus medius load",
            role: "local_pain_site",
            supports,
            against: [],
            regionIds: ["lat_hip"],
            evidenceNoteZh: "臀外側痛本身可以是本地問題，也可以解釋膝外側。",
            sourceKey: "nbk542185",
          },
          historyIncomplete,
          safetyScreen,
        ),
      );
    }

    if (mark.regionId === "deep_glute") {
      if (mark.painQuality === "burning" || tags.includes("neurological")) {
        list.push(
          blank(
            {
              conditionId: "neuro_clue",
              titleZh: "神經症狀線索（要先當面看）",
              titleEn: "Nerve clue",
              role: "must_rule_out_first",
              supports: ["有灼熱、麻或你標記了神經症狀"],
              against: [],
              regionIds: ["deep_glute"],
              evidenceNoteZh: "膝以下愈來愈麻或無力，不是拉筋的對象。",
              sourceKey: "pmc12195327",
            },
            historyIncomplete,
            safetyScreen,
          ),
        );
      }
      const supports = ["痛在臀深層或坐骨附近"];
      if (gradual) supports.push("不是單一次撞傷的描述");
      list.push(
        blank(
          {
            conditionId: "deep_glute",
            titleZh: "深臀痛假設",
            titleEn: "Deep gluteal pain",
            role: "local_pain_site",
            supports,
            against: [],
            regionIds: ["deep_glute"],
            evidenceNoteZh: "不預設就是梨狀肌。坐痛可以帶去討論。",
            sourceKey: "pmc12195327",
          },
          historyIncomplete,
          safetyScreen,
        ),
      );
    }

    if (mark.regionId === "low_back") {
      list.push(
        blank(
          {
            conditionId: "low_back_referral",
            titleZh: "下背只作轉介",
            titleEn: "Low-back referral only",
            role: "must_rule_out_first",
            supports: ["階段 1 不提供下背練習或手法"],
            against: [],
            regionIds: ["low_back"],
            evidenceNoteZh: "請見註冊物理治療師或醫生。若有鞍區麻木或大小便異常，打 999。",
            sourceKey: "pmc12195327",
          },
          historyIncomplete,
          safetyScreen,
        ),
      );
    }

    const covered: RegionId[] = [
      "lat_knee",
      "ant_knee",
      "med_tibia",
      "post_calf",
      "achilles",
      "plantar",
      "lat_hip",
      "deep_glute",
      "low_back",
    ];
    if (!covered.includes(mark.regionId)) {
      const label = REGION_LABEL[mark.regionId];
      const urgent =
        mark.onset === "trauma" ||
        mark.onset === "sudden_pop" ||
        mark.weightBearing === "cannot_four_steps";
      const supports = [`痛在${label}`];
      if (gradual) supports.push("起病是漸進的");
      if (mark.swelling === "muscle_knot") supports.push("摸到硬塊或硬結，不是整段腫起");
      list.push(
        blank(
          {
            conditionId: `local_${mark.regionId}`,
            titleZh: urgent ? `${label}要先當面看` : `${label}負荷`,
            titleEn: label,
            role: urgent ? "must_rule_out_first" : "local_pain_site",
            supports,
            against: [],
            regionIds: [mark.regionId],
            evidenceNoteZh: "這個分區只整理位置同你的描述，不把它說成某一種傷。",
            sourceKey: "pmc8500811",
          },
          historyIncomplete,
          safetyScreen,
        ),
      );
    }

    if (
      mark.course === "intermittent" ||
      mark.course === "spontaneous" ||
      mark.course === "continuous" ||
      mark.course === "steady" ||
      mark.course === "tender" ||
      mark.triggerNote ||
      (mark.triggers && mark.triggers.length > 0)
    ) {
      const bits = [
        mark.course === "intermittent" ? "偶發性痛，不是一直都痛" : "",
        mark.course === "spontaneous" ? "自發痛，沒做動作都會痛" : "",
        mark.course === "continuous" || mark.course === "steady" ? "持續痛" : "",
        mark.course === "tender" ? "按壓先痛，未做動作未必痛" : "",
        mark.triggers && mark.triggers.length > 0 ? `觸發：${mark.triggers.join("、")}` : "",
        mark.triggerNote ? `觸發補充：${mark.triggerNote}` : "",
      ].filter(Boolean);
      for (const item of list) {
        if (!item.regionIds.includes(mark.regionId)) continue;
        for (const bit of bits) {
          if (!item.supports.includes(bit)) item.supports.push(bit);
        }
      }
    }
  }

  const merged = dedupe(list);
  merged.sort((a, b) => {
    const role = ROLE_RANK[a.role] - ROLE_RANK[b.role];
    if (role !== 0) return role;
    const score = b.supports.length - b.against.length - (a.supports.length - a.against.length);
    if (score !== 0) return score;
    return (EPI[b.conditionId] ?? 0) - (EPI[a.conditionId] ?? 0);
  });
  return annotateGuess(merged, input.userHypothesis);
}

function dedupe(list: Hypothesis[]): Hypothesis[] {
  const map = new Map<string, Hypothesis>();
  for (const item of list) {
    const prev = map.get(item.conditionId + item.role);
    if (!prev) {
      map.set(item.conditionId + item.role, item);
      continue;
    }
    const supports = [...new Set([...prev.supports, ...item.supports])];
    const against = [...new Set([...prev.against, ...item.against])];
    const regionIds = [...new Set([...prev.regionIds, ...item.regionIds])] as RegionId[];
    map.set(item.conditionId + item.role, {
      ...prev,
      supports,
      against,
      regionIds,
      fit: prev.fit === "moderate" || item.fit === "moderate" ? prev.fit : item.fit,
    });
  }
  return [...map.values()];
}

function annotateGuess(list: Hypothesis[], raw?: string): Hypothesis[] {
  const text = raw?.trim() ?? "";
  if (!text) return list.map((item) => ({ ...item, userGuess: "not_provided" }));
  const matched = GUESS.find((guess) => guess.re.test(text));
  if (!matched) {
    return list.map((item, index) => ({
      ...item,
      userGuess: index === 0 ? "insufficient" : "not_provided",
      userGuessNoteZh:
        index === 0
          ? `你的猜測「${text}」暫時對不上圖譜裡的情景，所以不會把它改寫成某個名字。`
          : undefined,
    }));
  }
  const top2 = list.slice(0, 2).map((item) => item.conditionId);
  const matchedHyp = list.find((item) => item.conditionId === matched.id);
  if (matchedHyp && top2.includes(matched.id) && matchedHyp.supports.length >= 2) {
    return list.map((item) => ({
      ...item,
      userGuess: item.conditionId === matched.id ? "supported" : "not_provided",
      userGuessNoteZh:
        item.conditionId === matched.id
          ? `你的猜測「${text}」與目前幾項線索方向一致，仍只是供討論的假設。`
          : undefined,
    }));
  }
  const primary = list[0];
  return list.map((item) => ({
    ...item,
    userGuess: item.conditionId === primary?.conditionId ? "unsupported" : "not_provided",
    userGuessNoteZh:
      item.conditionId === primary?.conditionId
        ? `你的猜測「${text}」與目前線索不一致。這裡保留你的原話，同時列出規則看到的方向。`
        : undefined,
  }));
}
