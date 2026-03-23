import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { loadAuth } from '../lib/auth'
import BackBar from "../components/BackBar.jsx";

const DIFF = { EASY: 'easy', MEDIUM: 'medium', HARD: 'hard' }

function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('')
  function add() {
    const t = input.trim()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setInput('')
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        {tags.map(t => (
          <span key={t} className="tag-chip">{t}
            <span className="rm" onClick={() => onChange(tags.filter(x => x !== t))}>✕</span>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="input" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Type tag + Enter" style={{ flex: 1 }} />
        <button className="btn ghost sm" type="button" onClick={add}>Add</button>
      </div>
    </div>
  )
}

function EditQuestionModal({ q, onSave, onClose }) {
  const auth = loadAuth()
  const [prompt, setPrompt] = useState(q.prompt)
  const [choicesText, setChoicesText] = useState(q.choices ? q.choices.join('\n') : '')
  const [answerText, setAnswerText] = useState(() => {
    try {
      const a = JSON.parse(q.answerJson)
      return Array.isArray(a) ? a.join(',') : String(a)
    } catch { return '' }
  })
  const [explanation, setExplanation] = useState(q.explanation || '')
  const [tags, setTags] = useState(q.tags || [])
  const [difficulty, setDifficulty] = useState(q.difficulty || 'MEDIUM')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('add')
  // CSV import state
  const [csvText, setCsvText] = useState('')
  const [csvPreview, setCsvPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [err, setErr] = useState('')

  function parseAnswer() {
    if (q.type === 'MCQ') return answerText.trim()
    if (q.type === 'MULTI_SELECT') return answerText.split(',').map(s => s.trim()).filter(Boolean)
    if (q.type === 'NUMERIC') return answerText.trim()
    if (q.type === 'SHORT_ANSWER') return answerText.trim()
    if (q.type === 'REORDER') return answerText.split(',').map(s => s.trim())
    return answerText
  }

  async function save() {
    setSaving(true); setErr('')
    try {
      const choices = (q.type === 'MCQ' || q.type === 'MULTI_SELECT')
        ? choicesText.split('\n').map(s => s.trim()).filter(Boolean) : undefined
      const d = await api(`/api/questions/${q.id}`, {
        token: auth.token, method: 'PATCH',
        body: { prompt, choices, answer: parseAnswer(), explanation, tags, difficulty }
      })
      onSave(d.question)
    } catch (e) { setErr(e.message); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>✏️ Edit Question</h3>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>
        {err && <div className="banner error" style={{ marginBottom: 10 }}>{err}</div>}

        <div className="row">
          <div style={{ flex: 1 }}>
            <label className="small">Type</label>
            <input className="input" value={q.type} disabled style={{ opacity: .6 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="small">Difficulty</label>
            <select className="input" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
              <option value="EASY">🟢 Easy</option>
              <option value="MEDIUM">🟡 Medium</option>
              <option value="HARD">🔴 Hard</option>
            </select>
          </div>
        </div>

        <label className="small">Prompt</label>
        <textarea className="input" value={prompt} onChange={e => setPrompt(e.target.value)} />

        {(q.type === 'MCQ' || q.type === 'MULTI_SELECT') && (
          <>
            <label className="small">Choices (one per line)</label>
            <textarea className="input" value={choicesText} onChange={e => setChoicesText(e.target.value)} />
            <label className="small">Answer{q.type === 'MULTI_SELECT' ? ' (comma-separated)' : ''}</label>
            <input className="input" value={answerText} onChange={e => setAnswerText(e.target.value)} />
          </>
        )}
        {(q.type === 'SHORT_ANSWER' || q.type === 'NUMERIC' || q.type === 'REORDER') && (
          <>
            <label className="small">Answer</label>
            <input className="input" value={answerText} onChange={e => setAnswerText(e.target.value)} />
          </>
        )}

        <label className="small">Explanation (optional)</label>
        <textarea className="input" value={explanation} onChange={e => setExplanation(e.target.value)} style={{ minHeight: 70 }} />

        <label className="small">Tags</label>
        <TagInput tags={tags} onChange={setTags} />

        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" onClick={save} disabled={saving || !prompt.trim()}>
            {saving ? <><span className="spinner"></span> Saving…</> : 'Save Changes'}
          </button>
          <button className="btn secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function parseCsvQuestions(text) {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\'"]/g,''))
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const cols = []; let cur = ''; let inQ = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ }
      else if (line[i] === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
      else cur += line[i]
    }
    cols.push(cur.trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (cols[i]||'').replace(/^"|"$/g,'') })
    return obj
  }).filter(r => r.prompt || r.question)
}


