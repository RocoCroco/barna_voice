import { ContentCard } from '../../components/ContentCard';
import { TVLink } from '../../components/TVLink';
import { contentService } from '../../services/content.service';

export function SearchPage() {
  return (
    <div className="page library-page">
      <header className="page-heading">
        <span className="eyebrow">Traditional browsing</span>
        <h1>Explore the collection</h1>
        <p>Voice search will join this screen in a later iteration.</p>
      </header>
      <TVLink
        to="/recommendations?mode=discover"
        className="inline-voice-card"
        defaultFocus
        voiceTrigger
      >
        <span className="mic-icon" aria-hidden="true">●</span>
        <span><strong>Rather talk about it?</strong><small>Start a live recommendation session</small></span>
        <span aria-hidden="true">→</span>
      </TVLink>
      <div className="library-grid">
        {contentService.getAll().map((content) => (
          <ContentCard key={content.id} content={content} />
        ))}
      </div>
    </div>
  );
}

