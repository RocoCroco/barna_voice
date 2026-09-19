export type FocusDirection = 'up' | 'down' | 'left' | 'right';

const FOCUSABLE_SELECTOR =
  '[data-focusable="true"]:not([disabled]):not([aria-disabled="true"])';

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

class FocusManager {
  private focusMemory = new Map<string, string>();

  private getCandidates(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      isVisible,
    );
  }

  focusInitial(): void {
    const candidates = this.getCandidates();
    if (candidates.length === 0) return;

    const preferred = candidates.find(
      (candidate) => candidate.dataset.focusDefault === 'true',
    );
    (preferred ?? candidates[0]).focus({ preventScroll: true });
  }

  remember(routeKey: string, element: HTMLElement | null): void {
    const focusKey = element?.dataset.focusKey;
    if (focusKey) {
      this.focusMemory.set(routeKey, focusKey);
    }
  }

  restore(routeKey: string): boolean {
    const focusKey = this.focusMemory.get(routeKey);
    if (!focusKey) return false;

    const candidate = this.getCandidates().find(
      (element) => element.dataset.focusKey === focusKey,
    );
    if (!candidate) return false;

    candidate.focus({ preventScroll: true });
    candidate.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    return true;
  }

  move(direction: FocusDirection): void {
    const candidates = this.getCandidates();
    if (candidates.length === 0) return;

    const current = document.activeElement as HTMLElement | null;
    if (!current || !candidates.includes(current)) {
      this.focusInitial();
      return;
    }

    const currentRect = current.getBoundingClientRect();
    const currentX = currentRect.left + currentRect.width / 2;
    const currentY = currentRect.top + currentRect.height / 2;

    const next = candidates
      .filter((candidate) => candidate !== current)
      .map((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const deltaX = rect.left + rect.width / 2 - currentX;
        const deltaY = rect.top + rect.height / 2 - currentY;
        const isInDirection =
          (direction === 'left' && deltaX < -4) ||
          (direction === 'right' && deltaX > 4) ||
          (direction === 'up' && deltaY < -4) ||
          (direction === 'down' && deltaY > 4);

        if (!isInDirection) return null;

        const primaryDistance =
          direction === 'left' || direction === 'right'
            ? Math.abs(deltaX)
            : Math.abs(deltaY);
        const secondaryDistance =
          direction === 'left' || direction === 'right'
            ? Math.abs(deltaY)
            : Math.abs(deltaX);

        return {
          candidate,
          score: primaryDistance + secondaryDistance * 2.5,
        };
      })
      .filter(
        (result): result is { candidate: HTMLElement; score: number } =>
          result !== null,
      )
      .sort((a, b) => a.score - b.score)[0]?.candidate;

    next?.focus();
    next?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
}

export const focusManager = new FocusManager();
