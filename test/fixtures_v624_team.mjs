// v624 - SYNTHETIC sheet data for the Team view tests. Invented names and tasks only: this repo is public, so nothing here comes from the real FN sheet.
const d = (daysAgo, now) => { const t = new Date(now - daysAgo * 86400e3); return t.getUTCDate() + "/" + (t.getUTCMonth() + 1) + "/" + t.getUTCFullYear(); };
export function csvFor(now) {
  const design = ["Task,Brief,Start Date,Designer,Status,Released", `Alpha flyer,x,${d(3, now)},Dana Test,In progress,`, `Beta banner,x,${d(2, now)},Dana Test,Not started,`, `Gamma poster,x,${d(4, now)},Eli Sample,Approved,`, `Delta card,x,${d(20, now)},Eli Sample,Approved,`, `Epsilon invite,x,${d(1, now)},,Not started,`, `Zeta sketch,x,${d(1, now)},Eli Sample,Cancelled,`].join("\n");
  const motion = ["Task,Brief,Status,Editor,Notes,Start,Release,Released on", `Video one,x,In progress,Fay Mock,,${d(2, now)},,`, `Video two,x,Completed,Fay Mock,,${d(5, now)},Released,${d(3, now)}`, `Video three,x,Not started,,,${d(1, now)},,`].join("\n");
  const daily = ["Date,Tasks", `${d(1, now)},"1. Cut the teaser\n2. Export captions"`].join("\n");
  return { design, motion, daily };
}
export const fetcher = (now, calls) => async (u) => { if (calls) calls.push(u); const c = csvFor(now); return u.includes("Graphic%20Design") ? c.design : u.includes("Motion%20Graphics") ? c.motion : c.daily; };
