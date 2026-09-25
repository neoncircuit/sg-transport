import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_MODES, basemapStyleFor } from "./config.js";
import { DEFAULT_THEME, getTheme, isThemeId, THEMES } from "./themes.js";

describe("themes", () => {
  it("includes daylight as default with a light basemap", () => {
    assert.equal(DEFAULT_THEME, "daylight");
    assert.equal(getTheme("daylight").basemap, "light");
    assert.match(basemapStyleFor("light"), /liberty/);
    assert.match(basemapStyleFor("dark"), /dark/);
  });

  it("covers every VehicleMode for each theme", () => {
    for (const theme of THEMES) {
      for (const mode of ALL_MODES) {
        assert.match(theme.modeColors[mode], /^#/);
      }
      assert.ok(theme.label.length > 0);
      assert.ok(isThemeId(theme.id));
      assert.ok(theme.basemap === "light" || theme.basemap === "dark");
      assert.match(theme.themeColor, /^#/);
    }
  });

  it("rejects unknown theme ids", () => {
    assert.equal(isThemeId("neon-soup"), false);
    assert.equal(isThemeId(null), false);
  });
});
