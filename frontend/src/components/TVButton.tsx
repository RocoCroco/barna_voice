import type { ButtonHTMLAttributes } from 'react';
import { useFocusable } from '../navigation/useFocusable';

interface TVButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  defaultFocus?: boolean;
  voiceTrigger?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function TVButton({
  defaultFocus,
  voiceTrigger,
  variant = 'secondary',
  className = '',
  ...props
}: TVButtonProps) {
  const focusable = useFocusable<HTMLButtonElement>({ defaultFocus });

  return (
    <button
      {...focusable}
      {...props}
      data-voice-trigger={voiceTrigger ? 'true' : undefined}
      className={`tv-button tv-button--${variant} ${className}`.trim()}
    />
  );
}

