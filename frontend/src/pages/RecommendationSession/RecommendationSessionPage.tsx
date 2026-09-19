import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { VoiceSessionBackground } from '../../components/backgrounds/VoiceSessionBackground';
import { ContentCard } from '../../components/ContentCard';
import { focusManager } from '../../navigation/FocusManager';
import { contentService } from '../../services/content.service';
import { useProfileStore } from '../../store/profile.store';
import { useRecommendationStore } from '../../store/recommendation.store';
import type { RecommendationMode } from '../../types/content';
import { useVoiceAgent } from '../../voice/useVoiceAgent';

const validModes: RecommendationMode[] = ['discover', 'consensus', 'decide'];

type TranscriptRole = 'you' | 'compass';

interface TranscriptEntry {
  id: number;
  role: TranscriptRole;
  text: string;
}

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
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}`;
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get('mode') as RecommendationMode | null;
  const mode = validModes.includes(requestedMode ?? 'discover')
    ? (requestedMode ?? 'discover')
    : 'discover';

  const [isEnding, setIsEnding] = useState(false);
  const [transcriptHistory, setTranscriptHistory] = useState<TranscriptEntry[]>([]);
  const transcriptSequence = useRef(0);
  const lastObservedTranscript = useRef('');
  const shouldReduceMotion = useReducedMotion();
  const activeProfileId = useProfileStore((state) => state.activeProfile?.id);
  const phase = useRecommendationStore((state) => state.phase);
  const round = useRecommendationStore((state) => state.round);
  const contentIds = useRecommendationStore((state) => state.contentIds);
  const criteria = useRecommendationStore((state) => state.criteria);
  const agentMessage = useRecommendationStore((state) => state.agentMessage);
  const error = useRecommendationStore((state) => state.error);
  const focusedContentId = useRecommendationStore((state) => state.focusedContentId);
  const focusContent = useRecommendationStore((state) => state.focusContent);
  const { status, transcript, start, pause, resume, end } = useVoiceAgent();

  useEffect(() => {
    if (!activeProfileId) return;
    void start(mode, activeProfileId);
  }, [activeProfileId, mode, start]);

  const recommendations = useMemo(() =>
    contentIds.flatMap((id) => contentService.getById(id) ?? []).slice(0, 8), [contentIds]);

  const isPaused = phase === 'exploring';
  const isConversationScene = round === 0;
  const isUpdatingResults = !isPaused && status === 'processing';
  const auroraActive = isConversationScene && !isPaused && !isEnding;
  const orbStateLabel = status === 'disconnected'
    ? 'Disconnected'
    : status === 'speaking' ? 'Speaking' : status === 'processing' ? 'Thinking…' : 'Listening';

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

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (document.activeElement instanceof HTMLElement
        && document.activeElement.dataset.focusable === 'true') return;
      if (!focusManager.restore(routeKey)) focusManager.focusInitial();
    }, shouldReduceMotion ? 120 : 500);
    return () => window.clearTimeout(timeout);
  }, [contentIds, isConversationScene, routeKey, shouldReduceMotion]);

  const handlePause = async () => {
    await pause();
    window.setTimeout(() => {
      const candidates = [...document.querySelectorAll<HTMLElement>('.live-recommendation-grid [data-focusable="true"]')];
      (candidates.find((card) => card.dataset.focusKey === `content:${focusedContentId}`) ?? candidates[0])?.focus();
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
              className={`voice-session voice-session--conversation voice-session-state--${status === 'speaking' ? 'question' : status}`}
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
                  emptyMessage={orbStateLabel === 'Listening' ? 'Just talk it out…' : undefined}
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
                <AnimatePresence initial={false}>
                  {recommendations.map((content) => (
                    <motion.div
                      key={content.id}
                      layout={shouldReduceMotion ? false : 'position'}
                      className="live-recommendation-item"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
                    >
                      <ContentCard
                        content={content}
                        defaultFocus={isPaused && content.id === focusedContentId}
                        onFocus={() => focusContent(content.id)}
                        onOpen={() => {
                          focusContent(content.id);
                          void pause();
                        }}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {recommendations.length === 0 && <p>No matching titles. Try changing your preferences.</p>}
              </section>

              <aside className="conversation-rail" aria-live="polite">
                <p className="conversation-rail__instruction">
                  {agentMessage}
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
                    disabled={status === 'disconnected'}
                    onClick={() => void (isPaused ? handleResume() : handlePause())}
                    transition={{ type: 'spring', stiffness: 170, damping: 23 }}
                  >
                    {isPaused ? 'Resume' : 'Pause'}
                  </motion.button>
                </div>

                <p className="conversation-rail__instruction">
                  {criteria.join(' · ') || 'Keep talking to refine your recommendations.'}
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

        {error && <p className="session-error" role="alert">{error}</p>}
        {!isConversationScene && (
          <button className="session-end" data-focusable="true" onClick={() => void handleStopConversation()}>
            End conversation
          </button>
        )}
      </div>
    </LayoutGroup>
  );
}
