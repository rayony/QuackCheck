import { useEffect, useMemo, useState, type ComponentType } from "react";
import { findBanned } from "@/domain/bannedWords";
import { formatHandoff } from "@/domain/handoffFormatter";
import { buildHypotheses } from "@/domain/hypothesisEngine";
import {
  ACTIVITY_CONSIDER,
  ACTIVITY_PAUSE,
  DIET_DISCUSS,
  DIET_LIMIT,
  FLAG_OPTIONS,
  TAGS,
  testsForRegions,
} from "@/domain/knowledge";
import { computeSafetyScreen, isHistoryIncomplete, requiredRules, screenUrgency } from "@/domain/redFlagEngine";
import { findingsFor } from "@/domain/muscleFindings";
import { visibleGear, visibleTherapies } from "@/domain/therapyFilter";
import {
  KNOWLEDGE_GRAPH_VERSION,
  REGION_LABEL,
  SIDE_LABEL,
  SPORT_LABEL,
  type AssessmentSessionRecord,
  type ContextHintTag,
  type ContraindicationFlag,
  type PainMark,
  type RegionId,
  type ResponseLanguageMode,
  type SafetyAnswer,
  type SelfTestResult,
  type SportType,
} from "@/domain/types";
import { mergeSessions, parseArchive, toExport } from "@/storage/archive";
import { clearSessions, deleteSession, listSessions, putSession } from "@/storage/db";
import { MarkEditor } from "./MarkEditor";
import { ResultBody } from "./TherapyStack";

const REGION_GROUPS: { title: string; items: { id: RegionId; view: string }[] }[] = [
  {
    title: "足、踝",
    items: [
      { id: "plantar", view: "底" },
      { id: "dorsum_foot", view: "背" },
      { id: "heel", view: "跟" },
      { id: "lat_ankle", view: "外" },
      { id: "med_ankle", view: "內" },
    ],
  },
  {
    title: "小腿、膝",
    items: [
      { id: "achilles", view: "後" },
      { id: "post_calf", view: "後" },
      { id: "med_tibia", view: "內" },
      { id: "ant_shin", view: "前" },
      { id: "ant_knee", view: "前" },
      { id: "lat_knee", view: "外" },
      { id: "med_knee", view: "內" },
      { id: "post_knee", view: "後" },
    ],
  },
  {
    title: "大腿、髖",
    items: [
      { id: "ant_thigh", view: "前" },
      { id: "post_thigh", view: "後" },
      { id: "med_thigh", view: "內" },
      { id: "groin", view: "前" },
      { id: "lat_hip", view: "外" },
      { id: "deep_glute", view: "深" },
    ],
  },
  {
    title: "背、頸、上肢",
    items: [
      { id: "low_back", view: "下" },
      { id: "upper_back", view: "上" },
      { id: "neck", view: "頸" },
      { id: "shoulder", view: "肩" },
      { id: "elbow", view: "肘" },
      { id: "wrist", view: "手" },
    ],
  },
];

const SPORT_CHOICES: SportType[] = ["road_running", "trail_running", "cycling", "triathlon"];

type BodyHit = {
  meshName: string;
  label: string;
  regionId: RegionId;
  side: PainMark["side"];
  point: [number, number, number];
};

type BodyCanvasProps = {
  marks: PainMark[];
  focusId: string | null;
  findings: ReturnType<typeof findingsFor>;
  cue?: {
    id: string;
    labelZh: string;
    pattern: string;
    approach: "medial" | "lateral" | "front" | "back";
    layer: "bone" | "muscle";
    side?: PainMark["side"];
  } | null;
  view: [number, number, number];
  viewTick: number;
  onFocus: (hit: BodyHit) => void;
  onSelect: (markId: string) => void;
};

type BodyModule = {
  Canvas: ComponentType<BodyCanvasProps>;
  Progress: ComponentType;
};

type Draft = {
  sessionId: string;
  episodeId: string;
  createdAtIso: string;
  sport: SportType;
  ultraDistance: boolean;
  loadSpikeSelfReport: boolean;
  side: PainMark["side"];
  marks: PainMark[];
  tags: ContextHintTag[];
  freeText: string;
  guess: string;
  flags: ContraindicationFlag[];
  reds: boolean;
  answers: SafetyAnswer[];
  tests: SelfTestResult[];
  selected: string[];
  lang: ResponseLanguageMode;
};

