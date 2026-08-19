import { beforeEach, describe, expect, it } from "vitest";

import { demoDictionary } from "@/lib/demo-data";
import { useAdminStore } from "@/stores/admin-store";

beforeEach(() => {
  useAdminStore.setState({
    dictionary: structuredClone(demoDictionary),
    audit: [],
  });
});

describe("admin audit store", () => {
  it("records an audit event for update and delete mutations", () => {
    const store = useAdminStore.getState();
    const target = store.dictionary[0]!;
    store.updateDictionary(target.id, { jlptLevel: "N4" });
    expect(useAdminStore.getState().dictionary[0]?.jlptLevel).toBe("N4");
    expect(useAdminStore.getState().audit[0]).toMatchObject({
      action: "update",
      entityType: "dictionary_entry",
      entityId: target.id,
    });

    store.bulkDictionary([target.id], { delete: true });
    expect(useAdminStore.getState().dictionary.some((item) => item.id === target.id)).toBe(false);
    expect(useAdminStore.getState().audit[0]?.action).toBe("delete");
  });
});
