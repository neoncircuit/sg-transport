import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  colourForRailRef,
  isRailLineOpen,
  operatorForRailRef,
  railLineInfo,
} from "./rail-lines.js";

describe("rail-lines", () => {
  it("maps NSL to SMRT red", () => {
    assert.equal(railLineInfo("nsl")?.operator, "SMRT");
    assert.equal(colourForRailRef("NSL"), "#DA291C");
  });

  it("maps NEL / DTL to SBS Transit", () => {
    assert.equal(operatorForRailRef("NEL"), "SBS Transit");
    assert.equal(operatorForRailRef("DTL"), "SBS Transit");
  });

  it("gives JRL a distinct colour (not neutral grey)", () => {
    assert.notEqual(colourForRailRef("JRL"), "#8899aa");
  });

  it("marks JRL / CRL as under construction (no simulated fleet)", () => {
    assert.equal(railLineInfo("JRL")?.status, "construction");
    assert.equal(railLineInfo("CRL")?.status, "construction");
    assert.equal(isRailLineOpen("JRL"), false);
    assert.equal(isRailLineOpen("CRL"), false);
    assert.equal(isRailLineOpen("NSL"), true);
  });

  it("keeps BPLRT open (renewal ≠ decommissioned)", () => {
    assert.equal(railLineInfo("BPLRT")?.status, "open");
    assert.equal(isRailLineOpen("BP"), true);
  });

  it("aliases short LRT refs to catalogue codes", () => {
    assert.equal(railLineInfo("BP")?.ref, "BPLRT");
    assert.equal(railLineInfo("SK")?.ref, "SKLRT");
    assert.equal(railLineInfo("PG")?.ref, "PGLRT");
  });

  it("treats Sengkang and Punggol LRT as separate lines", () => {
    assert.notEqual(railLineInfo("SKLRT")?.ref, railLineInfo("PGLRT")?.ref);
    assert.match(railLineInfo("SKLRT")!.label, /Sengkang/i);
    assert.match(railLineInfo("PGLRT")!.label, /Punggol/i);
  });
});
