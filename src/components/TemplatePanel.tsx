import { useEffect, useState } from 'react'
import type { Template } from '../lib/types'
import { fetchTemplate, fetchTemplateIndex } from '../lib/templates'

interface Props {
  onLoad: (template: Template) => void
  onNotice: (message: string) => void
}

export function TemplatePanel({ onLoad, onNotice }: Props) {
  const [entries, setEntries] = useState<Template[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTemplateIndex()
      .then((idx) => Promise.all(idx.templates.map((entry) => fetchTemplate(entry.file))))
      .then(setEntries)
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
          <article key={t.id}>
            <button className="template-main" onClick={() => onLoad(t)}>
              <b>{t.name}</b>
              <span>{t.category} · v{t.version} · {t.objects.length} objects</span>
              {t.description && <em>{t.description}</em>}
            </button>
            {t.facilitation_notes?.length ? <details><summary>Facilitation notes</summary><ul>{t.facilitation_notes.map((note) => <li key={note}>{note}</li>)}</ul></details> : null}
            {t.system_prompt && <button className="copy-prompt" onClick={async () => {
              try {
                // Funnel pattern: expose the authored prompt without coupling the board to an AI provider.
                await navigator.clipboard.writeText(t.system_prompt!)
                onNotice('Prompt copied')
              } catch { onNotice('Could not copy prompt') }
            }}>Copy prompt</button>}
          </article>
        ))}
      </div>
      <p className="loadnote">Source of truth · blackmath88/bridge-glass_content</p>
    </aside>
  )
}
