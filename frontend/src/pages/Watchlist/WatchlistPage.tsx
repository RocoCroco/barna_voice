import { ContentCard } from '../../components/ContentCard';
import { TVLink } from '../../components/TVLink';
import { contentService } from '../../services/content.service';
import { useWatchlistStore } from '../../store/watchlist.store';

export function WatchlistPage() {
  const contentIds = useWatchlistStore((state) => state.contentIds);
  const items = contentIds
    .map((id) => contentService.getById(id))
    .filter((item) => item !== undefined);

  return (
    <div className="page library-page">
      <header className="page-heading">
        <span className="eyebrow">Saved for later</span>
        <h1>My list</h1>
        <p>Your household list lives on this TV for now.</p>
      </header>
      {items.length > 0 ? (
        <div className="library-grid">
          {items.map((content, index) => (
            <ContentCard
              key={content.id}
              content={content}
              defaultFocus={index === 0}
            />
          ))}
        </div>
      ) : (
        <section className="empty-state">
          <span className="empty-state__mark" aria-hidden="true">＋</span>
          <h2>Your list is ready for its first title</h2>
          <p>Open any recommendation and save it here.</p>
          <TVLink to="/" className="tv-button tv-button--primary" defaultFocus>
            Explore recommendations
          </TVLink>
        </section>
      )}
    </div>
  );
}

