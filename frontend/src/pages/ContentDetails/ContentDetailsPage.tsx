import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ContentCard } from '../../components/ContentCard';
import { TVButton } from '../../components/TVButton';
import { contentService } from '../../services/content.service';

export function ContentDetailsPage() {
  const { contentId = '' } = useParams();
  const navigate = useNavigate();
  const [selectionMessage, setSelectionMessage] = useState('');
  const content = contentService.getById(contentId);

  if (!content) {
    return (
      <div className="page empty-page">
        <span className="eyebrow">Not found</span>
        <h1>This title is not available.</h1>
        <TVButton defaultFocus variant="primary" onClick={() => navigate(-1)}>
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
          <span className="eyebrow">{content.kind === 'movie' ? 'Movie' : 'Series'}</span>
          <h1>{content.title}</h1>
          <p className="details-meta">
            {content.year} · {content.duration} · {content.maturityRating} ·{' '}
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
              onClick={() => setSelectionMessage('Selected. Playback integration comes next.')}
            >
              Choose this
            </TVButton>
            <TVButton variant="ghost" onClick={() => navigate(-1)}>
              Back to shortlist
            </TVButton>
          </div>
          <p className="selection-message" aria-live="polite">{selectionMessage}</p>
        </div>
        <div className="details-hero__art" aria-hidden="true">
          {content.title.slice(0, 1)}
        </div>
      </section>

      <section className="content-section" aria-labelledby="related-title">
        <div className="section-heading">
          <h2 id="related-title">More like this</h2>
        </div>
        <div className="content-row">
          {related.map((item) => <ContentCard key={item.id} content={item} />)}
        </div>
      </section>
    </div>
  );
}
