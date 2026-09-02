// src/ui/icons.tsx
/**
 * The toolbar's icons, drawn inline.
 *
 * Sixteen pixels, 1.5 stroke, `currentColor`, and `aria-hidden` on every one — so a button's
 * accessible name comes from its own text or `aria-label`, never from the mark beside it.
 * Inline rather than a font or a sprite: six shapes are not worth a request.
 */
import type { SVGProps } from 'react';

function Svg({ children, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
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
      {children}
    </svg>
  );
}

/** An arrow doubling back on itself. */
export function UndoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 7h6.5a3.5 3.5 0 1 1 0 7H7" />
      <path d="M5.5 4 3 7l2.5 3" />
    </Svg>
  );
}

/** A painter's palette, for the style panel. */
export function PaletteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M8 2a6 6 0 0 0 0 12c.9 0 1.4-.6 1.4-1.3 0-.35-.15-.65-.4-.9a1.2 1.2 0 0 1 .9-2.05h1.3A2.8 2.8 0 0 0 14 7C13.8 4.2 11.2 2 8 2Z" />
      <circle cx="5.4" cy="6.2" r=".85" fill="currentColor" stroke="none" />
      <circle cx="8.6" cy="4.9" r=".85" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** A question mark in a ring. */
export function HelpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M6.3 6.2A1.75 1.75 0 1 1 8 8.4v1.05" />
      <circle cx="8" cy="11.6" r=".8" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** A list of things with pictures beside them. */
export function CatalogIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="2" y="2.75" width="4.5" height="4.5" rx="1" />
      <rect x="2" y="8.75" width="4.5" height="4.5" rx="1" />
      <path d="M8.75 5h5.25M8.75 11h5.25" />
    </Svg>
  );
}

/** A floor plan: four walls and a doorway. */
export function RoomIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M2.5 13.5v-11h11v11H9.5" />
      <path d="M2.5 13.5h3" />
      <path d="M5.5 13.5a4 4 0 0 0 4-4" />
    </Svg>
  );
}

/** The sun, for the daylight hour and its overlay. */
export function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1.4v1.5M8 13.1v1.5M1.4 8h1.5M13.1 8h1.5M3.3 3.3l1.1 1.1M11.6 11.6l1.1 1.1M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1" />
    </Svg>
  );
}
