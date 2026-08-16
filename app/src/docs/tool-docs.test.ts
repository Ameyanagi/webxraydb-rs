import { describe, expect, it } from "vitest";
import { TOOL_DOC_IDS, resolveToolDocId } from "~/docs/types";
import { TOOL_DOCS } from "~/docs/tool-docs";

describe("tool docs registry", () => {
  it("covers all declared tool doc ids with equations and references", () => {
    for (const id of TOOL_DOC_IDS) {
      const doc = TOOL_DOCS[id];
      expect(doc).toBeTruthy();
      expect(doc.id).toBe(id);
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.theorySummary.length).toBeGreaterThan(0);
      expect(doc.algorithmSteps.length).toBeGreaterThan(0);
      expect(doc.equations.length).toBeGreaterThan(0);
      expect(doc.references.length).toBeGreaterThan(0);
    }
  });

  it("resolves docs by current route path", () => {
    expect(resolveToolDocId("/")).toBe("/");
    expect(resolveToolDocId("/edges")).toBe("/edges");
    expect(resolveToolDocId("/ionchamber")).toBe("/ionchamber");
    expect(resolveToolDocId("/sample-preparation-helper")).toBe(
      "/sample-preparation-helper",
    );
    expect(resolveToolDocId("/element/44")).toBe("/element/$z");
    expect(resolveToolDocId("/unknown-path")).toBeNull();
  });

  it("resolves every declared id to a doc that exists", () => {
    for (const id of TOOL_DOC_IDS) {
      const path = id === "/element/$z" ? "/element/26" : id;
      const resolved = resolveToolDocId(path);
      expect(resolved).toBe(id);
      expect(TOOL_DOCS[resolved!]).toBeTruthy();
    }
  });
});
