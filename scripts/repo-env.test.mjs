import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { windowsPathToWsl } from "./repo-env.mjs";

describe("windowsPathToWsl", () => {
  it("maps drive letters into /mnt/<drive>", () => {
    assert.equal(
      windowsPathToWsl("D:/GitHub/sg-transport/.local/corp-ca.pem"),
      "/mnt/d/GitHub/sg-transport/.local/corp-ca.pem",
    );
    assert.equal(
      windowsPathToWsl("D:\\GitHub\\sg-transport\\.local\\corp-ca.pem"),
      "/mnt/d/GitHub/sg-transport/.local/corp-ca.pem",
    );
  });

  it("leaves posix paths alone", () => {
    assert.equal(windowsPathToWsl("/mnt/d/foo"), "/mnt/d/foo");
  });
});
