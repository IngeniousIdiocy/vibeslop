# LC7001 Bridge V2 — AI-Powered Smart Lighting for Your Entire Network

> **"Hey, my kid is going to be late for the bus, so strobe the lights in their room for a minute"** — and it just works. From your iPhone, from your Mac, from any AI agent on your network.

The LC7001 Bridge V2 transforms your Legrand/Wattstopper LC7001 lighting controller into a network-accessible, AI-powered lighting brain. Speak naturally. Control everything. Let AI handle the details.

---

## 🎯 What Is This?

A single Node.js server that:

- **Connects to your LC7001** lighting controller via TCP
- **Exposes natural language control** via a simple HTTP API (`/nl` endpoint)
- **Provides MCP (Model Context Protocol)** so AI agents across your network can control lights directly
- **Powers iPhone Shortcuts** — ask Siri, get results
- **Works with Claude Desktop** — both network mode and subprocess mode

One server. Multiple access patterns. All your lights.

---

## 🏗️ Architecture

```
                                                        ┌─────────────────────┐
                                                        │    ☁️ Claude API     │
                                                        │ (api.anthropic.com) │
                                                        └──────────▲──────────┘
                                                                   │      
                                                    "user command" ▼   "tool calls / dynamic scripts"
                                                              ▲────┴──────┐
                                                              │           │
┌─────────────────────────┐      ┌────────────────────────────│───────────│────────────┐
│                         │      │  LC7001 BRIDGE V2 SERVER   │           │            │
│   /nl CLIENTS           │      │                            │           │            │
│                         │      │                            │           ▼            │
│  ┌───────────────────┐  │      │  ┌─────────────────────────┴─────────────────────┐  │
│  │                   │  │      │  │                                               │  │
│  │  📱 iPhone        │──┼──────┼─▶│              /nl Endpoint (:3080)             │  │
│  │     Shortcuts     │  │      │  │                                               │  │
│  │                   │  │ HTTP │  │  Receives natural language, calls Claude API, │  │
│  │  "Turn on the     │  │      │  │  gets tool calls, executes them below         │  │
│  │   living room"    │  │      │  │                                               │  │
│  │                   │  │      │  └─────────────────────┬─────────────────────────┘  │
│  └───────────────────┘  │      │       ▲                │                            │
│                         │      │       │                │ tool calls                 │
│  ┌───────────────────┐  │ HTTP │       │                │                            │
│  │  💻 Terminal/curl │──┼──────┼───────┘                │                            │
│  └───────────────────┘  │      │                        ▼                            │
└─────────────────────────┘      │  ┌───────────────────────────────────────────────┐  │
                                 │  │                                               │  │
                                 │  │      Shared Tool Layer and Script Engine      │  │     ┌──────────────┐
                                 │  │                                               │  │     │              │
                                 │  │  • lights_list_zones    • lights_run_script   │  │ TCP │    LC7001    │
                                 │  │  • lights_set           • lights_schedule_set │──┼────▶│  Controller  │
                                 │  │  • lights_list_jobs     • lights_stop_job     │  │     │              │
                                 │  │  • lights_health                              │  │     │  (Legrand/   │
                                 │  │                                               │  │     │ Wattstopper) │
                                 │  └───────────────────────────────────────────────┘  │     │              │
                                 │                        ▲                            │     └──────────────┘
                                 │                        │ tool calls                 │
                                 │                        │                            │
                                 │  ┌─────────────────────┴─────────────────────────┐  │
                                 │  │                                               │  │
                                 │  │            MCP Server (:3081/stdio)           │  │
┌─────────────────────────┐      │  │                                               │  │
│                         │      │  │  Exposes tools directly to external AI agents │  │
│   MCP CLIENTS           │      │  │  via HTTP+SSE or stdio transport              │  │
│                         │      │  │                                               │  │
│  ┌───────────────────┐  │      │  └───────────────────────────────────────────────┘  │
│  │  🖥️ Claude Desktop│  │      │         ▲      ▲        ▲        ▲                  │
│  │    (Network)      │──┼──────┼─────────┘      │        │        │                  │
│  └───────────────────┘  │ MCP  │                │        │        │                  │
│                         │ :3081│                │        │        │                  │
│  ┌───────────────────┐  │ /sse │                │        │        │                  │
│  │  🖥️ Claude Desktop│  │      │                │        │        │                  │
│  │   (Subprocess)    │──┼──────┼────────────────┘        │        │                  │
│  └───────────────────┘  │stdio │ (not implemented yet)   │        │                  │
│                         │      │                         │        │                  │
│  ┌───────────────────┐  │      │                         │        │                  │
│  │  🤖 AI Agent A    │  │      │                         │        │                  │
│  │  (192.168.1.50)   │──┼──────┼─────────────────────────┘        │                  │
│  └───────────────────┘  │ MCP  │                                  │                  │
│                         │ :3081│                                  │                  │
│  ┌───────────────────┐  │ /sse │                                  │                  │
│  │  🤖 AI Agent B    │  │      │                                  │                  │
│  │  (192.168.1.51)   │──┼──────┼──────────────────────────────────┘                  │
│  └───────────────────┘  │      │                                                     │
│                         │      │                                                     │
└─────────────────────────┘      └─────────────────────────────────────────────────────┘
```

