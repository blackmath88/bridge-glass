import { useEffect, useState } from 'react'
import type { TemplateIndexEntry } from '../lib/types'
import { fetchTemplateIndex } from '../lib/templates'

interface Props {
  onLoad: (file: string) => void
}

export function TemplatePanel({ onLoad }: Props) {
  const [entries, setEntries] = useState<TemplateIndexEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTemplateIndex()
      .then((idx) => setEntries(idx.templates))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <aside className="panel">
      <h2>Templates · bridge-glass_content</h2>
      <p>Reusable Bridge Work facilitation canvases, loaded live from the template repo.</p>
      <div className="templates">
        {loading && <span className="loadnote">Loading from repo…</span>}
        {error && <span className="loadnote">Repo unreachable — check connection.</span>}
        {entries.map((t) => (
          <button key={t.id} onClick={() => onLoad(t.file)}>
            <b>{t.name}</b>
            <span>{t.category} · v{t.version} · {t.objects} objects</span>
          </button>
        ))}
      </div>
      <p className="loadnote">Source of truth · blackmath88/bridge-glass_content</p>
    </aside>
  )
}
