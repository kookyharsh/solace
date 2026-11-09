export function parseActivity(text: string, timezone: string, now = new Date()) {
  const explicit = /\bremind me\b/i.test(text);
  if (!explicit && !/\b(?:i have|i'm going to|i am going to|my|i've got)\b.*\b(?:meeting|exam|appointment|interview|match|class|event|date|trip|presentation|call)\b/i.test(text)) return null;
  const relative = /\b(today|tomorrow)\b/i.exec(text)?.[1]?.toLowerCase();
  const iso = /\b(20\d\d)-(\d\d)-(\d\d)\b/.exec(text);
  const hourMatch = /\b(?:at|for)\s+(\d{1,2})(?::(\d\d))?\s*(am|pm)\b/i.exec(text);
  const title = text.replace(/^.*?\bremind me (?:to |about )?/i, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  let scheduledAt: Date | null = null;
  if ((relative || iso) && hourMatch) {
    const local = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const [year = 0, month = 1, day = 1] = (iso ? iso[0] : local).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + (relative === 'tomorrow' ? 1 : 0)));
    let hour = Number(hourMatch[1]) % 12;
    if (hourMatch[3]?.toLowerCase() === 'pm') hour += 12;
    const minute = Number(hourMatch[2] || 0);
    const wall = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute);
    let instant = wall;
    for (let i = 0; i < 2; i++) {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
      const get = (key: string) => Number(parts.find(p => p.type === key)?.value);
      const displayed = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
      instant += wall - displayed;
    }
    scheduledAt = new Date(instant);
    if (scheduledAt <= now) scheduledAt = null;
  }
  return { title: title || text.slice(0, 120), scheduledAt, explicitReminder: explicit };
}