### The Two Server Ports

| Port | Protocol | Who Uses It | What It Does |
|------|----------|-------------|--------------|
| **3080** | HTTP/REST | iPhone Shortcuts, curl, web apps | Natural language via `/nl`, direct zone control, job management |
| **3081** | MCP (HTTP+SSE) | Claude Desktop, AI agents on your LAN | Direct tool access — the AI **is** the LLM, calls tools directly |

### Why Two Ports?

The **`/nl` endpoint** (port 3080) accepts plain English, calls Claude API internally, runs an agentic tool loop, and returns a response. Your iPhone says "turn on the kitchen" → Claude figures out which tool calls to make → lights change.

The **MCP server** (port 3081) exposes raw tools. An external AI (Claude Desktop, your own agent) connects, sees `lights_set`, `lights_run_script`, etc., and calls them directly. No intermediary Claude — the connecting AI **is** the reasoning engine.

---

## ⚡ Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd claudelights

# Core dependencies (none required for basic operation!)
# The server is a single file with zero npm dependencies for HTTP mode

# For MCP support (optional but recommended):
npm install @modelcontextprotocol/sdk
```

### 2. Configure Environment

Create a `.env` file or export these variables:

```bash
# Required: Your LC7001 controller IP
export LC7001_HOST=192.168.1.63

# Required for /nl endpoint: Claude API key
export ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional (with defaults shown)
export LC7001_PORT=2112           # LC7001 listens on 2112 by default
export LC7001_PASSWORD=yourpass   # If your controller requires auth
export HTTP_PORT=3080             # HTTP API port (0 to disable)
export MCP_PORT=3081              # MCP server port (0 to disable)
export ANTHROPIC_MODEL=claude-haiku-4-5  # Fast & cheap
export LOG_LEVEL=info             # debug|info|warn|error
```

### 3. Run It

```bash
node lc7001-bridge-v2.js
```

You'll see:

```
[2025-01-15T10:30:00.000Z] [INFO] LC7001 connected to 192.168.1.63:2112
[2025-01-15T10:30:00.500Z] [INFO] 
========== ZONES LOADED (12) ==========
  ZID  0: ON  80% | Kitchen Main [Dimmer]
  ZID  1: OFF   0% | Living Room [Dimmer]
  ZID  2: ON  50% | Dining Room [Dimmer]
  ...
==========================================

[2025-01-15T10:30:00.600Z] [INFO] HTTP API listening on http://0.0.0.0:3080
[2025-01-15T10:30:00.700Z] [INFO] MCP server (HTTP+SSE) listening on http://0.0.0.0:3081
```

---

## 📱 Usage: iPhone Shortcuts

The killer feature. Ask Siri to control your lights.

### Create the Shortcut

1. Open **Shortcuts** app on iPhone
2. Create new shortcut
3. Add action: **Get contents of URL**
   - URL: `http://YOUR_SERVER_IP:3080/nl`
   - Method: **POST**
   - Headers: `Content-Type: application/json`
   - Request Body: JSON
   - Add key `command` with value: **Shortcut Input** or **Ask Each Time**
4. Add action: **Get Dictionary Value** → key: `response`
5. Add action: **Speak Text** (optional, for voice feedback)

### Example Shortcut JSON Body

```json
{
  "command": "Turn on the kitchen to 75%"
}
```

### Voice Commands That Work

