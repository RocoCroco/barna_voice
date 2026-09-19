import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ContentDetailsPage } from '../pages/ContentDetails/ContentDetailsPage';
import { HomePage } from '../pages/Home/HomePage';
import { NotFoundPage } from '../pages/NotFound/NotFoundPage';
import { ProfileSelectionPage } from '../pages/ProfileSelection/ProfileSelectionPage';
import { RecommendationSessionPage } from '../pages/RecommendationSession/RecommendationSessionPage';
import { SearchPage } from '../pages/Search/SearchPage';
import { WatchlistPage } from '../pages/Watchlist/WatchlistPage';
import { useProfileStore } from '../store/profile.store';

function AppRoutes() {
  const location = useLocation();
  const activeProfile = useProfileStore((state) => state.activeProfile);
  const isProfileRoute = location.pathname === '/profiles';

  if (!activeProfile && !isProfileRoute) {
    return (
      <Navigate
        to="/profiles"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return (
    <Routes>
      <Route path="/profiles" element={<ProfileSelectionPage />} />
      <Route path="/" element={<HomePage />} />
      <Route path="/recommendations" element={<RecommendationSessionPage />} />
      <Route path="/content/:contentId" element={<ContentDetailsPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/watchlist" element={<WatchlistPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export function App() {
  return (
    <AppShell>
      <AppRoutes />
    </AppShell>
  );
}
