import { createGateway } from "./gateway.js";

const PORT = Number(process.env.PORT ?? 8787);

const gateway = await createGateway().listen(PORT);

console.log(`[backend-ts] health http://localhost:${gateway.port}/health`);
console.log(`[backend-ts] ingest  POST http://localhost:${gateway.port}/ingest`);
console.log(`[backend-ts] websocket ws://localhost:${gateway.port}/ws`);
