import type { ReactNode } from 'react';
export function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <header className="page-heading"><div><span className="page-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{children}</header>;
}
export function PageState({ error, retry }: { error?: string; retry?: () => void }) {
  return <section className="page"><div className="page-state"><span className="state-rune" aria-hidden="true">✦</span><h2>{error ? 'The path is blocked' : 'Preparing your adventure'}</h2><p role={error ? 'alert' : 'status'}>{error || 'Loading your camp. Just a moment…'}</p>{error && retry && <button className="cta cta-main" onClick={retry}>TRY AGAIN</button>}</div></section>;
}
