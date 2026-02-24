import { describe, expect, it } from "vitest";
import { TOOL_DOC_IDS } from "~/docs/types";
import { TOOL_DOCS, getToolDocByPath } from "~/docs/tool-docs";

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
    expect(getToolDocByPath("/")?.id).toBe("/");
    expect(getToolDocByPath("/edges")?.id).toBe("/edges");
    expect(getToolDocByPath("/ionchamber")?.id).toBe("/ionchamber");
    expect(getToolDocByPath("/sample-preparation-helper")?.id).toBe(
      "/sample-preparation-helper",
    );
    expect(getToolDocByPath("/element/44")?.id).toBe("/element/$z");
    expect(getToolDocByPath("/unknown-path")).toBeNull();
  });
});
