# Compass voice agent

`voice-agent/` is the independent real-time conversation layer for Compass. It
does not own user data, profiles or catalogue records. Its role is to listen,
reason, speak and call typed tools that
request recommendations.

The current milestone is fully operational spoken conversation:

```text
browser microphone
  → SmallWebRTC
  → SLNG speech-to-text
  → Nebius Token Factory LLM
  → SLNG text-to-speech
  → SmallWebRTC
  → browser / TV speaker
```

Recommendation tools call the existing backend and push structured catalogue
results to the board. Details resolve only from the active session's cache.
The prompt forbids inventing availability, prices or personal history.

## Why each platform is used

### Unmute

Unmute is the source-of-truth format and compiler for the agent:

- `agent.yaml` declares the agent, providers, models, region, tools and channel;
- `instructions.md` defines conversational behaviour independently of runtime
  code;
- `targets.yaml` selects Pipecat as the current target;
- validation catches definition errors before a demo;
- compilation produces a self-hosted runtime under `build/pipecat/`.

The generated directory is disposable and ignored by Git. Product decisions
belong in the source definition, not in generated Python.

### SLNG

SLNG owns both speech edges of the live agent:

| Direction | SLNG route | Configuration |
| --- | --- | --- |
| Listen | `deepgram/nova:3` | English, EU-West |
| Speak | `deepgram/aura:2` | English, `aura-2-thalia-en`, EU-West |

SLNG is therefore in the critical product path: without it the user cannot be
transcribed and Compass cannot be heard.

### Nebius Token Factory

Nebius provides the reasoning model through its OpenAI-compatible API:

```text
Qwen/Qwen3-30B-A3B-Instruct-2507
```

The LLM interprets mood and constraints, decides whether a question materially
improves the recommendation and writes the short response sent to TTS. The
current temperature is `0.3` for stable, concise conversation.

Nebius turns the conversation into structured recommendation and refinement calls.

### Pipecat and SmallWebRTC

Unmute compiles the definition into Pipecat, which runs the streaming pipeline,
turn aggregation, provider calls and client events. SmallWebRTC carries the
browser microphone and remote audio track. WebSocket is not used as the browser
voice transport because WebRTC provides an actual media track plus browser echo
cancellation and noise suppression.

### Silero

Silero runs locally for voice-activity and turn detection. The current generated
runtime uses a short VAD stop window and a bounded turn analyser so spoken turns
feel responsive without requiring another hosted model.

## Repository structure

```text
voice-agent/
├── agent.yaml                 # portable Unmute definition
├── instructions.md            # identity, voice contract and guardrails
├── targets.yaml               # Pipecat target
├── tools/
│   ├── end_call.yaml          # explicit conversational end tool
│   ├── recommend_titles.yaml
│   ├── refine_recommendations.yaml
│   ├── get_content_details.yaml
│   └── recommendations.py     # scoped backend calls and session cache
├── runtime/
│   ├── slng_stt_batched.py     # SLNG audio-message batching adapter
│   └── compass_session.py     # request context, tool schemas and RTVI events
├── scripts/
│   ├── common.ps1             # safe local environment loading
│   ├── dev.ps1                # compile, patch dependencies and start
│   ├── patch-generated.ps1    # installs the batching adapter after compile
│   ├── patch_generated.py     # shared runtime installation for all platforms
│   ├── validate.ps1           # validate and compile
│   ├── list-nebius-models.ps1 # read-only model availability check
│   └── test-nebius.ps1        # minimal LLM connectivity test
├── .env.example               # variable names only
├── run.py                     # cross-platform compile, patch and startup
├── tests/                     # tools, isolation and runtime contract checks
└── build/                     # generated, disposable and ignored
```

## Conversation contract

Everything the LLM writes is spoken, so the prompt is deliberately stricter
than a chat prompt:

- English for the current MVP;
- plain sentences, without Markdown, links or lists;
- normally fewer than twenty-five words per turn;
- one question at a time, usually fewer than twelve words;
- at most two useful clarification questions before it has enough context;
- no questions merely to keep the conversation alive;
- barge-in supported: stop speaking when the viewer starts;
- use `end_call` only after an explicit goodbye or end request.

These constraints improve TV comprehension and reduce LLM and TTS usage.

## SLNG message-rate protection

During browser testing, the SLNG STT bridge returned:

```text
WebSocket message rate limit exceeded (2000/minute)
```

SmallWebRTC supplies approximately one twenty-millisecond audio frame at a time,
which would produce about three thousand WebSocket messages per minute. The
repository-owned `BatchedSlngSTTService` pairs adjacent frames before forwarding
them to SLNG:

```text
before: 50 audio messages/second ≈ 3000/minute
after:  25 audio messages/second ≈ 1500/minute
```

At voice-activity end, any final unpaired frame is flushed before the SLNG
`finalize` control message. The trade-off is at most one frame interval of added
buffering, approximately twenty milliseconds.

`dev.ps1` recompiles the Unmute definition and then runs
`patch-generated.ps1`, so this adapter is consistently installed without
treating generated code as source.

## Secrets and configuration

Create the ignored local environment file:

```powershell
Copy-Item voice-agent\.env.example voice-agent\.env
```

Set:

