import { apiRequest } from "@/lib/api-client";
import {
  demoAutocomplete,
  demoDictionaryDetail,
  demoDictionaryEntries,
  demoKanjiDetail,
} from "@/lib/demo-content";
import type { ApiEnvelope } from "@/types/test";
import type {
  DictionaryAutocompleteItem,
  DictionaryDetailData,
  DictionaryEntryData,
  DictionarySearchFilters,
  KanjiDetailData,
} from "@/types/content";

export async function searchDictionaryContent(
  filters: DictionarySearchFilters,
  limit = 20,
  demo = false,
): Promise<{ items: DictionaryEntryData[]; total: number }> {
  if (demo) {
    await delay();
    const query = filters.q.trim().toLocaleLowerCase();
    const items = demoDictionaryEntries.filter((entry) => {
      const matches =
        !query ||
        [entry.word, entry.kana, entry.romaji, ...entry.meanings.map((item) => item.value)]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase().includes(query));
      return (
        matches &&
        (!filters.level || entry.jlpt_level === filters.level) &&
        (!filters.pos ||
          entry.part_of_speech.some((value) => value.toLocaleLowerCase() === filters.pos)) &&
        (!filters.hasAudio || Boolean(entry.audio_url))
      );
    });
    return { items: items.slice(0, limit), total: items.length };
  }
  if (!filters.q.trim()) return { items: [], total: 0 };
  const query = new URLSearchParams({
    q: filters.q,
    page: String(filters.page),
    limit: String(limit),
  });
  if (filters.level) query.set("level", filters.level);
  if (filters.pos) query.set("pos", filters.pos);
  if (filters.hasAudio) query.set("has_audio", "true");
  const envelope = await apiRequest<ApiEnvelope<DictionaryEntryData[]>>(
    `/api/dictionary/search?${query.toString()}`,
    { method: "GET" },
  );
  return { items: envelope.data, total: envelope.meta.total };
}

export async function autocompleteDictionaryContent(
  queryValue: string,
  demo = false,
  signal?: AbortSignal,
): Promise<DictionaryAutocompleteItem[]> {
  if (demo) {
    await delay(90);
    return demoAutocomplete
      .filter((item) => item.word.startsWith(queryValue) || item.kana?.startsWith(queryValue))
      .slice(0, 8);
  }
  const envelope = await apiRequest<ApiEnvelope<DictionaryAutocompleteItem[]>>(
    `/api/dictionary/autocomplete?q=${encodeURIComponent(queryValue)}&limit=8`,
    { method: "GET", ...(signal ? { signal } : {}) },
  );
  return envelope.data;
}

export async function loadDictionaryDetail(
  id: string,
  demo = false,
): Promise<DictionaryDetailData> {
  if (demo) {
    await delay();
    if (id === demoDictionaryDetail.id) return demoDictionaryDetail;
    const entry = demoDictionaryEntries.find((item) => item.id === id) ?? demoDictionaryDetail;
    return { ...demoDictionaryDetail, ...entry };
  }
  const envelope = await apiRequest<ApiEnvelope<DictionaryDetailData>>(
    `/api/dictionary/${encodeURIComponent(id)}`,
    { method: "GET" },
  );
  return envelope.data;
}

export async function loadKanjiDetail(
  character: string,
  demo = false,
): Promise<KanjiDetailData> {
  if (demo) {
    await delay();
    if (character === "水") return demoKanjiDetail;
    if (character === "食") {
      return {
        ...demoKanjiDetail,
        id: "00000000-0000-4000-8000-000000001004",
        character: "食",
        unicode: "U+98DF",
        onyomi: ["ショク"],
        kunyomi: ["た.べる", "く.う"],
        meanings: [{ lang: "en", value: "eat; food" }],
        grade: 2,
        stroke_count: 9,
        radicals: ["食"],
        components: ["人", "良"],
        similar_kanji: ["良", "飠"],
        lookalikes: [],
        example_words: demoDictionaryEntries.filter((entry) => entry.word.includes("食")),
        mnemonics: [{ source: "custom", text: "A person gathers good food under a lid." }],
      };
    }
    return {
      ...demoKanjiDetail,
      id: `demo-kanji-${character}`,
      character,
      meanings: [{ lang: "en", value: character === "氷" ? "ice" : "similar character" }],
      example_words: [],
      similar_kanji: ["水"],
      lookalikes: [],
      svg_animation_url: null,
    };
  }
  const envelope = await apiRequest<ApiEnvelope<KanjiDetailData>>(
    `/api/kanji/${encodeURIComponent(character)}`,
    { method: "GET" },
  );
  return envelope.data;
}

function delay(milliseconds = 180): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
