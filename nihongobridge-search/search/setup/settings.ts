import type { Settings } from "meilisearch";

import { INDEXES } from "../lib/config.js";

export const INDEX_SETTINGS: Record<string, Settings> = {
  [INDEXES.dictionary]: {
    searchableAttributes: ["word", "kana", "romaji", "meanings", "search_normalized"],
    displayedAttributes: [
      "id",
      "word",
      "kana",
      "romaji",
      "meanings",
      "jlpt_level",
      "part_of_speech",
      "frequency_rank",
      "tags",
      "has_audio",
    ],
    filterableAttributes: ["jlpt_level", "part_of_speech", "tags", "has_audio"],
    sortableAttributes: ["frequency_rank"],
    rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness"],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    },
    faceting: { maxValuesPerFacet: 100, sortFacetValuesBy: { "*": "alpha" } },
  },
  [INDEXES.kanji]: {
    searchableAttributes: [
      "character",
      "onyomi",
      "kunyomi",
      "meanings",
      "search_normalized",
    ],
    displayedAttributes: [
      "id",
      "character",
      "onyomi",
      "kunyomi",
      "meanings",
      "jlpt_level",
      "grade",
      "stroke_count",
      "frequency_rank",
    ],
    filterableAttributes: ["jlpt_level", "grade", "stroke_count"],
    sortableAttributes: ["frequency_rank", "stroke_count"],
    typoTolerance: {
      enabled: true,
      disableOnAttributes: ["character"],
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    },
  },
  [INDEXES.grammar]: {
    searchableAttributes: ["pattern", "pattern_plain", "meaning", "search_normalized"],
    displayedAttributes: ["id", "pattern", "pattern_plain", "meaning", "jlpt_level", "tags"],
    filterableAttributes: ["jlpt_level"],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    },
  },
  [INDEXES.sentences]: {
    searchableAttributes: ["japanese", "translations", "search_normalized"],
    displayedAttributes: ["id", "japanese", "translations", "jlpt_level", "tags"],
    filterableAttributes: ["jlpt_level"],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    },
  },
  [INDEXES.autocomplete]: {
    searchableAttributes: ["word", "kana", "search_normalized"],
    displayedAttributes: ["id", "word", "kana"],
    rankingRules: ["words", "proximity", "attribute", "typo", "exactness"],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 3, twoTypos: 7 },
    },
    pagination: { maxTotalHits: 100 },
  },
};
