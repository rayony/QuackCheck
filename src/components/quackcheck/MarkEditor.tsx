import {
  DURATION_CHOICES,
  REGION_LABEL,
  SIDE_LABEL,
  TRIGGER_PRESETS,
  type DurationBucket,
  type PainMark,
  type RegionId,
  type ZoneDetail,
} from "@/domain/types";

const ZONES: Partial<Record<RegionId, { value: ZoneDetail; label: string }[]>> = {
  ant_knee: [
    { value: "retro_patellar", label: "髕骨周圍" },
    { value: "patellar_tendon", label: "髕腱本體" },
  ],
  med_tibia: [
    { value: "shin_diffuse", label: "內側一大段" },
    { value: "shin_focal", label: "一指骨面" },
  ],
  achilles: [
    { value: "achilles_mid", label: "腱中段" },
    { value: "achilles_insertion", label: "跟骨附著點" },
  ],
};

const PAIN_STEPS: [number, string][] = [
  [0, "唔痛"],
  [2, "輕微"],
  [4, "中等"],
  [6, "頗痛"],
  [8, "好痛"],
  [10, "要停"],
];

export function MarkEditor({
  mark,
  onPatch,
  onRemove,
}: {
  mark: PainMark;
  onPatch: (patch: Partial<PainMark>) => void;
  onRemove?: () => void;
}) {
  return (
    <fieldset className="grid gap-3 rounded-xl border border-line p-4">
      <legend className="px-1 font-serif text-lg">
        {mark.targetLabelZh ? `${mark.targetLabelZh} · ` : ""}
        {SIDE_LABEL[mark.side]}
        {REGION_LABEL[mark.regionId]}
      </legend>
      <label className="grid gap-1 text-sm">
        邊一邊
        <select
          className="min-h-11 rounded-xl border border-line bg-paper px-2"
          value={mark.side}
          onChange={(event) => onPatch({ side: event.target.value as PainMark["side"] })}
        >
          <option value="right">右</option>
          <option value="left">左</option>
          <option value="bilateral">兩側</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        分區（點錯可以改）
        <select
          className="min-h-11 rounded-xl border border-line bg-paper px-2"
          value={mark.regionId}
          onChange={(event) => onPatch({ regionId: event.target.value as RegionId })}
        >
          {(Object.keys(REGION_LABEL) as RegionId[]).map((regionId) => (
            <option key={regionId} value={regionId}>
              {REGION_LABEL[regionId]}
            </option>
          ))}
        </select>
      </label>
      {ZONES[mark.regionId] && (
        <div className="grid grid-cols-2 gap-2">
          {ZONES[mark.regionId]?.map((zone) => (
            <button
              key={zone.value}
              type="button"
              className={`min-h-11 rounded-xl border px-2 ${mark.zoneDetail === zone.value ? "border-seal bg-seal-soft" : "border-line"}`}
              onClick={() => onPatch({ zoneDetail: zone.value })}
            >
              {zone.label}
            </button>
          ))}
        </div>
      )}
      <label className="grid gap-1 text-sm">
        點樣開始
        <select
          className="min-h-11 rounded-xl border border-line bg-paper px-2"
          value={mark.onset ?? ""}
          onChange={(event) => onPatch({ onset: event.target.value as PainMark["onset"] })}
        >
          <option value="">請選</option>
          <option value="sudden_pop">突然啪一聲</option>
          <option value="trauma">扭傷或撞到</option>
          <option value="gradual_days">慢慢開始</option>
          <option value="gradual_weeks">拖咗好耐</option>
        </select>
      </label>
      <Choice
        label="痛了幾耐"
        value={mark.durationBucket}
        options={DURATION_CHOICES.map((item) => [item.id, item.label] as [DurationBucket, string])}
        onPick={(durationBucket) => {
          const days = DURATION_CHOICES.find((item) => item.id === durationBucket)?.days ?? 1;
          onPatch({ durationBucket, durationDays: days });
        }}
      />
      <PainScale label="而家痛感程度" value={mark.vasNow} onPick={(vasNow) => onPatch({ vasNow })} />
      <PainScale label="最痛嗰陣" value={mark.vasWorst} onPick={(vasWorst) => onPatch({ vasWorst })} />
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["sharp", "針住一點"],
            ["diffuse", "悶、成片"],
            ["burning", "灼熱或麻"],
            ["stiff", "緊"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`min-h-11 rounded-xl border px-2 ${mark.painQuality === value ? "border-seal bg-seal-soft" : "border-line"}`}
            onClick={() => onPatch({ painQuality: value })}
          >
            {label}
          </button>
        ))}
      </div>
      <Choice
        label="點樣痛"
        value={mark.course === "steady" ? "continuous" : mark.course}
        options={[
          ["spontaneous", "自發痛"],
          ["continuous", "持續痛"],
          ["intermittent", "偶發性痛"],
          ["tender", "按壓先痛"],
        ]}
        onPick={(course) => onPatch({ course })}
      />
      {mark.course === "intermittent" && (
        <div className="grid gap-2">
          <p className="text-sm">幾時先痛？可揀，亦可自己填</p>
          <div className="flex flex-wrap gap-2">
            {TRIGGER_PRESETS.map((preset) => {
              const on = mark.triggers?.includes(preset) ?? false;
              return (
                <button
                  key={preset}
                  type="button"
                  className={`min-h-11 rounded-full border px-3 ${on ? "border-seal bg-seal-soft" : "border-line"}`}
                  onClick={() => {
                    const current = mark.triggers ?? [];
                    onPatch({ triggers: on ? current.filter((item) => item !== preset) : [...current, preset] });
                  }}
                >
                  {preset}
                </button>
              );
            })}
          </div>
          <input
            className="min-h-11 rounded-xl border border-line bg-paper px-3"
            placeholder="其他，例如游到第三個鐘、落斜先痛"
            value={mark.triggerNote ?? ""}
            onChange={(event) => onPatch({ triggerNote: event.target.value })}
          />
        </div>
      )}
      <Choice
        label="熱身後"
        value={mark.warmUp}
        options={[
          ["eases", "減輕"],
          ["unchanged", "不變"],
          ["worsens", "更痛"],
        ]}
        onPick={(warmUp) => onPatch({ warmUp })}
      />
      <Choice
        label="第二天"
        value={mark.nextDay}
        options={[
          ["better", "較好"],
          ["same", "差不多"],
          ["worse", "更差"],
        ]}
        onPick={(nextDay) => onPatch({ nextDay })}
      />
      <Choice
        label="夜間痛"
        value={mark.nightPain === undefined ? undefined : mark.nightPain ? "yes" : "no"}
        options={[
          ["no", "沒有"],
          ["yes", "有"],
        ]}
        onPick={(value) => onPatch({ nightPain: value === "yes" })}
      />
      <Choice
        label="腫，定係摸到硬"
        value={mark.swelling}
        options={[
          ["none", "無"],
          ["local", "睇得到腫"],
          ["calf_diffuse", "小腿整段腫"],
          ["muscle_knot", "硬塊／硬結"],
        ]}
        onPick={(swelling) => onPatch({ swelling })}
      />
      <Choice
        label="行路"
        value={mark.weightBearing}
        options={[
          ["run_ok", "仍可跑"],
          ["walk_only", "只能行"],
          ["walk_pain", "行路都痛"],
          ["cannot_four_steps", "行不到四步"],
        ]}
        onPick={(weightBearing) => onPatch({ weightBearing })}
      />
      {onRemove && (
        <button type="button" className="min-h-11 rounded-xl border border-seal px-3 text-seal" onClick={onRemove}>
          移走呢一點
        </button>
      )}
    </fieldset>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T | undefined;
  options: [T, string][];
  onPick: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm">{label}</legend>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            className={`min-h-11 rounded-xl border px-2 ${value === option ? "border-seal bg-seal-soft" : "border-line"}`}
            onClick={() => onPick(option)}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function PainScale({ label, value, onPick }: { label: string; value: number | undefined; onPick: (value: number) => void }) {
  return (
    <fieldset>
      <legend className="text-sm">
        {label}
        {value === undefined ? "" : ` ${value}/10`}
      </legend>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {PAIN_STEPS.map(([score, text]) => (
          <button
            key={score}
            type="button"
            className={`min-h-11 rounded-xl border px-2 ${value === score ? "border-seal bg-seal-soft" : "border-line"}`}
            onClick={() => onPick(score)}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
