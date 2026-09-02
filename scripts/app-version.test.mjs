import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatVersionBadge } from "./app-version.mjs";

describe("formatVersionBadge", () => {
  it("keeps an exact tag compact", () => {
    assert.equal(formatVersionBadge("v0.1.0"), "v0.1.0");
  });

  it("shows commits-since-tag as +N", () => {
    assert.equal(formatVersionBadge("v0.1.0-8-gdee598f"), "v0.1.0+8");
  });

  it("preserves dirty suffix", () => {
    assert.equal(formatVersionBadge("v0.1.0-2-gabc1234-dirty"), "v0.1.0+2-dirty");
  });
});
