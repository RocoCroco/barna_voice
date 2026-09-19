import type { Content } from '../types/content';
import { TVLink } from './TVLink';

interface ContentCardProps {
  content: Content;
  position?: number;
  large?: boolean;
  defaultFocus?: boolean;
  onFocus?: () => void;
  onOpen?: () => void;
}

const positionLabels = ['Best match', 'Crowd pleaser', 'Wildcard'];

export function ContentCard({
  content,
  position,
  large = false,
  defaultFocus,
  onFocus,
  onOpen,
}: ContentCardProps) {
  return (
    <TVLink
      to={`/content/${encodeURIComponent(content.id)}`}
      className={`content-card theme-${content.theme} ${large ? 'content-card--large' : ''}`}
      ariaLabel={`Open ${content.title}`}
      defaultFocus={defaultFocus}
      focusKey={`content:${content.id}`}
      onFocus={onFocus}
      onClick={onOpen}
    >
      <span className="content-card__art" aria-hidden="true">
        <span className="content-card__monogram">{content.title.slice(0, 1)}</span>
      </span>
      <span className="content-card__shade" aria-hidden="true" />
      <span className="content-card__body">
        {position !== undefined && (
          <span className="content-card__position">
            {positionLabels[position] ?? `Option ${position + 1}`}
          </span>
        )}
        <strong>{content.title}</strong>
        <span className="content-card__meta">
          {content.year ?? 'Year unknown'} · {content.duration} · {content.maturityRating}
        </span>
        {large && (
          <span className="content-card__reason">{content.recommendationReason}</span>
        )}
      </span>
    </TVLink>
  );
}
