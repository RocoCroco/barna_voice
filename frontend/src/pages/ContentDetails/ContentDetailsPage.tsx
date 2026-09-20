import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ContentCard } from '../../components/ContentCard';
import { TVButton } from '../../components/TVButton';
import { contentService } from '../../services/content.service';
import { useRecommendationStore } from '../../store/recommendation.store';
import { useVoiceAgent } from '../../voice/useVoiceAgent';
import { voiceProvider } from '../../voice/VoiceProvider';

export function ContentDetailsPage() {
  const { contentId = '' } = useParams();
  const navigate = useNavigate();
  const sessionId = useRecommendationStore((state) => state.sessionId);
  const mode = useRecommendationStore((state) => state.mode);
  const selectedContentId = useRecommendationStore((state) => state.selectedContentId);
  const selectContent = useRecommendationStore((state) => state.selectContent);
  const { pause } = useVoiceAgent();
  const content = contentService.getById(contentId);
  const backToShortlist = () => {
    if (sessionId) navigate(`/recommendations?mode=${mode}`, { replace: true });
    else navigate(-1);
  };

  useEffect(() => {
    if (sessionId && voiceProvider.isListening()) void pause();
  }, [sessionId, pause]);

  if (!content) {
    return (
      <div className="page empty-page">
        <span className="eyebrow">Not found</span>
        <h1>This title is no longer in this session.</h1>
        <TVButton defaultFocus variant="primary" onClick={backToShortlist}>
          Go back
        </TVButton>
      </div>
    );
  }

  const related = contentService
    .getAll()
    .filter((item) => item.id !== content.id)
    .slice(0, 4);

  return (
    <div className={`page details-page theme-${content.theme}`}>
      <section className="details-hero">
        <div className="details-hero__glow" aria-hidden="true" />
        <div className="details-hero__content">
          <span className="eyebrow">
            {content.kind === 'movie' ? 'Movie' : content.kind === 'sport' ? 'Sport' : 'TV show'}
          </span>
          <h1>{content.title}</h1>
          <p className="details-meta">
            {content.year ?? 'Year unknown'} · {content.duration} · {content.maturityRating} ·{' '}
            {content.genres.join(' / ')}
          </p>
          <p className="details-synopsis">{content.synopsis}</p>
          <div className="why-this">
            <span>Why it fits</span>
            <p>{content.recommendationReason}</p>
          </div>
          <div className="details-actions">
            <TVButton
              defaultFocus
              variant="primary"
              onClick={() => selectContent(content.id)}
            >
              Choose this
            </TVButton>
            <TVButton variant="ghost" onClick={backToShortlist}>
              Back to shortlist
            </TVButton>
          </div>
          <p className="selection-message" aria-live="polite">
            {selectedContentId === content.id ? 'Selected. Playback integration comes next.' : ''}
          </p>
        </div>
        <div
          className={`details-hero__art ${content.posterUrl ? 'details-hero__art--image' : ''}`}
          style={content.posterUrl ? { backgroundImage: `url("${content.posterUrl}")` } : undefined}
          aria-hidden="true"
        >
          {!content.posterUrl && content.title.slice(0, 1)}
        </div>
      </section>

      <section className="content-section" aria-labelledby="related-title">
        <div className="section-heading">
          <h2 id="related-title">Other session picks</h2>
        </div>
        <div className="content-row">
          {related.map((item) => <ContentCard key={item.id} content={item} />)}
        </div>
      </section>
    </div>
  );
}
