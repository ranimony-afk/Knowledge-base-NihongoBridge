import { Command } from "commander";

interface Options {
  url: string;
  requests: string;
  queries: string;
}

const options = new Command()
  .option("--url <url>", "autocomplete endpoint", "http://localhost:7701/autocomplete")
  .option("--requests <count>", "measured request count", "100")
  .option("--queries <values>", "comma-separated queries", "水,みず,食,たべ,日本")
  .parse()
  .opts<Options>();

const requestCount = Math.max(1, Number(options.requests));
const queries = options.queries.split(",").map((value) => value.trim()).filter(Boolean);
if (!queries.length) throw new Error("At least one query is required");

for (const query of queries) await run(query); // warm cache and connections

const timings: number[] = [];
for (let index = 0; index < requestCount; index += 1) {
  timings.push(await run(queries[index % queries.length]!));
}
timings.sort((left, right) => left - right);
const p50 = percentile(timings, 0.5);
const p95 = percentile(timings, 0.95);
const p99 = percentile(timings, 0.99);
console.log(
  JSON.stringify(
    {
      requests: requestCount,
      min_ms: timings[0],
      p50_ms: p50,
      p95_ms: p95,
      p99_ms: p99,
      max_ms: timings.at(-1),
      target_p95_ms: 50,
      passed: p95 < 50,
    },
    null,
    2,
  ),
);
if (p95 >= 50) process.exitCode = 1;

async function run(query: string): Promise<number> {
  const started = performance.now();
  const url = new URL(options.url);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "10");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Autocomplete returned HTTP ${response.status}`);
  await response.arrayBuffer();
  return Math.round((performance.now() - started) * 100) / 100;
}

function percentile(values: number[], fraction: number): number {
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * fraction) - 1));
  return values[index]!;
}