- "Turn on all the lights"
- "Set the living room to 50%"
- "Turn off the second floor"
- "Make the office brighter"
- "Dim the bedroom to 20%"
- "Turn off everything except the kitchen"
- "Slowly fade the bedroom to 10% over 5 minutes"
- "Pulse the kitchen lights for 30 seconds"
- "Make the office lights breathe for a minute"

---

## 💻 Usage: curl / Command Line

### Natural Language Control

```bash
# Simple command
curl -X POST http://localhost:3080/nl \
  -H "Content-Type: application/json" \
  -d '{"command": "Turn on the kitchen lights"}'

# Response:
{
  "ok": true,
  "command": "Turn on the kitchen lights",
  "response": "Kitchen Main set to 100%.",
  "iterations": 2,
  "toolCalls": 1
}
```

### Direct Zone Control (No AI)

```bash
# Turn on specific zones by name (use EXACT zone names!)
curl -X POST http://localhost:3080/zones/set \
  -H "Content-Type: application/json" \
  -d '{
    "targets": {"zoneNames": ["Kitchen Main", "Living or Family Rm"]},
    "props": {"power": true, "powerLevel": 75}
  }'

# Turn off all lights
curl -X POST http://localhost:3080/zones/set \
  -H "Content-Type: application/json" \
  -d '{"targets": {"all": true}, "props": {"power": false}}'

# Setting powerLevel > 0 automatically turns on, powerLevel = 0 turns off
curl -X POST http://localhost:3080/zones/set \
  -H "Content-Type: application/json" \
  -d '{"targets": {"zoneNames": ["Office First Floor"]}, "props": {"powerLevel": 50}}'
```

### List All Zones

```bash
curl http://localhost:3080/zones

# With fresh data from controller:
curl "http://localhost:3080/zones?refresh=true"
```

### Run Scripts (for effects/animations)

```bash
# Start a pulse effect via script
curl -X POST http://localhost:3080/scripts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "office-pulse",
    "code": "const end = lights.now() + 30000; while (lights.now() < end && !lights.isAborted()) { await lights.set({zoneNames: [\"Office First Floor\"]}, {powerLevel: 100}); await lights.sleep(500); await lights.set({zoneNames: [\"Office First Floor\"]}, {powerLevel: 10}); await lights.sleep(500); }",
    "timeoutMs": 60000
  }'

# Start a slow fade via script
curl -X POST http://localhost:3080/scripts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "bedroom-fade",
    "code": "for (let i = 100; i >= 5 && !lights.isAborted(); i -= 5) { await lights.set({zoneNames: [\"Master Main\"]}, {powerLevel: i}); await lights.sleep(30000); }",
    "timeoutMs": 660000
  }'
```

### Manage Jobs

```bash
# List all jobs (running effects, scheduled changes)
curl http://localhost:3080/jobs

# Stop a job
curl -X POST http://localhost:3080/jobs/stop/effect-abc123
```

### Health Check

```bash
curl http://localhost:3080/health
```

---

## 🖥️ Usage: Claude Desktop (Network Mode)

Connect Claude Desktop to your bridge over the network using MCP.

### Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "home-lights": {
      "transport": {
        "type": "sse",
        "url": "http://192.168.1.100:3081/sse"
      }
    }
  }
}
```

Replace `192.168.1.100` with your server's IP.

### Restart Claude Desktop

After saving the config, restart Claude Desktop. You'll see "home-lights" in the MCP tools panel.

### Talk to Claude

Now you can say things like:

> "Turn on the kitchen lights to 80%"

Claude will call `lights_set` directly through MCP — no intermediary API calls.

---

## 🖥️ Usage: Claude Desktop (Subprocess Mode)

For local-only setups, Claude Desktop can launch the bridge as a subprocess.

### Configure Claude Desktop

```json
{
  "mcpServers": {
    "home-lights": {
      "command": "node",
      "args": ["/path/to/lc7001-bridge-v2.js"],
      "env": {
        "LC7001_HOST": "192.168.1.63",
        "LC7001_PASSWORD": "yourpassword",
        "HTTP_PORT": "0",
        "MCP_PORT": "0"
      }
    }
  }
}
```

**Note:** In subprocess mode, disable HTTP and MCP ports (`"0"`) since Claude Desktop communicates via stdio.

---

## 🤖 Usage: Custom AI Agents

Build your own AI agents that control lights on your network.

### Python Example with MCP Client

```python
import asyncio
from mcp import Client
from mcp.transports.sse import SSEClientTransport

