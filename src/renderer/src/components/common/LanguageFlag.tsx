import type { LanguageCode } from '../../lib/i18n'

/** Horizontal stripes, top to bottom. */
function Stripes({ colors }: { colors: string[] }): JSX.Element {
  const h = 20 / colors.length
  return (
    <>
      {colors.map((c, i) => (
        <rect key={i} x="0" y={i * h} width="30" height={h} fill={c} />
      ))}
    </>
  )
}

/**
 * A small SVG flag per interface language. Drawn rather than emoji: Windows
 * shows regional-indicator emoji as two letters. Russian uses the
 * white-blue-white flag; Interslavic the pan-Slavic blue-white-red tricolour.
 */
export default function LanguageFlag({ code, size = 18 }: { code: LanguageCode; size?: number }): JSX.Element {
  let body: JSX.Element
  if (code === 'ru') body = <Stripes colors={['#ffffff', '#1e5bb8', '#ffffff']} />
  else if (code === 'pl') body = <Stripes colors={['#ffffff', '#dc143c']} />
  else if (code === 'hu') body = <Stripes colors={['#ce2939', '#ffffff', '#477050']} />
  else if (code === 'isv') body = <Stripes colors={['#1c3f94', '#ffffff', '#d52b1e']} />
  else
    body = (
      // United Kingdom
      <>
        <rect width="30" height="20" fill="#012169" />
        <path d="M0,0 L30,20 M30,0 L0,20" stroke="#ffffff" strokeWidth="4" />
        <path d="M0,0 L30,20 M30,0 L0,20" stroke="#c8102e" strokeWidth="1.6" />
        <path d="M15,0 V20 M0,10 H30" stroke="#ffffff" strokeWidth="6" />
        <path d="M15,0 V20 M0,10 H30" stroke="#c8102e" strokeWidth="3.4" />
      </>
    )
  return (
    <svg
      className="language-flag"
      width={size}
      height={(size * 2) / 3}
      viewBox="0 0 30 20"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {body}
    </svg>
  )
}
