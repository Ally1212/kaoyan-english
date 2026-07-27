import { useMemo, useRef, useState } from 'react'
import {
  getDictionaryLookupTerm,
  loadDictionaryEntry,
  type LoadedDictionaryEntry,
} from './lib/dictionary'

interface VocabularyLookupProps {
  term: string
}

type LookupState = 'idle' | 'loading' | 'loaded' | 'not-found' | 'error'

function VocabularyLookup({ term }: VocabularyLookupProps) {
  const query = useMemo(() => getDictionaryLookupTerm(term), [term])
  const requestId = useRef(0)
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<LookupState>('idle')
  const [entry, setEntry] = useState<LoadedDictionaryEntry | null>(null)

  if (!query) return null

  const requestLookup = () => {
    const currentRequest = ++requestId.current
    setState('loading')
    void loadDictionaryEntry(query)
      .then((result) => {
        if (requestId.current !== currentRequest) return
        setEntry(result)
        setState(result ? 'loaded' : 'not-found')
      })
      .catch(() => {
        if (requestId.current === currentRequest) setState('error')
      })
  }

  const toggleLookup = () => {
    if (open) {
      setOpen(false)
      return
    }

    setOpen(true)
    if (state === 'loaded' || state === 'loading' || state === 'not-found') return
    requestLookup()
  }

  const playAudio = () => {
    if (!entry?.audioUrl) return
    void new Audio(entry.audioUrl).play().catch(() => undefined)
  }

  return (
    <div className="dictionary-lookup">
      <button
        className="dictionary-toggle"
        type="button"
        aria-expanded={open}
        aria-label={`${open ? '收起' : '查询'} ${query} 的在线词典`}
        onClick={toggleLookup}
      >
        {open ? '收起' : `在线词典 · ${query}`}
      </button>

      {open && (
        <div className="dictionary-result" aria-live="polite">
          {state === 'loading' && <p className="dictionary-message">正在查询…</p>}
          {state === 'not-found' && <p className="dictionary-message">暂未收录这个词，中文拆解仍可正常使用。</p>}
          {state === 'error' && (
            <p className="dictionary-message">
              在线词典暂时不可用。
              <button type="button" onClick={requestLookup}>重试</button>
            </p>
          )}

          {state === 'loaded' && entry && (
            <>
              <div className="dictionary-heading">
                <p>
                  <strong lang="en">{entry.word}</strong>
                  {entry.phonetic && <span lang="en">{entry.phonetic}</span>}
                </p>
                {entry.audioUrl && (
                  <button type="button" onClick={playAudio} aria-label={`播放 ${entry.word} 的发音`}>
                    发音
                  </button>
                )}
              </div>

              <ol className="dictionary-senses">
                {entry.senses.map((sense, index) => (
                  <li key={`${sense.partOfSpeech}-${index}`}>
                    <span>{sense.partOfSpeech}</span>
                    <p lang="en">{sense.definition}</p>
                    {sense.example && <p className="dictionary-example" lang="en">“{sense.example}”</p>}
                  </li>
                ))}
              </ol>

              <p className="dictionary-source">
                {entry.source === 'online' ? '在线词典' : '缓存词典'}
                {entry.sourceUrl && (
                  <> · <a href={entry.sourceUrl} target="_blank" rel="noreferrer">Wiktionary</a></>
                )}
                {entry.license && (
                  <> · <a href={entry.license.url} target="_blank" rel="noreferrer">{entry.license.name}</a></>
                )}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default VocabularyLookup
