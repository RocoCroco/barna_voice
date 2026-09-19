import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { focusManager } from '../../navigation/FocusManager';
import { profilesService } from '../../services/profiles.service';
import { useProfileStore } from '../../store/profile.store';
import type { Profile } from '../../types/profile';

interface ProfileLocationState {
  from?: string;
}

export function ProfileSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const profiles = useProfileStore((state) => state.profiles);
  const isLoading = useProfileStore((state) => state.isLoading);
  const setProfiles = useProfileStore((state) => state.setProfiles);
  const setActiveProfile = useProfileStore((state) => state.setActiveProfile);
  const setLoading = useProfileStore((state) => state.setLoading);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;

    const loadProfiles = async () => {
      setLoading(true);
      setError('');

      try {
        const availableProfiles = await profilesService.getProfiles();
        if (!isActive) return;
        setProfiles(availableProfiles);
        window.setTimeout(() => focusManager.focusInitial(), 80);
      } catch {
        if (isActive) setError('We could not load the profiles. Please try again.');
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void loadProfiles();
    return () => {
      isActive = false;
    };
  }, [setLoading, setProfiles]);

  const handleSelect = async (profile: Profile) => {
    if (selectingId) return;

    setSelectingId(profile.id);
    setError('');

    try {
      const selectedProfile = await profilesService.selectProfile(profile.id);
      setActiveProfile(selectedProfile);
      const destination = (location.state as ProfileLocationState | null)?.from ?? '/';
      navigate(destination, { replace: true });
    } catch {
      setError('We could not select that profile. Please try again.');
      setSelectingId(null);
    }
  };

  return (
    <div className="profile-selection-page">
      <img className="profile-selection__logo" src="/brand/logo.svg" alt="Compass" />

      <motion.section
        className="profile-selection__content"
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0.01 : 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="eyebrow">One TV · One account</span>
        <h1>Who’s watching?</h1>
        <p>Choose a profile for this session.</p>

        {isLoading && profiles.length === 0 ? (
          <div className="profile-selection__loading" aria-live="polite">
            <span />
            Loading profiles…
          </div>
        ) : (
          <div className="profile-grid" aria-label="Available profiles">
            {profiles.map((profile, index) => (
              <motion.button
                key={profile.id}
                type="button"
                className={`profile-card profile-card--${profile.theme}`}
                data-focusable="true"
                data-focus-default={index === 0 ? 'true' : undefined}
                disabled={selectingId !== null}
                onClick={() => void handleSelect(profile)}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: shouldReduceMotion ? 0 : index * 0.07, duration: 0.4 }}
              >
                <span className="profile-card__avatar" aria-hidden="true">
                  {profile.initials}
                </span>
                <strong>{profile.name}</strong>
                <small>{selectingId === profile.id ? 'Opening…' : 'Select profile'}</small>
              </motion.button>
            ))}
          </div>
        )}

        {error && <p className="profile-selection__error" role="alert">{error}</p>}
      </motion.section>
    </div>
  );
}
