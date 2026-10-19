import type { ReactNode } from 'react'

export function PaneHead({
  title,
  collapsed,
  onToggle,
  count,
  children
}: {
  title: string
  collapsed: boolean
  onToggle: () => void
  count?: number
  children?: ReactNode
}) {
  if (collapsed) {
    return (
      <button type="button" className="rail" onClick={onToggle} aria-label={`Expand ${title}`} title={`Expand ${title}`}>
        <span className="rail-chevron" aria-hidden>
          ›
        </span>
        <span className="rail-title">{title}</span>
        {count ? <span className="rail-count">{count}</span> : null}
      </button>
    )
  }
  return (
    <div className="pane-head">
      <button type="button" className="fold" onClick={onToggle} aria-label={`Collapse ${title}`} title={`Collapse ${title}`}>
        <span aria-hidden>‹</span>
      </button>
      <h2>{title}</h2>
      <div className="pane-actions">{children}</div>
    </div>
  )
}
