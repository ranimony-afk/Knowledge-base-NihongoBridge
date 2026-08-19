import { describe, expect, it } from "vitest";

import {
  buildMultiSearchQueries,
  parseSearchParams,
} from "../search/lib/query.js";

describe("multi-index query builder", () => {
  it("parses facets and emits safe index-specific filters", () => {
    const request = parseSearchParams(
      new URLSearchParams({
        q: "ﾐｽﾞ",
        types: "dictionary,kanji",
        level: "N5",
        pos: 'noun" OR true',
        tags: "core,food",
        grade: "1",
        stroke_min: "3",
        stroke_max: "6",
      }),
    );
    const queries = buildMultiSearchQueries(request);
    expect(queries).toHaveLength(2);
    expect(queries[0]?.q).toBe("みず");
    expect(queries[0]?.filter).toContain('part_of_speech = "noun\\\" OR true"');
    expect(queries[0]?.filter).toContain('tags = "core"');
    expect(queries[1]?.filter).toContain("grade = 1");
    expect(queries[1]?.filter).toContain("stroke_count >= 3");
    expect(queries[0]?.highlightPreTag).toBe("<mark>");
  });

  it("rejects invalid stroke ranges and index names", () => {
    expect(() =>
      parseSearchParams(new URLSearchParams({ q: "水", stroke_min: "10", stroke_max: "2" })),
    ).toThrow();
    expect(() =>
      parseSearchParams(new URLSearchParams({ q: "水", types: "dictionary,users" })),
    ).toThrow();
  });
});
