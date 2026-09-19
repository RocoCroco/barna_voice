# Compass

Compass is a voice-first movie and series discovery experience designed for the
living-room TV. Instead of opening a catalogue and scrolling indefinitely, the
viewer describes the mood, occasion and constraints out loud. Compass holds a
short conversation and will progressively turn that context into a small,
understandable set of recommendations.

This repository contains the TV frontend and the independently deployable voice
agent. The product backend is intentionally outside the current implementation
and will later provide profiles, catalogue availability and recommendation data.

## Current status

| Area | Status | Notes |
| --- | --- | --- |
| TV interface | Working MVP | Browser simulation of the Titan OS experience |
| Remote navigation | Working | Directional focus, OK, Back and voice shortcut |
| Profile selection | Simulated | Service boundary is ready for the backend |
| Voice conversation | Working | Real microphone, STT, LLM, TTS and speaker output |
| Recommendation UI | Working simulation | Mock catalogue and animated refinement rounds |
| Voice-driven recommendations | Pending backend | Agent tools and recommendation events are the next integration |
| Titan OS device validation | Pending | The browser currently simulates the TV environment |

## Architecture

```text
┌────────────────────────── TV / browser ──────────────────────────┐
│ React + TypeScript                                               │
│                                                                  │
│ Profile / Home / Recommendation UI     Pipecat JS client         │
│ TV focus + remote navigation            SmallWebRTC transport     │
└─────────────────────┬──────────────────────────┬─────────────────┘
                      │ future HTTP API          │ WebRTC audio/data
                      ▼                          ▼
              ┌───────────────┐       ┌────────────────────────────┐
              │ Product       │◄──────│ Voice agent                │
              │ backend       │ tools │ Unmute definition          │
              │               │       │ compiled to Pipecat        │
              │ profiles      │       └─────────────┬──────────────┘
              │ catalogue     │                     │
              │ recommendations│       ┌────────────┴─────────────┐
              └───────────────┘        │ SLNG STT → Nebius LLM   │
                                       │          → SLNG TTS       │
                                       └──────────────────────────┘
```

The browser never receives provider secrets. It starts a voice session against
the local agent and exchanges microphone and speaker tracks over WebRTC. The
agent owns provider credentials and is the only layer that calls SLNG and
Nebius.

## Technologies and responsibilities

| Technology | Where | Responsibility |
| --- | --- | --- |
| React + TypeScript + Vite | `frontend/` | TV interface and application flow |
| Zustand | `frontend/src/store/` | Profile, voice and recommendation state |
| Motion for React | Frontend | Shared-layout and staggered recommendation animations |
| Pipecat client + SmallWebRTC | Frontend | Real-time microphone, remote audio and agent events |
| Unmute | `voice-agent/` | Declarative agent definition and Pipecat compilation |
| Pipecat | Generated runtime | Real-time voice pipeline and WebRTC server |
| SLNG | Voice runtime | Speech-to-text and text-to-speech execution |
| Nebius Token Factory | Voice runtime | Conversational reasoning model |
| Silero | Voice runtime | Local voice activity and turn detection |

## Hackathon challenge strategy

### Titan OS: TV-first experience

Compass is designed as a ten-foot interface rather than a desktop application:

- every important action is reachable with directional focus and OK/Back;
- focus states are high-contrast and use the Compass cyan brand colour;
- the primary Home action is voice, reducing remote-control typing;
- the conversation has explicit listening, thinking, speaking, paused and
  recommendation states;
- recommendations arrive progressively and can be frozen for calm exploration;
- Titan-specific APIs will remain behind `frontend/src/platform/` so browser
  simulation and device runtime can share the product code.

The current limitation is explicit: it has not yet been validated on a Titan OS
television. The browser build simulates screen proportions, remote navigation
and interaction flow until device access is available.

### Best use of the SLNG platform

SLNG is in the critical audio path, not an optional add-on:

```text
viewer speech
  → SLNG deepgram/nova:3 speech-to-text
  → Nebius conversational reasoning
  → SLNG deepgram/aura:2 text-to-speech
  → TV speakers
```

The agent uses the EU-West SLNG route. A small repository-owned adapter batches
adjacent twenty-millisecond WebRTC frames, reducing approximately three thousand
WebSocket audio messages per minute to approximately fifteen hundred. This stays
below the observed two-thousand-message-per-minute bridge limit while adding at
most one input-frame interval of buffering.

### Unmute bonus

`voice-agent/agent.yaml` and `voice-agent/instructions.md` are the source of
truth. Unmute validates this portable definition and compiles it into a Pipecat
runtime that the team owns and can run locally. Provider and model choices stay
declarative instead of being embedded throughout application code.

### Build, adapt and ship with Nebius Token Factory

Nebius Token Factory provides the LLM for every conversational turn. The current
model is `Qwen/Qwen3-30B-A3B-Instruct-2507`, accessed through Nebius' OpenAI-
compatible endpoint. It interprets viewing intent, decides which clarification
is valuable and produces concise spoken responses. Once the backend is ready,
the same model will invoke catalogue and recommendation tools using the active
`profileId`.

This is a meaningful dependency: replacing or removing Nebius removes the
reasoning layer of the live agent rather than a peripheral feature.

## Run locally

### 1. Configure the voice agent

Copy the example and add local credentials. Never commit or expose these values
through a Vite variable.

```powershell
Copy-Item voice-agent\.env.example voice-agent\.env
```

Required variables:

- `SLNG_API_KEY`
- `NEBIUS_API_KEY`
- `NEBIUS_BASE_URL`

### 2. Start the voice runtime

```powershell
.\voice-agent\scripts\dev.ps1
```

The agent listens on `http://localhost:7860`. Leave it running while using the
Compass frontend. An idle server does not hold an active conversation; disconnect
voice sessions after testing to conserve SLNG credit.

### 3. Start the frontend

```powershell
cd frontend
pnpm install
pnpm dev
```

Open `http://localhost:5173`. Allow microphone access when prompted.

### TV controls

- Arrow keys: move focus.
- `Enter`: select.
- `Escape` or browser Back: return.
- `V`: activate the current voice control.
- `1`–`5` on the recommendation route: temporary visual-state demo controls.

## Documentation

- [Frontend architecture](./FRONTEND.md)
- [Product flow and voice UX](./PRODUCT_FLOW.md)
- [Voice-agent architecture](./voice-agent/README.md)
- [Challenge demo guide](./DEMO_GUIDE.md)

## Next backend integration

The frontend and voice layers are ready to receive a backend contract for:

1. `GET /profiles` and active-profile selection;
2. catalogue search constrained by real availability;
3. recommendation and refinement tools called by the voice agent;
4. structured events that update the visible grid without ending the voice
   session;
5. content detail and playback/deep-link actions.

Until that contract exists, profiles, catalogue content and recommendation
rounds remain deliberately labelled simulations.
