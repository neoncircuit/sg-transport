import {
  preferredGatewayPort,
  writeGatewayPort,
} from "@sg-transport/ports";
import { listenGateway } from "./gateway.js";

const preferred = preferredGatewayPort();
const gateway = await listenGateway({ preferredPort: preferred });
const portFile = await writeGatewayPort(gateway.port);

console.log(`[backend-ts] health http://localhost:${gateway.port}/health`);
console.log(`[backend-ts] ingest  POST http://localhost:${gateway.port}/ingest`);
console.log(`[backend-ts] websocket ws://localhost:${gateway.port}/ws`);
if (gateway.port !== preferred) {
  console.log(
    `[backend-ts] preferred port ${preferred} was busy — bound ${gateway.port}`,
  );
}
console.log(`[backend-ts] wrote ${portFile}`);