```dotenv
NEBIUS_API_KEY=
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1/
SLNG_API_KEY=
BACKEND_URL=http://localhost:8000
```

Rules:

- never commit `voice-agent/.env`;
- never expose either key through a `VITE_*` frontend variable;
- do not paste secrets into screenshots, logs or challenge material;
- the frontend connects only to the agent endpoint.

## Validate and run

Use Unmute **0.4.2**, Pipecat **1.8.0** (pinned in `targets.yaml`), uv and
Python 3.12. On Linux/macOS, put `unmute` and `uv` on PATH:

```sh
python voice-agent/run.py --compile-only
python voice-agent/run.py
```

The wrapper installs dependencies into `voice-agent/.venv`, outside the disposable
build directory. It installs both the SLNG adapter and the session bridge.
Generated tool schemas retain the nested YAML preference fields.

On Windows the PowerShell scripts expect repository-local executables at
`.tools/unmute/unmute.exe` and `.tools/uv/uv.exe` (ignored by Git).

From the repository root:

```powershell
# Validate the portable definition and compile the target
.\voice-agent\scripts\validate.ps1

# Optional provider checks
.\voice-agent\scripts\list-nebius-models.ps1
.\voice-agent\scripts\test-nebius.ps1

# Compile, install the batching adapter and start SmallWebRTC
.\voice-agent\scripts\dev.ps1
```

The runtime listens on `http://localhost:7860`. Use the Compass frontend:
the agent requires its session context, which the stock Pipecat playground does
not supply. `POST /start` receives `requestData.body` containing
`{ sessionId, profileId, mode }`; the runner forwards it as `runner_args.body`.

Press `Ctrl+C` in the agent terminal to stop the server. In the product UI,
pressing the large orb ends an active pre-results conversation. With results on
screen, the small orb pauses or resumes listening.

## Frontend event mapping

The custom frontend maps Pipecat callbacks into product state:

| Pipecat event | UI result |
| --- | --- |
| user started speaking | `Listening` and active pulse |
| interim/final user transcript | live subtitle |
| LLM started | `Thinking…` |
| bot output | agent subtitle |
| bot started speaking | `Compass` speaking state |
| remote audio track started | attach track to browser audio output |
| bot stopped speaking | return to listening |
| disconnected/error | clean local media and display a safe state |

After a successful recommendation call, the bridge sends an RTVI
`{ label: "rtvi-ai", type: "server-message", data: event }` transport frame.
The frontend receives `event` in `onServerMessage`:

```ts
{
  type: 'recommendations.updated',
  sessionId: string,
  profileId: string, // backend username
  revision: number,
  message: string,
  criteria: string[],
  items: { contentId: string, score: number, reason?: string }[],
  catalog: BackendItem[]
}
```

`catalog` carries the exact backend items for the shared frontend adapter and
session-cached details. IDs serialize `[content_type, title, release_year or
air_date or match_date, channel, start_time or kickoff_cet]` as compact JSON.
Scores are reciprocal ranks, not probabilities. Revisions increase per session.
Failures emit `recommendations.error` with `sessionId`, `profileId` and `message`;
the previous board remains available.

## Backend integration boundary

Registered tools:

```text
recommend_titles(profile_id, session_preferences)
refine_recommendations(session_id, changes)
get_content_details(content_id)
```

The product backend remains authoritative for profiles and catalogue items.
`discover` calls `/api/content/preference`, `consensus` calls `/api/content/room`,
and `decide` calls `/api/content/decide`. Every request sends the active username
as `X-Profile-Id`; decide and the default room participant also send `user_id`.
Other room participants can have anonymous preferences, never invented usernames.
Decide supports history and content-type filtering; genre/runtime/mood constraints
require Discover. Refinements merge changed fields; explicit null clears a field.
No backend routes were added for catalogue or details.

Tool state is scoped to the running connection through a `ContextVar` and cleared
when the pipeline exits. Pausing and entering details keep this connection alive.
Refresh, disconnect or a new profile starts a new context.

## Checks

After compilation and dependency installation, from `voice-agent/` on Linux/macOS:

```sh
PYTHONPATH=build/pipecat .venv/bin/python -m unittest discover -s tests -v
.venv/bin/python -m ty check tools/recommendations.py runtime/compass_session.py scripts/patch_generated.py run.py
```

Live speech validation additionally requires configured SLNG and Nebius credentials,
the backend on port 8000 and the frontend on port 5173.

## Current limitations

- Cached details are lost when the session ends or the browser reloads.
- The browser and voice runtime run locally for the MVP.
- Titan OS device audio, permissions and lifecycle still require validation.
- Challenge latency and cost numbers have not yet been measured systematically;
  see the root `DEMO_GUIDE.md` for the measurement plan.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Microphone busy | Close duplicate Compass/Pipecat tabs and reconnect |
| Transcript but no audio | Check Windows/TV output device and browser volume |
| No connection | Confirm `dev.ps1` is running on port `7860` |
| SLNG message-rate error | Confirm generated `bot.py` imports `BatchedSlngSTTService` |
| Repeated long questions | Confirm the latest `instructions.md` was compiled |
| Provider authentication error | Check local `.env` values without printing them |

Keep only one active browser voice session during demos. An idle server can stay
running, but disconnect between rehearsals to avoid unnecessary SLNG usage.
