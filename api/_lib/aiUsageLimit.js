const usageByUser = new Map();
const witaDateKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

export function consumeAiUsage(userId) {
  const usageKey = `${userId}:${witaDateKey()}`;
  const count = usageByUser.get(usageKey) || 0;
  const limit = Math.max(Number(process.env.AI_DAILY_LIMIT) || 5, 1);
  if (count >= limit) return false;
  usageByUser.set(usageKey, count + 1);
  return true;
}
