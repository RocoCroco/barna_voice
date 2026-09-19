import { TVLink } from '../../components/TVLink';

export function NotFoundPage() {
  return (
    <div className="page empty-page">
      <span className="eyebrow">404</span>
      <h1>This screen is not part of tonight's plan.</h1>
      <TVLink to="/" className="tv-button tv-button--primary" defaultFocus>
        Return home
      </TVLink>
    </div>
  );
}

