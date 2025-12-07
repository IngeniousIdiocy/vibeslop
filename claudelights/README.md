# ClaudeLights - LC7001 Bridge

A Node.js bridge server that connects a **Legrand LC7001** lighting controller to HTTP clients (like Apple Shortcuts/Siri) with optional **AI-powered natural language control** via Claude.

## Overview

This bridge maintains a persistent TCP connection to the LC7001 controller and exposes a simple HTTP REST API. It also includes a `/nl` endpoint that uses Claude (Anthropic's API) to interpret natural language lighting commands.

```
┌─────────────────┐      HTTP       ┌──────────────┐      TCP       ┌─────────┐
│  Siri/Shortcuts │  ───────────►   │  LC7001      │  ───────────►  │  LC7001 │
│  curl / apps    │    :3000        │  Bridge      │    :2112       │  Panel  │
└─────────────────┘                 └──────────────┘                └─────────┘
                                           │
                                           │ HTTPS (for /nl)
                                           ▼
                                    ┌──────────────┐
                                    │  Anthropic   │
                                    │  Claude API  │
                                    └──────────────┘
```

## Features

- **Persistent TCP connection** to LC7001 with automatic reconnection
- **Zone discovery** - automatically enumerates all lighting zones on startup
- **Real-time state tracking** - listens for `ZonePropertiesChanged` broadcasts
- **REST API** for direct zone control (on/off/dim)
- **Natural language endpoint** (`/nl`) powered by Claude Haiku for voice commands like "turn off the kitchen lights" or "dim the living room to 50%"
- **CORS enabled** for browser-based clients

## Requirements

- **Node.js 18+** (uses native `fetch`)
- Network access to your LC7001 controller
- (Optional) `ANTHROPIC_API_KEY` environment variable for the `/nl` endpoint

## Configuration

Edit the constants at the top of `lc7001-bridge.js`:

```javascript
const LC_HOST = '192.168.1.63';     // LC7001 IP address
const LC_PORT = 2112;               // LC7001 TCP API port (default)
const HTTP_PORT = 3000;             // HTTP server port
```

## Usage

### Start the server

```bash
# Without natural language support
node lc7001-bridge.js

# With natural language support
ANTHROPIC_API_KEY=sk-ant-... node lc7001-bridge.js
```

On startup, the server will:
1. Connect to the LC7001 via TCP
2. Discover all configured zones
3. Start the HTTP server on port 3000

### Example output

```
[HTTP] LC7001 bridge listening on http://0.0.0.0:3000
[LC7001] Connected to 192.168.1.63:2112
[LC7001] Refreshing zones...
[LC7001] Zones discovered:
  ZID 0: Kitchen Island (Dimmer)
  ZID 1: Kitchen Sink (Dimmer)
  ZID 2: Living Room (Dimmer)
  ZID 3: Office (Dimmer)
```

## API Reference

### `GET /zones`

Returns a list of all discovered zones with their current state.

**Response:**
```json
{
  "zones": [
    {
      "id": 0,
      "name": "Kitchen Island",
      "deviceType": "Dimmer",
      "powerLevel": 100,
      "power": true
    },
    ...
  ]
}
```

### `POST /zone/:id/on`

Turns on a zone at its last brightness level (or 100% if unknown).

**Example:**
```bash
curl -X POST http://localhost:3000/zone/0/on
```

**Response:**
```json
{ "ok": true, "zone": 0, "state": "on" }
```

### `POST /zone/:id/off`

Turns off a zone.

**Example:**
```bash
curl -X POST http://localhost:3000/zone/0/off
```

**Response:**
```json
{ "ok": true, "zone": 0, "state": "off" }
```

### `POST /zone/:id/level`

Sets a zone to a specific brightness level (0-100).

**Request body:**
```json
{ "level": 50 }
```

**Example:**
```bash
curl -X POST http://localhost:3000/zone/2/level \
  -H "Content-Type: application/json" \
  -d '{"level": 50}'
```

**Response:**
```json
{ "ok": true, "zone": 2, "level": 50 }
```

### `POST /nl` (Natural Language)

Interprets a natural language command and executes the appropriate zone changes. Requires `ANTHROPIC_API_KEY`.

**Request body:**
```json
{ "command": "turn off the kitchen lights and dim the living room to 30 percent" }
```

**Example:**
```bash
curl -X POST http://localhost:3000/nl \
  -H "Content-Type: application/json" \
  -d '{"command": "turn off the kitchen lights"}'
```

**Response:**
```json
{
  "ok": true,
  "command": "turn off the kitchen lights",
  "actions": [
    { "zone_id": 0, "name": "Kitchen Island", "brightness": 0 },
    { "zone_id": 1, "name": "Kitchen Sink", "brightness": 0 }
  ]
}
```

**Supported phrases:**
- "turn on/off the [room] lights"
- "dim the [room] to [X] percent"
- "set [room] to half" (50%)
- "dim [room]" (defaults to 30%)
- Room names are matched against zone names (e.g., "kitchen" matches "Kitchen Island")

## Apple Shortcuts Integration

Create a Shortcut that:
1. Uses "Get Contents of URL" action
2. Set URL to `http://<bridge-ip>:3000/nl`
3. Method: POST
4. Request Body: JSON with `{"command": "Dictated Text"}`
5. Add to Siri for voice control

Example Shortcut flow:
```
Dictate Text → Get Contents of URL (POST /nl with command) → Show Result
```

## LC7001 Protocol Notes

The LC7001 uses a TCP-based JSON protocol with null byte (`\0`) delimiters. Key services used:

- `ListZones` - Get list of zone IDs
- `ReportZoneProperties` - Get properties for a specific zone
- `SetZoneProperties` - Change zone power/level
- `ZonePropertiesChanged` - Broadcast when zone state changes

The bridge handles JSON message extraction from the TCP stream, including proper handling of nested braces and string escapes.

## Troubleshooting

**"Socket not connected to LC7001"**  
The bridge hasn't connected yet or lost connection. It will auto-reconnect every 5 seconds.

**"ANTHROPIC_API_KEY not set"**  
Set the environment variable to use the `/nl` endpoint.

**Zone not responding**  
Check that the zone ID exists by calling `GET /zones`. The LC7001 may take a moment to report all zones after connection.

## License

MIT
