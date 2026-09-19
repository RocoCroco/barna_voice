import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { VoiceSessionBackground } from '../../components/backgrounds/VoiceSessionBackground';
import { ContentCard } from '../../components/ContentCard';
import { focusManager } from '../../navigation/FocusManager';
import { contentService } from '../../services/content.service';
import { useProfileStore } from '../../store/profile.store';
import { useRecommendationStore } from '../../store/recommendation.store';
import type { RecommendationMode } from '../../types/content';
import { useVoiceAgent } from '../../voice/useVoiceAgent';

const validModes: RecommendationMode[] = ['discover', 'consensus', 'decide'];

type DemoState = 'listening' | 'transcript' | 'question' | 'processing' | 'recommendations';
type TranscriptRole = 'you' | 'compass';

interface TranscriptEntry {
  id: number;
  role: TranscriptRole;
  text: string;
}

const stateCopy: Record<Exclude<DemoState, 'recommendations'>, {
  caption: string;
}> = {
  listening: {
    caption: 'Just talk it out…',
  },
  transcript: {
    caption: 'Something clever and exciting, but not too intense.',
  },
  question: {
    caption: 'Are you watching alone or with someone tonight?',
  },
  processing: {
    caption: 'Shaping recommendations from what you said…',
  },
};

const nonTranscriptMessages = new Set([
  'just talk it out…',
  'compass is thinking…',
  'connecting to compass…',
  'shaping recommendations from what you said…',
  'conversation paused. explore these options with your remote.',
  'i am listening. what would you like to change?',
]);

function TranscriptTrail({
  entries,
  placement,
  reduceMotion,
  emptyMessage,
}: {
  entries: TranscriptEntry[];
  placement: 'conversation' | 'results';
  reduceMotion: boolean;
  emptyMessage?: string;
}) {
  const visibleEntries = entries.slice(-3).reverse();

  return (
    <div
      className={`transcript-trail transcript-trail--${placement}`}
      aria-live="polite"
      aria-label="Conversation transcript"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {visibleEntries.map((entry, index) => (
          <motion.div
            layout={reduceMotion ? false : 'position'}
            key={entry.id}
            className="transcript-trail__entry"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -18, scale: 1.04 }}
            animate={{
              opacity: 1 - index * 0.31,
              scale: 1 - index * 0.1,
            }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.76 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.36, ease: [0.22, 1, 0.36, 1] }}
          >
            <span>{entry.role === 'you' ? 'You' : 'Compass'}</span>
            <p>{entry.text}</p>
          </motion.div>
        ))}
      </AnimatePresence>
      {visibleEntries.length === 0 && emptyMessage && (
        <p className="transcript-trail__empty">{emptyMessage}</p>
      )}
    </div>
  );
}

