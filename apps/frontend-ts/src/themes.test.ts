import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_MODES } from "./config.js";
import { DEFAULT_THEME, THEMES, getTheme, isThemeId } from "./themes.js";

describe("themes", () => {
  it("includes harbour as default", () => {
    assert.equal(DEFAULT_THEME, "harbour");
    assert.equal(getTheme("harbour").id, "harbour");
  });

  it("covers every VehicleMode for each theme", () => {
    for (const theme of THEMES) {
      for (const mode of ALL_MODES) {
        assert.match(theme.modeColors[mode], /^#/);
      }
      assert.ok(theme.label.length > 0);
      assert.ok(isThemeId(theme.id));
    }
  });

  it("rejects unknown theme ids", () => {
    assert.equal(isThemeId("neon-soup"), false);
    assert.equal(isThemeId(null), false);
  });
});