function freshDraft(episodeId?: string): Draft {
  const now = new Date().toISOString();
  return {
    sessionId: crypto.randomUUID(),
    episodeId: episodeId ?? crypto.randomUUID(),
    createdAtIso: now,
    sport: "unspecified",
    ultraDistance: false,
    loadSpikeSelfReport: false,
    side: "right",
    marks: [],
    tags: [],
    freeText: "",
    guess: "",
    flags: [],
    reds: false,
    answers: [],
    tests: [],
    selected: [],
    lang: "zh-TW-only",
  };
}

function assemble(draft: Draft): AssessmentSessionRecord {
  const rules = requiredRules(draft.marks, draft.tags);
  const answers = rules.map(
    (rule) => draft.answers.find((answer) => answer.ruleId === rule.id) ?? { ruleId: rule.id, answer: "skipped" as const },
  );
  const safetyScreen = computeSafetyScreen(
    rules.map((rule) => rule.id),
    answers,
    draft.marks,
  );
  const historyIncomplete = isHistoryIncomplete(draft.marks);
  const hypotheses = buildHypotheses({
    sport: draft.sport,
    ultraDistance: draft.ultraDistance,
    marks: draft.marks,
    tags: draft.tags,
    userHypothesis: draft.guess,
    historyIncomplete,
    safetyScreen,
  });
  return {
    schemaVersion: "1.0.3",
    knowledgeGraphVersion: KNOWLEDGE_GRAPH_VERSION,
    sessionId: draft.sessionId,
    episodeId: draft.episodeId,
    createdAtIso: draft.createdAtIso,
    updatedAtIso: new Date().toISOString(),
    sport: draft.sport,
    ultraDistance: draft.ultraDistance,
    loadSpikeSelfReport: draft.loadSpikeSelfReport,
    contraindications: draft.flags,
    redsSystemicClueSelfReport: draft.reds,
    marks: draft.marks,
    userHints: [
      {
        stage: "pre_test",
        tags: draft.tags,
        freeTextNote: draft.freeText,
        userHypothesis: draft.guess || undefined,
      },
    ],
    safetyScreen,
    safetyAnswers: answers,
    hypotheses,
    selfTests: draft.tests,
    selectedTherapyIds: safetyScreen === "hit" ? [] : draft.selected,
    responseLanguageMode: draft.lang,
  };
}

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function Wizard() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => freshDraft());
  const [history, setHistory] = useState<AssessmentSessionRecord[]>([]);
  const [note, setNote] = useState("");
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [handoff, setHandoff] = useState<"physiotherapist" | "orthopedist">("physiotherapist");
  const [learnGear, setLearnGear] = useState(false);
  const [activeMarkId, setActiveMarkId] = useState<string | null>(null);
  const [focus, setFocus] = useState<BodyHit | null>(null);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [bodyView, setBodyView] = useState<[number, number, number]>([0, 0.86, 3.35]);
  const [viewTick, setViewTick] = useState(0);
  const [bodyModule, setBodyModule] = useState<BodyModule | null>(null);

  useEffect(() => {
    let live = true;
    import("./BodyCanvas").then((mod) => {
      if (live) setBodyModule({ Canvas: mod.BodyCanvas, Progress: mod.ModelProgress });
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    listSessions().then(setHistory).catch(() => setNote("這部瀏覽器存不到紀錄。"));
  }, []);

  const record = useMemo(() => assemble(draft), [draft]);
  const findings = useMemo(() => findingsFor(draft.marks, record.hypotheses), [draft.marks, record.hypotheses]);
  const tests = useMemo(() => testsForRegions(draft.marks.map((mark) => mark.regionId)), [draft.marks]);
  const shownTest = tests.find((test) => test.id === activeTestId) ?? tests[0] ?? null;
  const testCue = useMemo(() => {
    if (!shownTest?.cue) return null;
    const marked = draft.marks.find((mark) => mark.regionId === shownTest.regionId);
    return { id: shownTest.id, ...shownTest.cue, side: marked?.side };
  }, [draft.marks, shownTest]);
  const rules = useMemo(() => requiredRules(draft.marks, draft.tags), [draft.marks, draft.tags]);
  const cards = useMemo(
    () =>
      visibleTherapies({
        safety: record.safetyScreen,
        hypotheses: record.hypotheses,
        flags: draft.flags,
        marks: draft.marks,
        reds: draft.reds,
      }),
    [record.safetyScreen, record.hypotheses, draft.flags, draft.marks, draft.reds],
  );
  const gear = visibleGear(record.hypotheses);
  const urgency = screenUrgency(draft.marks, record.safetyAnswers) ?? "same_day_clinician";

  async function persist(next = record) {
    const banned = findBanned(formatHandoff(next, "physiotherapist"));
    if (banned.length) {
      setNote("摘要含有禁用措辭，沒有儲存。");
      return;
    }
    await putSession(next);
    setHistory(await listSessions());
    setNote("已存到這部瀏覽器。");
  }

  function toggleRegion(regionId: RegionId) {
    const existing = draft.marks.find((mark) => mark.regionId === regionId && mark.side === draft.side);
    if (existing) {
      setActiveMarkId(existing.markId);
      return;
    }
    const mark: PainMark = { markId: crypto.randomUUID(), side: draft.side, regionId };
    setActiveMarkId(mark.markId);
    setDraft((current) => ({ ...current, marks: [...current.marks, mark] }));
  }

  function addBodyMark(hit: BodyHit) {
    const mark: PainMark = {
      markId: crypto.randomUUID(),
      side: hit.side,
      regionId: hit.regionId,
      surfacePoint: hit.point,
      meshName: hit.meshName,
      targetLabelZh: hit.label,
    };
    setActiveMarkId(mark.markId);
    setDraft((current) => ({ ...current, marks: [...current.marks, mark] }));
  }

  function removeMark(markId: string) {
    setDraft((current) => ({ ...current, marks: current.marks.filter((mark) => mark.markId !== markId) }));
    setActiveMarkId((current) => (current === markId ? null : current));
    setFocus((current) => (current?.meshName && draft.marks.some((mark) => mark.markId === markId && mark.meshName === current.meshName) ? null : current));
  }

  function selectMark(markId: string) {
    setActiveMarkId(markId);
    const mark = draft.marks.find((item) => item.markId === markId);
    if (!mark?.meshName || !mark.surfacePoint) return;
    setFocus({
      meshName: mark.meshName,
      label: mark.targetLabelZh ?? `${SIDE_LABEL[mark.side]}${REGION_LABEL[mark.regionId]}`,
      regionId: mark.regionId,
      side: mark.side,
      point: mark.surfacePoint,
    });
  }

  function patchMark(markId: string, patch: Partial<PainMark>) {
    setDraft((current) => ({
      ...current,
      marks: current.marks.map((mark) => (mark.markId === markId ? { ...mark, ...patch } : mark)),
    }));
  }

  const markdown = formatHandoff(record, handoff);
  const ModelProgressView = bodyModule?.Progress;
  const AnatomyView = bodyModule?.Canvas;

  return (
    <main className={`mx-auto min-h-screen px-4 py-6 ${step === 1 || step === 4 || step === 5 ? "max-w-6xl" : "max-w-lg"}`}>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">QuackCheck</p>
          <h1 className="font-serif text-3xl">半桶庸醫</h1>
          <p className="text-muted">痛點不是診斷</p>
        </div>
        <div className="grid h-16 w-16 shrink-0 place-items-center border-2 border-seal text-center text-xs text-seal">
          非
          <br />
          診斷
        </div>
      </header>

      <p className="mb-4 text-sm text-muted">{step === 0 ? "開始" : `步驟 ${step} / 5`}</p>

      {step === 0 && (
        <section className="grid gap-4">
          <p>你標的是覺得痛的位置。我列出的是可以帶去討論的假設。</p>
          <p>我不是註冊醫生，也不能判斷有沒有骨折或斷裂。</p>
          <p>胸痛、暈厥、大小便突然失控、小腿突然腫起來，或啪一聲後不能踮腳：打 999 或去急症室。</p>
          <p className="rounded-xl bg-paper-2 p-4 text-sm">
            紀錄只放在這部瀏覽器。共用電腦的下一個人可能看到。無痕模式可能存不住。匯出的檔案沒有加密。
          </p>
          {ModelProgressView ? <ModelProgressView /> : <p className="text-sm text-muted">準備載入解剖模型…</p>}
          <button type="button" className="min-h-11 rounded-xl bg-seal px-4 text-paper" onClick={() => setStep(1)}>
            開始新評估
          </button>
          <h2 className="font-serif text-xl">本機紀錄</h2>
          {history.length === 0 && <p className="text-muted">還沒有紀錄。</p>}
          <ul className="grid gap-3">
            {history.map((session) => (
              <li key={session.sessionId} className="rounded-xl border border-line p-4">
                <p>
                  {session.sport === "unspecified" ? "未填運動" : SPORT_LABEL[session.sport]} ·{" "}
                  {session.marks.map((item) => `${SIDE_LABEL[item.side]}${REGION_LABEL[item.regionId]}`).join("、") || "未標"}
                </p>
                <p className="text-sm text-muted">{new Date(session.createdAtIso).toLocaleString()}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="min-h-11 rounded-xl border border-line px-3"
                    onClick={() => {
                      setDraft({
                        ...freshDraft(session.episodeId),
                        sport: session.sport,
                        ultraDistance: session.ultraDistance,
                      });
                      setStep(1);
                    }}
                  >
                    同一傷患再記一筆
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-xl border border-line px-3"
                    onClick={async () => {
                      await deleteSession(session.sessionId);
                      setHistory(await listSessions());
                    }}
                  >
                    刪除
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-xl border border-line px-3"
              onClick={() => download("quackcheck.json", JSON.stringify(toExport(history), null, 2), "application/json")}
            >
              匯出 JSON
            </button>
            <label className="min-h-11 rounded-xl border border-line px-3 py-2">
              匯入 JSON
              <input
                className="sr-only"
                type="file"
                accept="application/json,.json"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    const parsed = parseArchive(JSON.parse(await file.text()));
                    if (!parsed.ok) {
                      setNote(parsed.rejectedReasonZh);
                      return;
                    }
                    const merged = mergeSessions(await listSessions(), parsed.sessions);
                    for (const session of merged.sessions) await putSession(session);
                    setHistory(merged.sessions);
                    setNote(`新增 ${merged.addedCount}，更新 ${merged.updatedCount}，略過 ${merged.skippedCount}。`);
                  } catch {
                    setNote("這份檔案的版本或格式不支援，沒有寫入本機紀錄。");
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="min-h-11 rounded-xl border border-seal px-3 text-seal"
              onClick={async () => {
                if (!confirmWipe) {
                  setConfirmWipe(true);
                  return;
                }
                await clearSessions();
                setHistory([]);
                setConfirmWipe(false);
                setNote("本機紀錄已清空。");
              }}
            >
              {confirmWipe ? "再按一次，清除全部" : "清除全部"}
            </button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]">
          <div className="grid gap-3">
            <p className="text-sm">拖動旋轉，滾輪縮放，右鍵拖動平移。點一下光選肌肉，雙擊搬去地下，再點搬開咗嘅就放返。標痛要撳右邊「標為痛點」。</p>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ["正面", [0, 0.86, 3.35]],
                  ["背面", [0, 0.86, -3.35]],
                  ["左側", [3.35, 0.86, 0]],
                  ["右側", [-3.35, 0.86, 0]],
                ] as const
              ).map(([label, position]) => (
                <button
                  key={label}
                  type="button"
                  className="min-h-11 rounded-xl border border-line px-2"
                  onClick={() => {
                    setBodyView([...position]);
                    setViewTick((value) => value + 1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="h-[460px] overflow-hidden rounded-2xl border border-line bg-[#efe6d8] lg:h-[72vh]">
              {AnatomyView ? (
                <AnatomyView
                  marks={draft.marks}
                  focusId={focus?.meshName ?? null}
                  findings={findings}
                  view={bodyView}
                  viewTick={viewTick}
                  onFocus={setFocus}
                  onSelect={selectMark}
                />
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted">人體模型載入緊</div>
              )}
            </div>
            <p className="text-xs text-muted">紅點係你標嘅痛。金色係可能相關嘅肌肉（牽涉痛或上游），不是判斷你傷咗邊條。</p>
            <p className="text-xs text-muted">
              人體模型來自{" "}
              <a className="underline" href="https://www.z-anatomy.com/" target="_blank" rel="noreferrer">
                Z-Anatomy
              </a>
              （CC BY-SA 4.0）。
            </p>
          </div>
          <div className="grid gap-4">
            <section className="grid gap-3 rounded-xl border border-line p-4">
              <h2 className="font-serif text-xl">而家光選</h2>
              {focus ? (
                <>
                  <p>
                    {focus.label} · {SIDE_LABEL[focus.side]}
                    {REGION_LABEL[focus.regionId]}
                  </p>
                  <button type="button" className="min-h-11 rounded-xl bg-seal px-3 text-paper" onClick={() => addBodyMark(focus)}>
                    標為痛點
                  </button>
                </>
              ) : (
                <p className="text-sm text-muted">未光選。點模型上嘅肌肉或骨骼。</p>
              )}
            </section>
            <section className="grid gap-2">
              <h2 className="font-serif text-xl">痛點</h2>
              {draft.marks.length === 0 && <p className="text-sm text-muted">未有痛點。</p>}
              {draft.marks.map((mark) => (
                <div key={mark.markId} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    className={`min-h-11 flex-1 rounded-xl border px-3 text-left ${activeMarkId === mark.markId ? "border-seal bg-seal-soft" : "border-line"}`}
                    onClick={() => selectMark(mark.markId)}
                  >
                    {mark.targetLabelZh ? `${mark.targetLabelZh} · ` : ""}
                    {SIDE_LABEL[mark.side]}
                    {REGION_LABEL[mark.regionId]}
                    {mark.vasNow !== undefined ? ` ${mark.vasNow}/10` : ""}
                  </button>
                  <button
                    type="button"
                    aria-label="移走呢一點"
                    className="grid min-h-11 w-11 place-items-center rounded-xl border border-seal text-xl leading-none text-seal"
                    onClick={() => removeMark(mark.markId)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </section>
            {findings.length > 0 && (
              <section className="grid gap-3">
                <h2 className="font-serif text-xl">可能相關</h2>
                {findings.map((item) => (
                  <article key={item.id} className="rounded-xl border border-line p-4">
                    <h3 className="font-serif text-lg">{item.labelZh}</h3>
                    <p className="text-sm">{item.reasonZh}</p>
                  </article>
                ))}
              </section>
            )}
            {activeMarkId && draft.marks.some((mark) => mark.markId === activeMarkId) ? (
              <MarkEditor
                mark={draft.marks.find((mark) => mark.markId === activeMarkId)!}
                onPatch={(patch) => patchMark(activeMarkId, patch)}
                onRemove={() => removeMark(activeMarkId)}
              />
            ) : (
              <p className="text-sm text-muted">揀一個痛點先改詳情：自發、持續、痛感程度。</p>
            )}
            <details className="rounded-xl border border-line p-4">
              <summary className="min-h-11 cursor-pointer">用清單加（唔使轉模型）</summary>
              <fieldset className="mt-3">
                <legend className="text-sm">清單用邊一邊</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["right", "left", "bilateral"] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      className={`min-h-11 rounded-xl border px-3 ${draft.side === side ? "border-seal bg-seal text-paper" : "border-line"}`}
                      onClick={() => setDraft({ ...draft, side })}
                    >
                      {SIDE_LABEL[side]}
                    </button>
                  ))}
                </div>
              </fieldset>
              {REGION_GROUPS.map((group) => (
                <fieldset key={group.title} className="mt-3">
                  <legend className="font-serif text-lg">{group.title}</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {group.items.map((region) => {
                      const on = draft.marks.some((mark) => mark.regionId === region.id && mark.side === draft.side);
                      return (
                        <button
                          key={region.id}
                          type="button"
                          className={`min-h-11 rounded-xl border px-3 text-left ${on ? "border-seal bg-seal-soft" : "border-line"}`}
                          onClick={() => toggleRegion(region.id)}
                        >
                          {REGION_LABEL[region.id]}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </details>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="grid gap-5">
          {draft.marks.map((mark) => (
            <MarkEditor
              key={mark.markId}
              mark={mark}
              onPatch={(patch) => patchMark(mark.markId, patch)}
              onRemove={() => removeMark(mark.markId)}
            />
          ))}
          <fieldset className="grid gap-2">
            <legend className="font-serif text-xl">做緊邊種？（可唔填）</legend>
            <div className="grid grid-cols-2 gap-2">
              {SPORT_CHOICES.map((sport) => (
                <button
                  key={sport}
                  type="button"
                  className={`min-h-11 rounded-xl border px-3 ${draft.sport === sport ? "border-seal bg-seal text-paper" : "border-line"}`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      sport: draft.sport === sport ? "unspecified" : sport,
                      ultraDistance: sport === "trail_running" || sport === "triathlon" ? draft.ultraDistance : false,
                    })
                  }
                >
                  {SPORT_LABEL[sport]}
                </button>
              ))}
            </div>
            {(draft.sport === "trail_running" || draft.sport === "triathlon") && (
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.ultraDistance}
                  onChange={(event) => setDraft({ ...draft, ultraDistance: event.target.checked })}
                />
                這次是超長距離
              </label>
            )}
          </fieldset>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={draft.loadSpikeSelfReport}
              onChange={(event) => setDraft({ ...draft, loadSpikeSelfReport: event.target.checked })}
            />
            最近練多咗
          </label>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => {
              const on = draft.tags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`min-h-11 rounded-full border px-3 ${on ? "border-seal bg-seal-soft" : "border-line"}`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      tags: on ? draft.tags.filter((item) => item !== tag.id) : [...draft.tags, tag.id],
                    })
                  }
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
          <label className="grid gap-1">
            你自己的描述（粵語也可以）
            <textarea
              className="min-h-24 rounded-xl border border-line bg-paper p-3"
              value={draft.freeText}
              onChange={(event) => setDraft({ ...draft, freeText: event.target.value })}
            />
          </label>
          <label className="grid gap-1">
            你的猜測（會原句保留）
            <input
              className="min-h-11 rounded-xl border border-line bg-paper px-3"
              value={draft.guess}
              onChange={(event) => setDraft({ ...draft, guess: event.target.value })}
            />
          </label>
          <fieldset className="grid gap-2">
            <legend>個人情況（用來收起某些手法，不是急症題）</legend>
            {FLAG_OPTIONS.map((flag) => (
              <label key={flag.id} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.flags.includes(flag.id)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      flags: event.target.checked
                        ? [...draft.flags, flag.id]
                        : draft.flags.filter((item) => item !== flag.id),
                    })
                  }
                />
                {flag.label}
              </label>
            ))}
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={draft.reds}
                onChange={(event) => setDraft({ ...draft, reds: event.target.checked })}
              />
              反覆骨痛、月經稀少或停經、體重急跌或進食明顯不足
            </label>
          </fieldset>
          {isHistoryIncomplete(draft.marks) && (
            <p className="text-sm text-seal">還有痛史未填。可以繼續，但吻合度最高只會是低。</p>
          )}
        </section>
      )}

      {step === 3 && (
        <section className="grid gap-4">
          {record.safetyScreen === "hit" && <ResultBody safety="hit" cards={[]} level={urgency} />}
          {rules.map((rule) => {
            const current = draft.answers.find((answer) => answer.ruleId === rule.id)?.answer;
            return (
              <fieldset key={rule.id} className="grid gap-2 rounded-xl border border-line p-4">
                <legend className="px-1">{rule.questionZh}</legend>
                <p className="text-sm text-muted">{rule.cannotRuleOutZh}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["yes", "是"],
                      ["no", "否"],
                      ["unsure", "不確定"],
                      ["skipped", "跳過"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`min-h-11 rounded-xl border px-2 ${current === value ? "border-seal bg-seal text-paper" : "border-line"}`}
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          answers: [
                            ...prev.answers.filter((answer) => answer.ruleId !== rule.id),
                            { ruleId: rule.id, answer: value, urgency: rule.urgency },
                          ],
                        }))
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </section>
      )}

      {step === 4 && (
        <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,440px)]">
          {record.safetyScreen === "hit" ? (
            <p>安全題未過，這一步不做自我檢查。下一步只準備就醫摘要。</p>
          ) : tests.length === 0 ? (
            <p>這個分區沒有自我檢查，直接看摘要。</p>
          ) : (
            <>
              <div className="grid gap-2 lg:sticky lg:top-4">
                <div className="h-[340px] overflow-hidden rounded-2xl border border-line bg-[#efe6d8] lg:h-[72vh]">
                  {AnatomyView ? (
                    <AnatomyView
                      marks={draft.marks}
                      focusId={null}
                      findings={[]}
                      cue={testCue}
                      view={bodyView}
                      viewTick={viewTick}
                      onFocus={() => undefined}
                      onSelect={() => undefined}
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-sm text-muted">人體模型載入緊</div>
                  )}
                </div>
                <p className="text-sm">
                  {testCue ? `箭嘴同金色：${testCue.labelZh}。` : "呢一下沒有對應位置。"}
                  只係標出要睇或輕按嘅地方，不是判斷。
                </p>
              </div>
              <div className="grid gap-4">
                {tests.map((test) => {
                  const current = draft.tests.find((item) => item.testId === test.id);
                  const active = shownTest?.id === test.id;
                  return (
                    <fieldset
                      key={test.id}
                      className={`grid gap-2 rounded-xl border p-4 ${active ? "border-seal" : "border-line"}`}
                      onClick={() => setActiveTestId(test.id)}
                    >
                      <legend className="px-1 font-serif text-lg">
                        {test.nameZh}
                        <span className="ml-2 text-sm text-muted">{test.nameEn}</span>
                      </legend>
                      <ol className="list-decimal pl-5">
                        {test.stepsZh.map((stepText) => (
                          <li key={stepText}>{stepText}</li>
                        ))}
                      </ol>
                      <p className="text-sm">停：{test.stopConditionZh}</p>
                      <p className="text-sm">{test.positiveMeaningZh}</p>
                      <p className="text-sm text-seal">{test.cannotRuleOutZh}</p>
                      <div className="grid gap-2">
                        {(
                          [
                            ["positive", "重現痛"],
                            ["negative", "這一下沒有重現你的痛"],
                            ["unsure", "不確定"],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={`min-h-11 rounded-xl border px-3 text-left ${current?.outcome === value ? "border-seal bg-seal-soft" : "border-line"}`}
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                tests: [
                                  ...prev.tests.filter((item) => item.testId !== test.id),
                                  { testId: test.id, outcome: value, userNote: current?.userNote },
                                ],
                              }))
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <input
                        className="min-h-11 rounded-xl border border-line bg-paper px-3"
                        placeholder="即時筆記，例如只有落樓梯痛"
                        value={current?.userNote ?? ""}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            tests: prev.tests.map((item) =>
                              item.testId === test.id ? { ...item, userNote: event.target.value } : item,
                            ),
                          }))
                        }
                      />
                    </fieldset>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {step === 5 && (
        <section className="grid gap-5">
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]">
            <div className="h-[460px] overflow-hidden rounded-2xl border border-line bg-[#efe6d8] lg:h-[72vh]">
              {AnatomyView ? (
                <AnatomyView
                  marks={draft.marks}
                  focusId={focus?.meshName ?? null}
                  findings={findings}
                  view={bodyView}
                  viewTick={viewTick}
                  onFocus={setFocus}
                  onSelect={selectMark}
                />
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted">人體模型載入緊</div>
              )}
            </div>
            <div className="grid gap-3">
              <h2 className="font-serif text-xl">模型上嘅金色</h2>
              <p className="text-sm">金色係按你標嘅位置，用牽涉痛同上游肌肉嘅講法標出嚟。可以雙擊肌肉搬開，睇下面。紅色點先係你自己標嘅痛。</p>
              {findings.length === 0 && <p className="text-sm text-muted">未有足夠位置去標相關肌肉。</p>}
              {findings.map((item) => (
                <article key={item.id} className="rounded-xl border border-line p-4">
                  <h3 className="font-serif text-lg">{item.labelZh}</h3>
                  <p className="text-sm">{item.reasonZh}</p>
                </article>
              ))}
            </div>
          </div>
          <p className="text-sm">
            以下是最吻合的解剖學假設，供討論。自我檢查是帶去討論的線索。這幾條篩檢的結果，並不因此知道有沒有骨折。
          </p>
          <p className="rounded-xl bg-paper-2 p-3 text-sm">
            {record.safetyScreen === "hit"
              ? "需要當面評估。"
              : record.safetyScreen === "incomplete"
                ? "安全題未完成，只顯示減量原則。"
                : "已答題目沒有勾選「是」。"}
          </p>
          <ResultBody safety={record.safetyScreen} cards={cards} level={urgency} />
          {record.safetyScreen !== "hit" && (
            <>
              <section className="grid gap-3">
                <h2 className="font-serif text-xl">假設</h2>
                {record.hypotheses.map((item) => (
                  <article key={item.conditionId + item.role} className="rounded-xl border border-line p-4">
                    <h3 className="font-serif text-lg">{item.titleZh}</h3>
                    <p className="text-sm text-muted">
                      {item.titleEn} ·{" "}
                      {item.role === "must_rule_out_first" ? "要先當面看" : item.role === "upstream_contributor" ? "上游" : "痛點本地"} ·
                      吻合度{item.fit === "moderate" ? "中" : "低"}
                    </p>
                    <ul className="mt-2 list-disc pl-5">
                      {item.supports.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    {item.against.length > 0 && <p className="mt-2 text-sm">保留：{item.against.join("、")}</p>}
                    {item.userGuessNoteZh && <p className="mt-2">{item.userGuessNoteZh}</p>}
                  </article>
                ))}
                {isHistoryIncomplete(draft.marks) && <p className="text-sm text-seal">痛史未完整，吻合度鎖在低。</p>}
              </section>
              <section className="grid gap-2">
                <h2 className="font-serif text-xl">飲食與訓練（一般意見，不是處方）</h2>
                <p>可討論：{DIET_DISCUSS.join("、")}。</p>
                <p>建議節制：{DIET_LIMIT.join("、")}。止痛藥請與醫生或藥劑師討論。</p>
                <p>可考慮：{ACTIVITY_CONSIDER.join("、")}。</p>
                <p>先暫停：{ACTIVITY_PAUSE.join("、")}。</p>
              </section>
              {gear.length > 0 && (
                <section>
                  <button type="button" className="min-h-11 font-serif text-xl" onClick={() => setLearnGear((value) => !value)}>
                    護具 {learnGear ? "收起" : "打開"}
                  </button>
                  {learnGear &&
                    gear.map((item) => (
                      <article key={item.itemZh} className="mt-3 rounded-xl border border-line p-4">
                        <h3>{item.itemZh}</h3>
                        <p className="text-sm text-muted">{item.itemEn}</p>
                        <p className="mt-2">何時用：{item.whenToUseZh}</p>
                        <p>何時減：{item.whenToWeanOffZh}</p>
                        {item.referenceCatalogUrl && (
                          <a className="text-seal underline" href={item.referenceCatalogUrl} target="_blank" rel="noreferrer">
                            結構圖鑑（品牌中立參考，不是推薦購買）
                          </a>
                        )}
                      </article>
                    ))}
                </section>
              )}
              <fieldset className="grid gap-2">
                <legend>納入摘要的處理</legend>
                {cards.map((card) => (
                  <label key={card.id} className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.selected.includes(card.id)}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          selected: event.target.checked
                            ? [...draft.selected, card.id]
                            : draft.selected.filter((id) => id !== card.id),
                        })
                      }
                    />
                    {card.titleZh}
                  </label>
                ))}
              </fieldset>
            </>
          )}
          <section className="grid gap-3">
            <h2 className="font-serif text-xl">交接摘要</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`min-h-11 rounded-xl border px-2 ${handoff === "physiotherapist" ? "border-seal bg-seal text-paper" : "border-line"}`}
                onClick={() => setHandoff("physiotherapist")}
              >
                物理治療師
              </button>
              <button
                type="button"
                className={`min-h-11 rounded-xl border px-2 ${handoff === "orthopedist" ? "border-seal bg-seal text-paper" : "border-line"}`}
                onClick={() => setHandoff("orthopedist")}
              >
                骨科醫生
              </button>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-paper-2 p-4 text-sm">{markdown}</pre>
            <button
              type="button"
              className="min-h-11 rounded-xl bg-seal px-4 text-paper"
              onClick={() => {
                setNote("匯出檔沒有加密，請自行保管。");
                download(`quackcheck-${handoff}.md`, markdown, "text/markdown");
              }}
            >
              下載 Markdown
            </button>
            <button type="button" className="min-h-11 rounded-xl border border-line px-4" onClick={() => persist()}>
              儲存這次紀錄
            </button>
          </section>
        </section>
      )}

      {note && <p className="mt-4 text-sm">{note}</p>}

      {step > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button type="button" className="min-h-11 rounded-xl border border-line" onClick={() => setStep((value) => value - 1)}>
            返回
          </button>
          {step < 5 ? (
            <button
              type="button"
              className="min-h-11 rounded-xl bg-ink px-4 text-paper disabled:opacity-40"
              disabled={step === 1 && draft.marks.length === 0}
              onClick={() => setStep((value) => value + 1)}
            >
              下一步
            </button>
          ) : (
            <button
              type="button"
              className="min-h-11 rounded-xl border border-line"
              onClick={() => {
                setDraft(freshDraft());
                setStep(0);
              }}
            >
              完成
            </button>
          )}
        </div>
      )}
    </main>
  );
}

