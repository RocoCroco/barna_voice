import type { KeyboardEventHandler, MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface TVLinkProps {
  to: string;
  children: ReactNode;
  className?: string;
  defaultFocus?: boolean;
  voiceTrigger?: boolean;
  ariaLabel?: string;
  focusKey?: string;
  onKeyDown?: KeyboardEventHandler<HTMLAnchorElement>;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}

export function TVLink({
  to,
  children,
  className = '',
  defaultFocus,
  voiceTrigger,
  ariaLabel,
  focusKey,
  onKeyDown,
  onClick,
}: TVLinkProps) {
  return (
    <Link
      to={to}
      className={className}
      aria-label={ariaLabel}
      tabIndex={0}
      data-focusable="true"
      data-focus-default={defaultFocus ? 'true' : undefined}
      data-voice-trigger={voiceTrigger ? 'true' : undefined}
      data-focus-key={focusKey}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