export function RecommendationSessionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get('mode') as RecommendationMode | null;
  const mode = validModes.includes(requestedMode ?? 'discover')
    ? (requestedMode ?? 'discover')
    : 'discover';

  const [demoState, setDemoState] = useState<DemoState>('listening');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdatingResults, setIsUpdatingResults] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [transcriptHistory, setTranscriptHistory] = useState<TranscriptEntry[]>([]);
  const transcriptSequence = useRef(0);
  const lastObservedTranscript = useRef('');
  const shouldReduceMotion = useReducedMotion();
  const activeProfileId = useProfileStore((state) => state.activeProfile?.id);
  const phase = useRecommendationStore((state) => state.phase);
  const round = useRecommendationStore((state) => state.round);
  const contentIds = useRecommendationStore((state) => state.contentIds);
  const { status, transcript, start, simulateTurn, pause, resume, end } = useVoiceAgent();

  useEffect(() => {
    if (!activeProfileId) return;
    setDemoState('listening');
    void start(mode, activeProfileId);
  }, [activeProfileId, mode, start]);

  const recommendations = useMemo(() => {
    const recommendedOrder = new Map(contentIds.map((id, index) => [id, index]));

    return [...contentService.getAll()]
      .sort((first, second) => {
        const firstPosition = recommendedOrder.get(first.id) ?? Number.MAX_SAFE_INTEGER;
        const secondPosition = recommendedOrder.get(second.id) ?? Number.MAX_SAFE_INTEGER;
        return firstPosition - secondPosition;
      })
      .slice(0, 8);
  }, [contentIds]);

  const isPaused = phase === 'exploring';
  const isConversationScene = demoState !== 'recommendations';
  const auroraActive = isConversationScene && !isPaused && !isEnding;
  const orbStateLabel = demoState === 'processing'
    ? 'Thinking…'
    : demoState === 'question'
      ? 'Speaking'
      : demoState === 'transcript'
        ? 'Listening'
        : status === 'speaking'
          ? 'Speaking'
          : status === 'processing'
            ? 'Thinking…'
            : 'Listening';

  const addTranscript = useCallback((role: TranscriptRole, value: string) => {
    const text = value.trim();
    if (!text || nonTranscriptMessages.has(text.toLowerCase())) return;

    setTranscriptHistory((entries) => {
      const previous = entries.at(-1);
      if (previous?.role === role) {
        const nextText = role === 'you'
          ? text
          : text.startsWith(previous.text)
            ? text
            : previous.text.includes(text)
              ? previous.text
              : `${previous.text} ${text}`;

        if (nextText === previous.text) return entries;
        return [...entries.slice(0, -1), { ...previous, text: nextText }];
      }

      transcriptSequence.current += 1;
      return [
        ...entries,
        { id: transcriptSequence.current, role, text },
      ].slice(-5);
    });
  }, []);

  useEffect(() => {
    if (transcript === lastObservedTranscript.current) return;
    lastObservedTranscript.current = transcript;
    addTranscript(status === 'speaking' ? 'compass' : 'you', transcript);
  }, [addTranscript, status, transcript]);

  const showRecommendations = useCallback(async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setDemoState('processing');
    await simulateTurn();
    setDemoState('recommendations');
    setIsGenerating(false);
    window.setTimeout(() => focusManager.focusInitial(), 120);
  }, [isGenerating, simulateTurn]);

  const updateRecommendations = useCallback(async () => {
    if (isGenerating || isUpdatingResults || isPaused || demoState !== 'recommendations') {
      return;
    }

    setIsUpdatingResults(true);
    await simulateTurn();
    setIsUpdatingResults(false);
  }, [demoState, isGenerating, isPaused, isUpdatingResults, simulateTurn]);

  const selectDemoState = useCallback((nextState: DemoState) => {
    if (nextState === 'recommendations') {
      void showRecommendations();
      return;
    }

    if (nextState === 'transcript') {
      addTranscript('you', stateCopy.transcript.caption);
    } else if (nextState === 'question') {
      addTranscript('compass', stateCopy.question.caption);
    }

    setDemoState(nextState);
    window.setTimeout(() => focusManager.focusInitial(), 60);
  }, [addTranscript, showRecommendations]);

  useEffect(() => {
    const handleDemoShortcut = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const shortcutStates: Partial<Record<string, DemoState>> = {
        '1': 'listening',
        '2': 'transcript',
        '3': 'question',
        '4': 'recommendations',
      };

      if (event.key === '5') {
        event.preventDefault();
        void updateRecommendations();
        return;
      }

      const nextState = shortcutStates[event.key];
      if (!nextState) return;

      event.preventDefault();
      selectDemoState(nextState);
    };

    window.addEventListener('keydown', handleDemoShortcut);
    return () => window.removeEventListener('keydown', handleDemoShortcut);
  }, [selectDemoState, updateRecommendations]);

  const handlePause = async () => {
    await pause();
    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>('.live-recommendation-grid [data-focusable="true"]')
        ?.focus();
    }, 80);
  };

  const handleResume = async () => {
    await resume();
    window.setTimeout(() => {
      document.querySelector<HTMLElement>('.conversation-control')?.focus();
    }, 80);
  };

  const handleStopConversation = async () => {
    if (isEnding) return;
    setIsEnding(true);
    await end();
    navigate('/', { replace: true, viewTransition: true });
  };

  const sceneMotion = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.985 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 1.015 },
      };

  return (
    <LayoutGroup id="voice-session">
      <div className={`voice-session-frame ${isEnding ? 'voice-session-frame--ending' : ''}`}>
        <VoiceSessionBackground
          auroraActive={auroraActive}
          reduceMotion={Boolean(shouldReduceMotion)}
        />
        <img className="voice-session__logo" src="/brand/logo.svg" alt="Compass" />

        <AnimatePresence initial={false} mode="sync">
          {isConversationScene ? (
            <motion.div
              key="conversation"
              className={`voice-session voice-session--conversation voice-session-state--${demoState}`}
              {...sceneMotion}
              transition={{ duration: shouldReduceMotion ? 0.01 : 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="listening-ambient" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>

              <section className="listening-stage" aria-live="polite">
                <div className="listening-stage__orb-wrap">
                  <div
                    className="listening-stage__compass-orbit"
                    aria-hidden="true"
                  >
                    <img className="listening-stage__compass" src="/brand/icon.svg" alt="" />
                  </div>

                  <div className="orb-pulse-rings" aria-hidden="true">
                    <span />
                    <span />
                  </div>

                  <motion.button
                    layoutId="conversation-orb"
                    type="button"
                    className="session-orb listening-stage__orb"
                    data-focusable="true"
                    data-focus-default="true"
                    data-voice-trigger="true"
                    disabled={isEnding}
                    onClick={() => void handleStopConversation()}
                    aria-label="Stop the conversation and return home"
                    transition={{ type: 'spring', stiffness: 170, damping: 23 }}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={orbStateLabel}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                      >
                        {orbStateLabel}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>
                </div>

                <TranscriptTrail
                  entries={transcriptHistory}
                  placement="conversation"
                  reduceMotion={Boolean(shouldReduceMotion)}
                  emptyMessage={orbStateLabel === 'Listening' ? stateCopy.listening.caption : undefined}
                />
                <span className="sr-only">{transcript}</span>
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="recommendations"
              className={`voice-session voice-session--results ${isPaused ? 'voice-session--paused' : ''}`}
              aria-busy={isUpdatingResults}
              {...sceneMotion}
              transition={{ duration: shouldReduceMotion ? 0.01 : 0.48, ease: [0.22, 1, 0.36, 1] }}
            >
              <section className="live-recommendation-grid" aria-label="Live recommendations">
                {recommendations.map((content, index) => (
                  <div
                    key={content.id}
                    className={`live-recommendation-item live-recommendation-item--${round % 2 === 0 ? 'even' : 'odd'}`}
                    style={{ animationDelay: `${80 + index * 75}ms` }}
                  >
                    <ContentCard
                      content={content}
                      defaultFocus={isPaused && index === 0}
                    />
                  </div>
                ))}
              </section>

              <aside className="conversation-rail" aria-live="polite">
                <p className="conversation-rail__instruction">
                  Tell me to stop or<br />pause to check the<br />recommendations
                </p>

                <div className="conversation-rail__control">
                  <motion.img
                    className="conversation-rail__pointer"
                    src="/brand/icon.svg"
                    alt=""
                    animate={shouldReduceMotion ? undefined : { x: [0, -7, 0], rotate: [-90, -94, -90] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.button
                    layoutId="conversation-orb"
                    type="button"
                    className="session-orb conversation-control"
                    data-focusable="true"
                    data-focus-default={isPaused ? undefined : 'true'}
                    data-voice-trigger="true"
                    disabled={isUpdatingResults}
                    onClick={() => void (isPaused ? handleResume() : handlePause())}
                    transition={{ type: 'spring', stiffness: 170, damping: 23 }}
                  >
                    {isUpdatingResults ? 'Refining…' : isPaused ? 'Resume' : 'Pause'}
                  </motion.button>
                </div>

                <p className="conversation-rail__instruction">
                  Keep talking to<br />refine the<br />recommendations
                </p>
                <span className="sr-only">{transcript}</span>
              </aside>

              <TranscriptTrail
                entries={transcriptHistory}
                placement="results"
                reduceMotion={Boolean(shouldReduceMotion)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="voice-demo-shortcuts" aria-label="Demo state shortcuts">
          <span>Demo</span>
          <span><kbd>1</kbd> Listen</span>
          <span><kbd>2</kbd> Transcript</span>
          <span><kbd>3</kbd> Question</span>
          <span><kbd>4</kbd> Results</span>
          <span><kbd>5</kbd> Refine</span>
        </div>
      </div>
    </LayoutGroup>
  );
}
