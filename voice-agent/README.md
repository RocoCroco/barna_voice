# Compass voice agent

`voice-agent/` is the independent real-time conversation layer for Compass. It
does not own user data, profiles or catalogue records. Its role is to listen,
reason, speak and, once the product backend is available, call typed tools that
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

Catalogue lookup and structured recommendation tools are intentionally pending.
The agent may discuss well-known titles, but its prompt forbids inventing
availability, prices or personal history.

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

When backend tools arrive, Nebius will remain the orchestrating intelligence. It
will turn the conversation into structured calls rather than being included as
an unrelated sponsor integration.

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
│   └── end_call.yaml          # explicit conversational end tool
├── runtime/
│   └── slng_stt_batched.py    # SLNG audio-message batching adapter
├── scripts/
│   ├── common.ps1             # safe local environment loading
│   ├── dev.ps1                # compile, patch dependencies and start
│   ├── patch-generated.ps1    # installs the batching adapter after compile
│   ├── validate.ps1           # validate and compile
│   ├── list-nebius-models.ps1 # read-only model availability check
│   └── test-nebius.ps1        # minimal LLM connectivity test
├── .env.example               # variable names only
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
```

Rules:

- never commit `voice-agent/.env`;
- never expose either key through a `VITE_*` frontend variable;
- do not paste secrets into screenshots, logs or challenge material;
- the frontend connects only to the agent endpoint.

## Validate and run

The helper scripts expect repository-local Unmute and uv executables under
`.tools/`. They are already prepared in the development workspace and ignored by
Git.

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

The runtime listens on `http://localhost:7860`. The Pipecat playground remains
available at `/client/` for low-level diagnostics, but the Compass frontend is
the product client.

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

The next contract should add a structured `recommendations.updated` event rather
than parsing spoken text. That event will carry content IDs, criteria, scores and
optional reasons while the WebRTC conversation remains open.

## Backend integration boundary

The agent will eventually receive tools similar to:

```text
get_profile_context(profile_id)
search_catalogue(profile_id, constraints)
recommend_titles(profile_id, session_preferences)
refine_recommendations(session_id, changes)
get_content_details(content_id)
```

The product backend remains authoritative for profiles, catalogue availability
and recommendation records. The agent should send structured intent and narrate
results, not duplicate backend data ownership.

## Current limitations

- No real catalogue or profile API is connected.
- Recommendation cards are not yet triggered by agent tool output.
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
