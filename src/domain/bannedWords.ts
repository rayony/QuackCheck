export const BANNED_ZH = [
  "確診",
  "已排除",
  "已清除",
  "病情等級",
  "保證不是骨折",
  "可以放心按摩",
  "診斷為",
] as const;

export const BANNED_EN = [
  "diagnosed",
  "ruled out",
  "red flags cleared",
  "severity grade",
  "guaranteed not fractured",
] as const;

export function findBanned(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const word of BANNED_ZH) {
    if (text.includes(word)) hits.push(word);
  }
  for (const word of BANNED_EN) {
    if (lower.includes(word)) hits.push(word);
  }
  return hits;
}