async def main():
    transport = SSEClientTransport("http://192.168.1.100:3081/sse")
    client = Client()
    await client.connect(transport)
    
    # List available tools
    tools = await client.list_tools()
    print("Available tools:", [t.name for t in tools])
    
    # Call a tool (use exact zone names!)
    result = await client.call_tool("lights_set", {
        "targets": {"zoneNames": ["Kitchen Main"]},
        "power": True,
        "powerLevel": 75
    })
    print("Result:", result)

asyncio.run(main())
```

### JavaScript/Node.js Example

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport("http://192.168.1.100:3081/sse");
const client = new Client({ name: "my-agent", version: "1.0.0" });

await client.connect(transport);

const result = await client.callTool("lights_list_zones", {});
console.log("Zones:", JSON.parse(result.content[0].text));
```

---

## 🛠️ Available Tools

All tools are available through both `/nl` (via Claude) and MCP (direct).

| Tool | Description |
|------|-------------|
| `lights_list_zones` | List all zones with current power/level state |
| `lights_set` | Set power and/or brightness for target zones |
| `lights_run_script` | Run JS lighting scripts for effects/animations (sandboxed) |
| `lights_schedule_set` | Schedule a future lighting change |
| `lights_list_jobs` | List all running/scheduled jobs |
| `lights_stop_job` | Stop a running job by ID |
| `lights_health` | Get system health and connection status |

### Target Resolution

The `targets` parameter uses **exact zone names** (case-insensitive):

```javascript
// All zones
{ "all": true }

// By zone ID
{ "zoneIds": [0, 1, 2] }

// By exact name (case-insensitive)
{ "zoneNames": ["Kitchen Main", "Living or Family Rm"] }

// Exclude specific zones
{ "all": true, "excludeZoneIds": [5] }
```

**Important:** Zone names must match exactly. No fuzzy matching — if you get a name wrong, you'll receive an error listing the available zones so you can retry.

---

## 📜 Scripts & Effects

All dynamic lighting behaviors (effects, animations, sequences) are implemented via JavaScript scripts. Claude writes these automatically when you ask for effects via natural language.

### Script API

Inside scripts, you have access to:

| Function | Description |
|----------|-------------|
| `await lights.set(targets, props)` | Set zone properties (power, powerLevel, rampRate) |
| `await lights.sleep(ms)` | Pause execution (max 5 min per call) |
| `lights.now()` | Current timestamp in milliseconds |
| `lights.isAborted()` | Check if user stopped the job |

### Example: Pulse Effect

```javascript
const endTime = lights.now() + 60000; // 60 seconds
while (lights.now() < endTime && !lights.isAborted()) {
  await lights.set({zoneNames: ["Kitchen Main"]}, {powerLevel: 100});
  await lights.sleep(500);
  await lights.set({zoneNames: ["Kitchen Main"]}, {powerLevel: 0});
  await lights.sleep(500);
}
```

### Example: Breathing Effect

```javascript
const endTime = lights.now() + 60000;
while (lights.now() < endTime && !lights.isAborted()) {
  // Fade up
  for (let pct = 10; pct <= 100; pct += 5) {
    await lights.set({zoneNames: ["Office First Floor"]}, {powerLevel: pct});
    await lights.sleep(100);
  }
  // Fade down
  for (let pct = 100; pct >= 10; pct -= 5) {
    await lights.set({zoneNames: ["Office First Floor"]}, {powerLevel: pct});
    await lights.sleep(100);
  }
}
```

### Example: Gradual Fade (Bedtime)

```javascript
const steps = 20;
for (let i = 0; i <= steps && !lights.isAborted(); i++) {
  const level = Math.round(100 - (i / steps) * 100);
  await lights.set({zoneNames: ["Master Main"]}, {powerLevel: level});
  await lights.sleep(30000 / steps); // 30 sec total
}
```

### Via Natural Language

Just ask Claude:

> "Pulse the office lights for 30 seconds"
> "Slowly dim the bedroom over 10 minutes"
> "Make the kitchen lights breathe"
> "Flash all the lights 5 times"

Claude writes and executes the appropriate script automatically.

### Via curl

