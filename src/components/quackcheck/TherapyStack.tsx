import { groupTherapies } from "@/domain/therapyFilter";
import type { SafetyScreen, TherapyCard } from "@/domain/types";

const EVIDENCE: Record<TherapyCard["evidence"], string> = {
  high: "高",
  moderate: "中",
  emerging: "新興",
  traditional: "傳統",
  low: "低",
};

function Card({ card }: { card: TherapyCard }) {
  return (
    <article className="therapy-card rounded-xl border border-line bg-paper p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-lg">{card.titleZh}</h3>
        <span className="text-sm text-muted">{EVIDENCE[card.evidence]}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{card.titleEn}</p>
      <p className="mt-3">{card.dosageZh}</p>
      {card.contraindicationsZh.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-sm text-muted">
          {card.contraindicationsZh.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {card.externalGuideUrl && (
        <a className="mt-3 inline-block text-seal underline" href={card.externalGuideUrl} target="_blank" rel="noreferrer">
          外部圖文參考
        </a>
      )}
      {card.youtubePlaylistUrl && (
        <a className="mt-2 block text-seal underline" href={card.youtubePlaylistUrl} target="_blank" rel="noreferrer">
          白名單教學清單（階段 1 不內嵌影片）
        </a>
      )}
    </article>
  );
}

export function TherapyStack({ cards }: { cards: TherapyCard[] }) {
  const groups = groupTherapies(cards);
  return (
    <div className="grid gap-4">
      <section className="grid gap-3">
        <h2 className="font-serif text-xl">先做</h2>
        {groups.do_first.map((card) => (
          <Card key={card.id} card={card} />
        ))}
      </section>
      {groups.alongside.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-serif text-xl">可一併試</h2>
          {groups.alongside.map((card) => (
            <Card key={card.id} card={card} />
          ))}
        </section>
      )}
      {groups.learn_more.length > 0 && (
        <details className="rounded-xl border border-line bg-paper-2 p-4">
          <summary className="min-h-11 cursor-pointer font-serif text-lg">進階了解（預設收起）</summary>
          <div className="mt-3 grid gap-3">
            {groups.learn_more.map((card) => (
              <Card key={card.id} card={card} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function EmergencyNotice({
  level,
}: {
  level: "emergency_now" | "same_day_clinician";
}) {
  const emergency = level === "emergency_now";
  return (
    <section className="rounded-xl border border-seal bg-seal-soft p-4 text-ink">
      <h2 className="font-serif text-2xl">{emergency ? "請先就醫" : "建議盡快當面評估"}</h2>
      <p className="mt-3">
        {emergency
          ? "請打 999 或前往急症室。這次不會提供按摩、按摩槍、拉筋、貼布或練習。"
          : "建議盡快聯絡醫生或註冊物理治療師，需要時轉介骨科。症狀急速變差就改打 999。這次不會提供自我按摩或練習。"}
      </p>
      <p className="mt-3 text-sm">
        走不到四步，或突然啪一聲，會直接進入這頁。這表示需要當面看，不是已經知道有骨折或斷裂。
      </p>
    </section>
  );
}

export function ResultBody({
  safety,
  cards,
  level,
}: {
  safety: SafetyScreen;
  cards: TherapyCard[];
  level: "emergency_now" | "same_day_clinician";
}) {
  if (safety === "hit") return <EmergencyNotice level={level} />;
  return <TherapyStack cards={cards} />;
}