export default function Questions() {
  const { classId } = useParams()
  const auth = loadAuth()
  const [subject, setSubject] = useState('RLA')
  const [passages, setPassages] = useState([])
  const [passageId, setPassageId] = useState('')
  const [questions, setQuestions] = useState([])
  const [filterDiff, setFilterDiff] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [type, setType] = useState('MCQ')
  const [prompt, setPrompt] = useState('')
  const [choicesText, setChoicesText] = useState('A) \nB) \nC) \nD) ')
  const [answerText, setAnswerText] = useState('A')
  const [explanation, setExplanation] = useState('')
  const [tags, setTags] = useState([])
  const [difficulty, setDifficulty] = useState('MEDIUM')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [confirmState, setConfirmState] = useState(null)
  const [editQ, setEditQ] = useState(null)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('add')
  // CSV import state
  const [csvText, setCsvText] = useState('')
  const [csvPreview, setCsvPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  async function refresh() {
    let url = `/api/questions?classId=${classId}&subject=${subject}`
    if (passageId) url += `&passageId=${passageId}`
    if (filterDiff) url += `&difficulty=${filterDiff}`
    if (filterTag) url += `&tag=${encodeURIComponent(filterTag)}`
    const qs = await api(url, { token: auth.token })
    setQuestions(qs.questions)
  }

  useEffect(() => {
    if (!auth?.token) return
    api(`/api/passages?classId=${classId}&subject=${subject}`, { token: auth.token })
      .then(d => setPassages(d.passages)).catch(() => {})
    refresh().catch(e => setErr(e.message))
  }, [subject, passageId, filterDiff, filterTag])

  function parseChoices() {
    if (type !== 'MCQ' && type !== 'MULTI_SELECT') return null
    return choicesText.split('\n').map(s => s.trim()).filter(Boolean)
  }
  function parseAnswer() {
    if (type === 'MCQ') return answerText.trim()
    if (type === 'MULTI_SELECT') return answerText.split(',').map(s => s.trim()).filter(Boolean)
    if (type === 'NUMERIC') return answerText.trim()
    if (type === 'SHORT_ANSWER') return answerText.trim()
    if (type === 'REORDER') return answerText.split(',').map(s => s.trim())
    return answerText
  }

  async function create() {
    setErr(''); setMsg(''); setSaving(true)
    try {
      const d = await api('/api/questions', {
        token: auth.token, method: 'POST',
        body: { classId, subject, type, prompt, choices: parseChoices(), answer: parseAnswer(),
          explanation: explanation || undefined, passageId: passageId || undefined, tags, difficulty }
      })
      setQuestions([d.question, ...questions])
      setPrompt(''); setExplanation(''); setTags([])
      setMsg('✓ Question saved!')
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  async function duplicateQ(id) {
    setErr(''); setMsg('')
    try {
      const d = await api(`/api/questions/${id}/duplicate`, { token: auth.token, method: 'POST' })
      setQuestions([d.question, ...questions])
      setMsg('✓ Question duplicated.')
    } catch (e) { setErr(e.message) }
  }

  function deleteQ(id) {
    setConfirmState({
      title: 'Delete question?',
      message: 'This will remove the question from any quizzes it belongs to. This cannot be undone.',
      danger: true,
      confirmLabel: 'Delete',
      onConfirm: () => doDeleteQ(id)
    })
  }
  async function doDeleteQ(id) {
    try {
      await api(`/api/questions/${id}`, { token: auth.token, method: 'DELETE' })
      setQuestions(questions.filter(q => q.id !== id))
    } catch (e) { setErr(e.message) }
  }

  function onEditSave(updated) {
    setQuestions(questions.map(q => q.id === updated.id ? { ...q, ...updated } : q))
    setEditQ(null)
    setMsg('✓ Question updated!')
  }

  const allTags = [...new Set(questions.flatMap(q => q.tags || []))]

  if (!auth || auth.type !== 'USER') return <div className="card">Please login as Admin/Teacher.</div>

  return (
    <div>
      {editQ && <EditQuestionModal q={editQ} onSave={onEditSave} onClose={() => setEditQ(null)} />}
      {confirmState && <ConfirmModal {...confirmState} onClose={() => setConfirmState(null)} />}

      <BackBar to={`/teacher/class/${classId}`} label="Back to Class" />
      <h2>❓ Question Bank</h2>

      {err && <div className="banner error" style={{ marginBottom: 12 }}>{err}</div>}
      {msg && <div className="banner success" style={{ marginBottom: 12 }}>{msg}</div>}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <div style={{ flex: 1, minWidth: 150 }}>
            <label className="small">Subject</label>
            <select className="input" value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="RLA">RLA</option>
              <option value="MATH">Math</option>
              <option value="SCIENCE">Science</option>
              <option value="SOCIAL_STUDIES">Social Studies</option>
            </select>
          </div>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label className="small">Linked Passage</label>
            <select className="input" value={passageId} onChange={e => setPassageId(e.target.value)}>
              <option value="">(All)</option>
              {passages.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label className="small">Difficulty</label>
            <select className="input" value={filterDiff} onChange={e => setFilterDiff(e.target.value)}>
              <option value="">All</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label className="small">Tag</label>
            <select className="input" value={filterTag} onChange={e => setFilterTag(e.target.value)}>
              <option value="">All</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Create form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>➕ Add Question</h3>
        <div className="row">
          <div style={{ flex: 1, minWidth: 150 }}>
            <label className="small">Type</label>
            <select className="input" value={type} onChange={e => setType(e.target.value)}>
              <option value="MCQ">Multiple Choice</option>
              <option value="MULTI_SELECT">Select All That Apply</option>
              <option value="SHORT_ANSWER">Short Answer</option>
              <option value="NUMERIC">Numeric</option>
              <option value="REORDER">Reorder</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label className="small">Difficulty</label>
            <select className="input" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
              <option value="EASY">🟢 Easy</option>
              <option value="MEDIUM">🟡 Medium</option>
              <option value="HARD">🔴 Hard</option>
            </select>
          </div>
        </div>

        <label className="small">Prompt</label>
        <textarea className="input" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Enter the question…" />

        {(type === 'MCQ' || type === 'MULTI_SELECT') && (
          <>
            <label className="small">Choices (one per line, e.g. A) ...)</label>
            <textarea className="input" value={choicesText} onChange={e => setChoicesText(e.target.value)} />
            <label className="small">Correct Answer{type === 'MULTI_SELECT' ? ' (comma-separated, e.g. A,C)' : ' (e.g. A)'}</label>
            <input className="input" value={answerText} onChange={e => setAnswerText(e.target.value)} />
          </>
        )}
        {(type === 'SHORT_ANSWER' || type === 'NUMERIC' || type === 'REORDER') && (
          <>
            <label className="small">Correct Answer{type === 'REORDER' ? ' (comma-separated order)' : ''}</label>
            <input className="input" value={answerText} onChange={e => setAnswerText(e.target.value)} />
          </>
        )}

        <label className="small">Explanation (shown to students after submission)</label>
        <textarea className="input" value={explanation} onChange={e => setExplanation(e.target.value)} style={{ minHeight: 70 }} placeholder="Optional…" />

        <label className="small">Tags</label>
        <TagInput tags={tags} onChange={setTags} />

        <div style={{ marginTop: 14 }}>
          <button className="btn" onClick={create} disabled={!prompt.trim() || saving}>
            {saving ? <><span className="spinner"></span> Saving…</> : 'Save Question'}
          </button>
        </div>
      </div>

      {/* Question list */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>📋 Saved Questions</h3>
        <span className="badge">{questions.length}</span>
      </div>

      {questions.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>
          No questions match filters. Add one above.
        </div>
      )}

      {questions.map(q => (
        <div key={q.id} className="card" style={{ marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="badge">{q.type}</span>
              <span className={`badge ${DIFF[q.difficulty] || 'medium'}`}>{q.difficulty}</span>
              {(q.tags || []).map(t => <span key={t} className="tag-chip">{t}</span>)}
              {q.passageId && <span className="badge accent">📄 Passage</span>}
            </div>
            <div className="row nowrap">
              <button className="btn ghost sm" onClick={() => setEditQ(q)}>✏️ Edit</button>
              <button className="btn ghost sm" onClick={() => duplicateQ(q.id)}>📄 Duplicate</button>
              <button className="btn danger sm" onClick={() => deleteQ(q.id)}>Delete</button>
            </div>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 14 }}>{q.prompt}</div>
          {q.choices && (
            <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13, color: 'var(--text2)' }}>
              {q.choices.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}
          {q.explanation && (
            <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text2)', borderLeft: '3px solid var(--accent)', paddingLeft: 8 }}>
              💡 {q.explanation}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}