```bash
curl -X POST http://localhost:3080/scripts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "party-mode",
    "code": "for (let i = 0; i < 10 && !lights.isAborted(); i++) { await lights.set({all: true}, {powerLevel: Math.floor(Math.random() * 100)}); await lights.sleep(500); }",
    "timeoutMs": 30000
  }'
```

---

## 🔧 Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LC7001_HOST` | (required) | IP address of your LC7001 controller |
| `LC7001_PORT` | `2112` | TCP port of LC7001 |
| `LC7001_PASSWORD` | — | Password for LC7001 authentication |
| `LC7001_KEY` | — | 32-hex auth key (overrides password) |
| `LC7001_SETKEY_PASSWORD` | — | Password to set if controller is in SETKEY mode |
| `LC7001_DELIMITER` | `null` | Message delimiter: `null` or `newline` |
| `ANTHROPIC_API_KEY` | (required for /nl) | Claude API key |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` | Claude model to use |
| `MAX_TOOL_ITERATIONS` | `100` | Max tool calls per /nl request |
| `HTTP_PORT` | `3080` | HTTP API port (0 to disable) |
| `MCP_PORT` | `3081` | MCP server port (0 to disable) |
| `LOG_LEVEL` | `info` | Logging level: debug/info/warn/error |
| `REQUEST_TIMEOUT_MS` | `10000` | Timeout for LC7001 requests |
| `ZONE_REFRESH_INTERVAL_MS` | `3600000` | Auto-refresh zones interval (1 hour) |

---

## 🔌 HTTP API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check with connection status |
| GET | `/zones` | List all zones (add `?refresh=true` for fresh data) |
| POST | `/zones/set` | Set zone properties directly |
| POST | `/nl` | Natural language command (Claude-powered) |
| POST | `/schedule` | Schedule a future lighting change |
| POST | `/scripts` | Run a custom JS script as background job |
| GET | `/jobs` | List all jobs |
| POST | `/jobs/stop/:id` | Stop a job by ID |

---

## 🚀 Running as a Service

### macOS (launchd)

Create `~/Library/LaunchAgents/com.lc7001.bridge.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.lc7001.bridge</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/lc7001-bridge-v2.js</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>LC7001_HOST</key>
        <string>192.168.1.63</string>
        <key>ANTHROPIC_API_KEY</key>
        <string>sk-ant-...</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/lc7001-bridge.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/lc7001-bridge.err</string>
</dict>
</plist>
```

Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.lc7001.bridge.plist
```

### Linux (systemd)

Create `/etc/systemd/system/lc7001-bridge.service`:

```ini
[Unit]
Description=LC7001 Bridge V2
After=network.target

[Service]
Type=simple
User=pi
Environment=LC7001_HOST=192.168.1.63
Environment=ANTHROPIC_API_KEY=sk-ant-...
ExecStart=/usr/bin/node /home/pi/lc7001-bridge-v2.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable it:

```bash
sudo systemctl enable lc7001-bridge
sudo systemctl start lc7001-bridge
```

---

## 🔒 Security Notes

- The server binds to `0.0.0.0` by default (all interfaces)
- Consider running behind a reverse proxy with authentication for internet exposure
- MCP connections are unauthenticated — only expose on trusted networks
- Scripts run in a sandboxed VM with limited API access
- Banned script tokens: `require`, `process`, `fs`, `net`, `http`, `eval`, etc.

---

## 🐛 Troubleshooting

### "LC7001 connect failed: ETIMEDOUT"

- Verify `LC7001_HOST` is correct
- Ensure the LC7001 is powered on and connected to your network
- Check that port 2112 is not blocked by a firewall

### "LC7001 auth: [INVALID]"

- Your password is wrong
- Check `LC7001_PASSWORD` environment variable

### "/nl endpoint returns 'ANTHROPIC_API_KEY not set'"

- Export your Anthropic API key: `export ANTHROPIC_API_KEY=sk-ant-...`

### "MCP SDK not installed"

- Install it: `npm install @modelcontextprotocol/sdk`
- HTTP API still works without it

### Zones not appearing

- Wait for initial connection and zone refresh
- Check logs for connection errors
- Try `curl http://localhost:3080/zones?refresh=true`

---

## 📄 License

MIT — do whatever you want with it.

---

## 🙏 Credits

Built for controlling Legrand/Wattstopper LC7001 lighting systems with Claude AI.

Made with ☕ and the dream of telling my house to turn off the lights.
