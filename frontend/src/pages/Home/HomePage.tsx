import { useEffect, useState } from 'react';
import { ArrowRight, ChevronsDown, Mic, Sparkles, UsersRound } from 'lucide-react';
import { ContentCard } from '../../components/ContentCard';
import { TVLink } from '../../components/TVLink';
import { contentService } from '../../services/content.service';
import { useProfileStore } from '../../store/profile.store';
import type { Content } from '../../types/content';

export function HomePage() {
  const [featured, setFeatured] = useState<Content[]>([]);
  const [catalogueError, setCatalogueError] = useState('');
  const profileId = useProfileStore((state) => state.activeProfile?.id);
  const [activeScene, setActiveScene] = useState<'hero' | 'browse'>('hero');

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    contentService.setScope(`home:${profileId}`);
    setCatalogueError('');
    setFeatured([]);
    void contentService.getFeatured(profileId).then((items) => {
      if (!cancelled) setFeatured(items);
    }).catch(() => {
      if (!cancelled) setCatalogueError('Could not load the catalogue. Please try again later.');
    });
    return () => { cancelled = true; };
  }, [profileId]);

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
              <strong>Sofa consensus</strong>
              <small>One answer each. Compass finds your common ground.</small>
            </span>
            <span className="mode-card__arrow" aria-hidden="true">
              <ArrowRight />
            </span>
          </TVLink>

          <TVLink
            to="/recommendations?mode=decide"
            className="mode-card mode-card--decide"
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
              <strong>Pick for me</strong>
              <small>One surprise movie. No questions.</small>
            </span>
            <span className="mode-card__arrow" aria-hidden="true">
              <ArrowRight />
            </span>
          </TVLink>
        </div>

        <section className="home-recommendations" aria-labelledby="tonight-title">
          <div className="section-heading">
            <h2 id="tonight-title">Ideas for tonight</h2>
          </div>
          <div className="content-row">
            {featured.map((content) => (
              <ContentCard key={content.id} content={content} />
            ))}
          </div>
          {catalogueError && <p role="alert">{catalogueError}</p>}
        </section>
      </section>
      </div>
    </div>
  );
}
