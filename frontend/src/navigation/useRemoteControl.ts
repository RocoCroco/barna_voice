import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { focusManager, type FocusDirection } from './FocusManager';

const directionByKey: Partial<Record<string, FocusDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

function isTextInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

export function useRemoteControl(): void {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const routeKey = `${location.pathname}${location.search}`;
    window.scrollTo({ top: 0, behavior: 'auto' });
    const focusTimer = window.setTimeout(() => {
      if (!focusManager.restore(routeKey)) {
        focusManager.focusInitial();
      }
    }, 80);
    const rememberFocus = (event: FocusEvent) => {
      focusManager.remember(routeKey, event.target as HTMLElement | null);
    };

    document.addEventListener('focusin', rememberFocus);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('focusin', rememberFocus);
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (document.body.dataset.tvNavigationLocked === 'true') return;

      const direction = directionByKey[event.key];
      if (direction) {
        event.preventDefault();
        focusManager.move(direction);
        return;
      }

      const isBack =
        event.key === 'Escape' ||
        event.key === 'BrowserBack' ||
        (event.key === 'Backspace' && !isTextInput(event.target));

      if (isBack) {
        event.preventDefault();
        navigate(-1);
        return;
      }

      if (event.key.toLowerCase() === 'v' && !isTextInput(event.target)) {
        event.preventDefault();
        document.querySelector<HTMLElement>('[data-voice-trigger="true"]')?.click();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);
}
