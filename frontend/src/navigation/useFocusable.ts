import { useRef } from 'react';

interface FocusableOptions {
  defaultFocus?: boolean;
}

export function useFocusable<T extends HTMLElement>({
  defaultFocus = false,
}: FocusableOptions = {}) {
  const ref = useRef<T>(null);

  return {
    ref,
    tabIndex: 0,
    'data-focusable': 'true',
    'data-focus-default': defaultFocus ? 'true' : undefined,
  } as const;
}

