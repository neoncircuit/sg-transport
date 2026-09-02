import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findFreePort,
  isPortTaken,
  preferredGatewayPort,
} from "./index.js";
import { createServer } from "node:net";

describe("ports", () => {
  it("reports a preferred default of 8787", () => {
    const prev = process.env.PORT;
    delete process.env.PORT;
    delete process.env.GATEWAY_PORT;
    try {
      assert.equal(preferredGatewayPort(), 8787);
    } finally {
      if (prev !== undefined) process.env.PORT = prev;
    }
  });

  it("findFreePort skips a bound port", async () => {
    const blocker = createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = blocker.address();
    assert.ok(addr && typeof addr !== "string");
    const taken = addr.port;
    assert.equal(await isPortTaken(taken), true);

    const free = await findFreePort(taken, 5);
    assert.notEqual(free, taken);
    assert.equal(await isPortTaken(free), false);

    await new Promise<void>((resolve, reject) => {
      blocker.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
