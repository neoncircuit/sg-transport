# SG Live MCP server

Optional Model Context Protocol server that queries the live
`backend-ts` gateway (`GET /vehicles`) so agents can ask about nearby
vehicles and route/line membership without talking to pollers directly.

## Tools

| Tool | Purpose |
|---|---|
| `vehicles_near` | Vehicles within a radius (metres) of a lat/lon |
| `vehicles_on_route` | Vehicles whose `lineRef` matches a route/line code |
| `vehicle_snapshot` | Compact store summary (counts by mode) |

## Run

With the gateway up (`pnpm dev` or `backend-ts` alone):

```bash
python3 -m pip install -e "packages/mcp-server-py[dev]"
GATEWAY_URL=http://127.0.0.1:8787 python3 -m sg_transport_mcp
```

Cursor / Claude Desktop stdio config example:

```json
{
  "mcpServers": {
    "sg-transport": {
      "command": "python3",
      "args": ["-m", "sg_transport_mcp"],
      "env": { "GATEWAY_URL": "http://127.0.0.1:8787" }
    }
  }
}
```

## Tests

```bash
python3 -m pytest packages/mcp-server-py/tests -q
```
