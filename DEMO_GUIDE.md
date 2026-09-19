# Compass challenge demo guide

This document is the shared runbook for recording or presenting Compass. It
separates what works today from the backend-dependent product vision so every
challenge submission remains accurate.

## One-sentence pitch

Compass turns the exhausting search for something to watch into a short spoken
conversation whose recommendations evolve live on the television.

## What is live today

- TV-first React interface and remote-style spatial navigation.
- Real browser microphone and speaker audio over WebRTC.
- SLNG speech-to-text and text-to-speech.
- Nebius Token Factory conversational reasoning.
- Unmute agent definition compiled into a self-hosted Pipecat runtime.
- Animated recommendation and refinement experience using clearly labelled mock
  catalogue data.

## What is simulated today

- Profile records.
- Catalogue availability.
- Recommendation ranking and refinement rounds.
- The structured event connecting an agent decision to the visible grid.

Do not imply that the spoken agent currently queries a real catalogue. Say that
the voice and visual flows are working independently and the typed backend tool
contract is the next integration.

## Recommended ninety-second demo

1. **TV context — 10 seconds.** Select a profile with the arrow keys and show
   that every action has a visible cyan focus state.
2. **Voice-first Home — 10 seconds.** Show `Press to talk`, then move down once
   to reveal `Room consensus`, `Decide for me` and the traditional row.
3. **Live voice — 35 seconds.** Start Compass and say:
   “We want something funny and adventurous, under two hours.”
   Answer one concise follow-up. Point out the live transcript and audible reply.
4. **Recommendation choreography — 20 seconds.** Use the temporary demo state to
   show recommendations arriving at slightly different times, then refine them
   and show stable cards moving rather than the whole screen refreshing.
5. **TV control — 10 seconds.** Pause on the small orb, navigate the cards, then
   resume. Explain that the large orb ends a pre-result conversation.
6. **Architecture — 5 seconds.** Finish on the pipeline:
   `SLNG STT → Nebius → SLNG TTS`, defined by Unmute and connected over WebRTC.

## Challenge-specific talking points

### Titan OS

- Compass addresses a TV-specific problem: typing and browsing fatigue.
- Interaction is designed for a directional remote and viewing distance.
- Focus restoration, limited visible choices and explicit listening state reduce
  uncertainty in a shared living room.
- Current device limitation: Titan OS is simulated in the browser and still
  requires on-device validation.

### SLNG

- SLNG handles both directions of the live audio path.
- STT uses `deepgram/nova:3`; TTS uses `deepgram/aura:2` with the Thalia voice.
- Removing SLNG breaks the working conversation, which demonstrates core usage.
- The team diagnosed and fixed an observed bridge message-rate limit by batching
  two adjacent WebRTC audio frames.

### Unmute

- `agent.yaml` declares think, listen, speak, region, tools and capacity.
- `instructions.md` owns voice behaviour independently of frontend code.
- Unmute validates and compiles the definition to a Pipecat runtime we can run
  locally and later deploy elsewhere.

### Nebius Token Factory

- Nebius runs the reasoning step for every live conversational turn.
- The model interprets mood and constraints and decides whether a clarification
  materially improves the result.
- The prompt caps normal replies at twenty-five words and clarification at two
  questions, reducing latency and unnecessary LLM/TTS usage.
- Future catalogue tools will keep Nebius at the centre of recommendation and
  refinement rather than adding a disconnected sponsor call.

## Start-up checklist

```powershell
# Terminal 1, repository root
.\voice-agent\scripts\dev.ps1

# Terminal 2
cd frontend
pnpm dev
```

Before presenting:

- confirm the correct Windows/TV speaker output;
- close Pipecat Playground and duplicate Compass tabs so only one owns the mic;
- allow microphone permission;
- disconnect between rehearsals to conserve SLNG credit;
- keep the voice agent terminal visible off-screen for troubleshooting;
- use English with the agent during the MVP demo.

## Evidence to capture for submissions

Record or screenshot:

- `agent.yaml` showing SLNG listen/speak and Nebius think models;
- the Unmute validation/compile output;
- the live transcript and audible bot response;
- the TV focus system and pause/resume flow;
- provider dashboards showing calls and usage, with keys and account identifiers
  hidden;
- a short architecture slide using the diagram from the root README.

## Metrics plan

Do not present sponsor marketing numbers as Compass measurements. Record our own
values from repeatable sessions and replace `TBD` before submission.

| Metric | Definition | Current value |
| --- | --- | --- |
| End-of-speech to final transcript | User stops → SLNG final STT event | TBD |
| LLM time to first token | Final transcript → first Nebius token | TBD |
| TTS time to first audio | Text ready → first SLNG audio frame | TBD |
| Full turn latency | User stops → first audible response | TBD |
| Successful turns | Completed turns / attempted turns | TBD |
| Cost per demo session | SLNG + Nebius provider usage | TBD |

Run at least ten scripted turns on the same connection and report median and
p95 where possible. Note browser, network region, model and date alongside the
results.

## Expected demo language

Useful honest phrasing:

> “The audio conversation is live. The catalogue is mocked until our backend
> contract lands; this animation shows exactly how structured recommendation
> updates will appear without interrupting the voice session.”

Avoid saying that a mock title was selected by Nebius or is available on a real
streaming provider.
