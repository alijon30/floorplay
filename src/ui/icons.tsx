// src/ui/icons.tsx
/**
 * Every mark in the interface, drawn inline.
 *
 * Sixteen pixels, 1.5 stroke, `currentColor`, and `aria-hidden` on every one — so a button's
 * accessible name comes from its own text or `aria-label`, never from the mark beside it.
 * There is no emoji anywhere in the product: a person, a robot and a lock are line drawings
 * on the same grid as the rest, and they inherit the colour of the text they sit in.
 */
import type { ReactElement, SVGProps } from 'react';

export type IconName =
  | 'undo' | 'palette' | 'help' | 'catalog' | 'room' | 'sun' | 'sunOff' | 'cube' | 'walk'
  | 'orbit' | 'shadows' | 'plus' | 'close' | 'chevron' | 'chevronRight' | 'user' | 'bot'
  | 'lock' | 'unlock' | 'trash' | 'swap' | 'wand' | 'fit' | 'grid' | 'warning' | 'rooms' | 'dev';

const PATHS: Record<IconName, ReactElement> = {
  undo: (
    <>
      <path d="M3 7h6.5a3.5 3.5 0 1 1 0 7H7" />
      <path d="M5.5 4 3 7l2.5 3" />
    </>
  ),
  palette: (
    <>
      <path d="M8 2a6 6 0 0 0 0 12c.9 0 1.4-.6 1.4-1.3 0-.35-.15-.65-.4-.9a1.2 1.2 0 0 1 .9-2.05h1.3A2.8 2.8 0 0 0 14 7C13.8 4.2 11.2 2 8 2Z" />
      <circle cx="5.4" cy="6.2" r=".85" fill="currentColor" stroke="none" />
      <circle cx="8.6" cy="4.9" r=".85" fill="currentColor" stroke="none" />
    </>
  ),
  help: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M6.3 6.2A1.75 1.75 0 1 1 8 8.4v1.05" />
      <circle cx="8" cy="11.6" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  catalog: (
    <>
      <rect x="2" y="2.75" width="4.5" height="4.5" rx="1" />
      <rect x="2" y="8.75" width="4.5" height="4.5" rx="1" />
      <path d="M8.75 5h5.25M8.75 11h5.25" />
    </>
  ),
  room: (
    <>
      <path d="M2.5 13.5v-11h11v11H9.5" />
      <path d="M2.5 13.5h3" />
      <path d="M5.5 13.5a4 4 0 0 0 4-4" />
    </>
  ),
  rooms: (
    <>
      <rect x="2" y="4.5" width="7" height="7" rx="1" />
      <path d="M11 4.5h3v7h-3" />
    </>
  ),
  sun: (
    <>
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1.4v1.5M8 13.1v1.5M1.4 8h1.5M13.1 8h1.5M3.3 3.3l1.1 1.1M11.6 11.6l1.1 1.1M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1" />
    </>
  ),
  // Daylight off: the same disc with the rays gone and a stroke through it.
  sunOff: (
    <>
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1.4v1.5M13.1 8h1.5M11.6 11.6l1.1 1.1M12.7 3.3l-1.1 1.1" />
      <path d="M2 14 14 2" />
    </>
  ),
  cube: (
    <>
      <path d="M8 1.9 13.6 5v6L8 14.1 2.4 11V5Z" />
      <path d="M2.4 5 8 8.1 13.6 5M8 8.1v6" />
    </>
  ),
  walk: (
    <>
      <circle cx="8.6" cy="2.9" r="1.3" />
      <path d="M8.9 5.4 7 6.6l-.7 2.6M8.9 5.4l1.9 1.6.9 2.2M8.9 5.4 8.4 9.3l1.6 1.7.5 3M6.3 9.2 5 11.4l-1.1 3.2" />
    </>
  ),
  orbit: (
    <>
      <circle cx="8" cy="8" r="2.6" />
      <ellipse cx="8" cy="8" rx="6.3" ry="2.9" transform="rotate(-28 8 8)" />
    </>
  ),
  shadows: (
    <>
      <circle cx="6.6" cy="6.3" r="3.4" />
      <path d="M9.4 8.2a3.4 3.4 0 0 0 4.1 4.5" />
      <ellipse cx="9" cy="12.6" rx="4.6" ry="1.5" strokeDasharray="2 2" />
    </>
  ),
  plus: <path d="M8 3.2v9.6M3.2 8h9.6" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  chevron: <path d="M4 6.2 8 10l4-3.8" />,
  chevronRight: <path d="M6.2 4 10 8l-3.8 4" />,
  user: (
    <>
      <circle cx="8" cy="5.4" r="2.6" />
      <path d="M3.1 13.6a4.9 4.9 0 0 1 9.8 0" />
    </>
  ),
  bot: (
    <>
      <rect x="2.75" y="5.5" width="10.5" height="7.5" rx="2" />
      <path d="M8 2.4v3.1" />
      <circle cx="6" cy="9.2" r=".9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="9.2" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  lock: (
    <>
      <rect x="3.25" y="7" width="9.5" height="6.5" rx="1.5" />
      <path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" />
    </>
  ),
  unlock: (
    <>
      <rect x="3.25" y="7" width="9.5" height="6.5" rx="1.5" />
      <path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8-.5" />
    </>
  ),
  trash: (
    <>
      <path d="M2.75 4.3h10.5M6.4 4.3V2.9h3.2v1.4" />
      <path d="M4.3 4.3l.6 8.3a1 1 0 0 0 1 .9h4.2a1 1 0 0 0 1-.9l.6-8.3" />
    </>
  ),
  swap: (
    <>
      <path d="M3 5.6h8.4M9.2 3.4l2.2 2.2-2.2 2.2" />
      <path d="M13 10.4H4.6m2.2-2.2-2.2 2.2 2.2 2.2" />
    </>
  ),
  wand: (
    <>
      <path d="M9.6 3.2 12.8 6.4 5.9 13.3 2.7 10.1z" />
      <path d="M8.1 4.7 11.3 7.9" />
      <path d="M12.3 1.7v2M14.9 4.3h-2" />
    </>
  ),
  fit: (
    <>
      <path d="M2.4 5.7V2.6h3.1M13.6 5.7V2.6h-3.1M2.4 10.3v3.1h3.1M13.6 10.3v3.1h-3.1" />
      <rect x="5.9" y="6.1" width="4.2" height="3.8" rx=".6" opacity=".55" />
    </>
  ),
  grid: <path d="M2.4 6.1h11.2M2.4 9.9h11.2M6.1 2.4v11.2M9.9 2.4v11.2" />,
  warning: (
    <>
      <path d="M8 2.6 14.2 13H1.8Z" />
      <path d="M8 6.5v3.1" />
      <circle cx="8" cy="11.3" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  dev: (
    <>
      <path d="M5.6 4.6 2.2 8l3.4 3.4M10.4 4.6 13.8 8l-3.4 3.4" />
      <path d="M9.2 2.8 6.8 13.2" />
    </>
  ),
};

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

/**
 * One icon, by name.
 *
 * `size` is the only dimension anyone should ever need to change; everything else — the
 * viewBox, the stroke weight, the join style — is fixed so a row of icons from different
 * corners of the app still sits on one optical line.
 */
export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

export default Icon;
