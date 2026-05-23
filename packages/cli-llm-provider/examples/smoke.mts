/**
 * Manual smoke test (requires logged-in CLI):
 *
 *   BACKEND=cursor npx tsx examples/smoke.mts
 *   BACKEND=gemini npx tsx examples/smoke.mts
 */
import {
  collectStreamText,
  createCliProvider,
  llmTurn,
} from "../src/index.js";

const backend = (process.env.BACKEND ?? "cursor") as "cursor" | "gemini";

const llm = createCliProvider({
  backend,
  cwd: process.cwd(),
  allowWrites: false,
});

console.log(`Backend: ${backend} (${llm.id})\n`);

const ctx = { llm, systemPrompt: "Reply in one short sentence." };

const complete = await llmTurn(ctx, [
  { role: "user", content: "Say hello." },
]);
console.log("[complete]", complete.text);

process.stdout.write("[stream] ");
const streamed = await collectStreamText(llm, [
  { role: "user", content: "Count from 1 to 3." },
]);
console.log(streamed);
