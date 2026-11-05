// v771 - one-off: the PJA owners flow sends the district passport versions with Najjuko's thank-you, and the broker card after engagement.
// Reads the stored flow (FLOW_IN), validates with the worker's own cleanFlow, writes FLOW_OUT for `wrangler kv key put`.
import fs from "fs";
import { cleanFlow } from "../src/campaigns.js";
const f = JSON.parse(fs.readFileSync(process.env.FLOW_IN, "utf8"));
const TY = "Thank you very much, I appreciate you taking the time. I'll reach out to you shortly to talk it through. Najjuko\n\n";
const s1 = f.nodes.s1;
s1.buttons.forEach((b) => { if (b.id === "selling") b.next = "bt"; });
f.nodes.a1 = { type: "brief", brief: "palm-jebel-ali", reader: "keeper", image: "palm-jebel-ali", text: TY + "Here is your Palm Jebel Ali passport for owners keeping their home: handover dates, build progress and rents.", next: "a2" };
f.nodes.bt = { type: "brief", brief: "palm-jebel-ali", reader: "seller", image: "palm-jebel-ali", text: TY + "Here is what Palm Jebel Ali homes are selling for, by bedroom:", next: "b1" };
f.nodes.c1 = { type: "brief", brief: "palm-springs", reader: "investor", image: "palm-springs", text: TY + "Here is the Palm Springs one-pager, the next launch near Palm Jebel Ali:", next: "c2" };
f.send_card = true;
const { f: out, err } = cleanFlow(f);
if (err.length) { console.log("ERR", err); process.exit(1); }
fs.writeFileSync(process.env.FLOW_OUT, JSON.stringify(out));
console.log("ok nodes", Object.keys(out.nodes).join(","), "send_card", out.send_card, "a1", out.nodes.a1.type, out.nodes.a1.reader, out.nodes.a1.image);
