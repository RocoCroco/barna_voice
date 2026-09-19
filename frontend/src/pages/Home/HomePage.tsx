import { useEffect, useState } from 'react';
import { ArrowRight, ChevronsDown, Mic, Sparkles, UsersRound } from 'lucide-react';
import { ContentCard } from '../../components/ContentCard';
import { TVLink } from '../../components/TVLink';
import { contentService } from '../../services/content.service';
import { voiceProvider } from '../../voice/VoiceProvider';

export function HomePage() {
  const featured = contentService.getFeatured();
  const [activeScene, setActiveScene] = useState<'hero' | 'browse'>('hero');

  useEffect(() => {
    if (voiceProvider.isConnected()) void voiceProvider.disconnect();
  }, []);

  const lockSpatialNavigation = () => {
    document.body.dataset.tvNavigationLocked = 'true';
    window.setTimeout(() => {
      delete document.body.dataset.tvNavigationLocked;
    }, 760);
  };

  const showOptions = () => {
    const optionsPanel = document.getElementById('home-options');
    const firstOption = optionsPanel?.querySelector<HTMLElement>('[data-focusable="true"]');
    lockSpatialNavigation();
    setActiveScene('browse');
    window.setTimeout(() => firstOption?.focus({ preventScroll: true }), 620);
  };

  const showHero = () => {
    const voiceButton = document.querySelector<HTMLElement>('.voice-circle');
    lockSpatialNavigation();
    setActiveScene('hero');
    window.setTimeout(() => voiceButton?.focus({ preventScroll: true }), 620);
  };

  return (
    <div className={`page home-page home-page--${activeScene}`}>
      <div className="home-scenes">
      <section className="home-stage" aria-labelledby="hero-title">
        <img className="home-stage__logo" src="/brand/logo.svg" alt="Compass" />
        <div className="home-stage__question">
          <h1 id="hero-title">What do you<br />want to watch?</h1>
        </div>
        <div className="home-stage__voice">
          <TVLink
            to="/recommendations?mode=discover"
            className="voice-circle"
            defaultFocus
            voiceTrigger
            onClick={() => void voiceProvider.connect()}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                event.stopPropagation();
                showOptions();
              }
            }}
          >
            <Mic aria-hidden="true" />
            <span>Press to talk</span>
          </TVLink>
        </div>
        <div className="browse-cue" aria-hidden="true">
          <span>Browse more</span>
          <ChevronsDown className="browse-cue__chevron" />
        </div>
      </section>

      <section id="home-options" className="home-options" aria-labelledby="modes-title">
        <div className="section-heading">
          <h2 id="modes-title">Choose how you want to decide</h2>
        </div>

        <div className="mode-grid">
          <TVLink
            to="/recommendations?mode=consensus"
            className="mode-card mode-card--consensus"
            onClick={() => void voiceProvider.connect()}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                event.stopPropagation();
                showHero();
              }
            }}
          >
            <span className="mode-card__icon" aria-hidden="true">
              <UsersRound />
            </span>
            <span>
              <strong>Room consensus</strong>
              <small>Everyone speaks. Compass finds the common ground.</small>
            </span>
            <span className="mode-card__arrow" aria-hidden="true">
              <ArrowRight />
            </span>
          </TVLink>

          <TVLink
            to="/recommendations?mode=decide"
            className="mode-card mode-card--decide"
            onClick={() => void voiceProvider.connect()}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                event.stopPropagation();
                showHero();
              }
            }}
          >
            <span className="mode-card__icon" aria-hidden="true">
              <Sparkles />
            </span>
            <span>
              <strong>Decide for me</strong>
              <small>A few questions. One confident choice.</small>
            </span>
            <span className="mode-card__arrow" aria-hidden="true">
              <ArrowRight />
            </span>
          </TVLink>
        </div>

        <section className="home-recommendations" aria-labelledby="tonight-title">
          <div className="section-heading">
            <h2 id="tonight-title">Ideas for tonight</h2>
            <TVLink to="/search" className="text-link">
              See everything <ArrowRight aria-hidden="true" />
            </TVLink>
          </div>
          <div className="content-row">
            {featured.map((content) => (
              <ContentCard key={content.id} content={content} />
            ))}
          </div>
        </section>
      </section>
      </div>
    </div>
  );
}
