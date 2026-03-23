import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { loadAuth } from '../lib/auth'
import BackBar from "../components/BackBar.jsx"

const SUBJ = ['RLA','MATH','SCIENCE','SOCIAL_STUDIES']
const DIFF = { EASY: '🟢', MEDIUM: '🟡', HARD: '🔴' }
const RETAKE_OPTIONS = [
  { value: 'NO_RETAKE', label: 'No Retake' },
  { value: 'ALLOW_RETAKE', label: 'Unlimited Retakes' },
  { value: 'LIMITED', label: 'Limited Retakes' }
]

function PointsEditor({ quizId, questions, onSaved }) {
  const auth = loadAuth()
  const [pts, setPts] = useState(() => { const m = {}; questions.forEach(qq => { m[qq.id] = qq.points }); return m })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const total = Object.values(pts).reduce((s, v) => s + (Number(v)||0), 0)

  async function save() {
    setSaving(true)
    try {
      await api(`/api/quizzes/${quizId}`, { token: auth.token, method: 'PATCH', body: { pointsMap: pts } })
      setMsg('✓ Points saved!'); onSaved(pts)
    } catch (e) { setMsg('Error: ' + e.message) }
    setSaving(false)
  }

  return (
    <div>
      {msg && <div className={`banner ${msg.startsWith('Error') ? 'error' : 'success'}`} style={{ marginBottom: 8 }}>{msg}</div>}
      <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
        {questions.map((qq, i) => (
          <div key={qq.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ flex: 1, fontSize: '.82rem', color: 'var(--text2)' }}>Q{i+1}. {qq.prompt?.slice(0, 55)}…</span>
            <input type="number" min="0" className="input" value={pts[qq.id]??1}
              onChange={e => setPts(p => ({ ...p, [qq.id]: Number(e.target.value)||0 }))}
              style={{ width: 62, padding: '5px 8px' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: '.875rem', fontWeight: 600 }}>Total: {total} pts</span>
        <button className="btn sm" onClick={save} disabled={saving}>{saving ? <span className="spinner"></span> : 'Save Points'}</button>
      </div>
    </div>
  )
}

function GradeOverrideModal({ attempt, totalPoints, onSave, onClose }) {
  const auth = loadAuth()
  const [score, setScore] = useState(String(attempt.scoreOverride ?? attempt.score))
  const [note, setNote] = useState(attempt.overrideNote || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setSaving(true); setErr('')
    try {
      await api(`/api/attempts/${attempt.id}/override`, {
        token: auth.token, method: 'PATCH',
        body: { scoreOverride: Number(score), overrideNote: note }
      })
      onSave(attempt.id, Number(score), note)
      onClose()
    } catch (e) { setErr(e.message); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>✏️ Override Grade</h3>
          <button className="btn ghost sm icon" onClick={onClose}>✕</button>
        </div>
        <p style={{ marginBottom: 16 }}>Student: <strong>{attempt.studentName}</strong> · Quiz: <em>{attempt.quizTitle}</em></p>
        {err && <div className="banner error" style={{ marginBottom: 12 }}>{err}</div>}
        <label className="small">New Score (max {totalPoints})</label>
        <input className="input" type="number" min="0" max={totalPoints} value={score} onChange={e => setScore(e.target.value)} />
        <label className="small">Note / Reason (optional)</label>
        <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g., Short answer accepted" />
        <div className="row" style={{ marginTop: 20 }}>
          <button className="btn" onClick={save} disabled={saving}>{saving ? <span className="spinner"></span> : 'Save Override'}</button>
          <button className="btn secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function LeaderboardModal({ quizId, quizTitle, onClose }) {
  const auth = loadAuth()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api(`/api/quizzes/${quizId}/leaderboard`, { token: auth.token })
      .then(d => setData(d))
      .catch(e => setErr(e.message))
  }, [quizId])

  const rankClass = (r) => r === 1 ? 'gold' : r === 2 ? 'silver' : r === 3 ? 'bronze' : 'other'
  const rankEmoji = (r) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>🏆 Leaderboard</h3>
          <button className="btn ghost sm icon" onClick={onClose}>✕</button>
        </div>
        <p style={{ marginBottom: 16, color: 'var(--text3)', fontSize: '.875rem' }}>{quizTitle}</p>
        {err && <div className="banner error">{err}</div>}
        {!data && !err && <div style={{ textAlign: 'center', padding: 24 }}><span className="spinner dark"></span></div>}
        {data && data.leaderboard.length === 0 && <div className="empty-state"><p>No submissions yet.</p></div>}
        {data && data.leaderboard.length > 0 && (
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {data.leaderboard.map(e => (
              <div key={e.studentId} className="lb-row">
                <div className={`lb-rank ${rankClass(e.rank)}`}>{rankEmoji(e.rank)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{e.name}</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text3)' }}>{new Date(e.submittedAt).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{e.score}/{e.totalPoints}</div>
                  <div className={`badge ${e.pct >= 70 ? 'success' : 'danger'}`} style={{ fontSize: '.72rem' }}>{e.pct}%</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Quizzes() {
  const { classId } = useParams()
  const auth = loadAuth()
  const [subject, setSubject] = useState('RLA')
  const [quizzes, setQuizzes] = useState([])
  const [questions, setQuestions] = useState([])
  const [title, setTitle] = useState('')
  const [timeLimitMin, setTimeLimitMin] = useState(30)
  const [selected, setSelected] = useState({})
  const [pointsMap, setPointsMap] = useState({})
  const [retakePolicy, setRetakePolicy] = useState('NO_RETAKE')
  const [maxRetakes, setMaxRetakes] = useState(1)
  const [openAt, setOpenAt] = useState('')
  const [closeAt, setCloseAt] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [filterDiff, setFilterDiff] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [randomCount, setRandomCount] = useState(10)
  const [expandedQuiz, setExpandedQuiz] = useState(null)
  const [overrideAttempt, setOverrideAttempt] = useState(null)
  const [leaderboardQuiz, setLeaderboardQuiz] = useState(null)
  const [tab, setTab] = useState('quizzes')

  async function refreshQuizzes() {
    const d = await api(`/api/quizzes?classId=${classId}`, { token: auth.token })
    setQuizzes(d.quizzes)
  }
  async function refreshQuestions() {
    let url = `/api/questions?classId=${classId}&subject=${subject}`
    if (filterDiff) url += `&difficulty=${filterDiff}`
    if (filterTag) url += `&tag=${encodeURIComponent(filterTag)}`
    const q = await api(url, { token: auth.token })
    setQuestions(q.questions)
  }

  useEffect(() => { if (auth?.token) refreshQuizzes().catch(e => setErr(e.message)) }, [])
  useEffect(() => { if (auth?.token) refreshQuestions().catch(e => setErr(e.message)) }, [subject, filterDiff, filterTag])

  function toggle(id) {
    setSelected(prev => {
      const next = { ...prev, [id]: !prev[id] }
      if (!next[id]) { const pm = { ...pointsMap }; delete pm[id]; setPointsMap(pm) }
      else setPointsMap(pm => ({ ...pm, [id]: 1 }))
      return next
    })
  }

  function randomPull() {
    const pool = [...questions]
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [pool[i],pool[j]] = [pool[j],pool[i]] }
    const picked = pool.slice(0, Math.min(Number(randomCount)||10, pool.length))
    const sel = {}; const pm = {}
    picked.forEach(q => { sel[q.id] = true; pm[q.id] = 1 })
    setSelected(sel); setPointsMap(pm)
    setMsg(`🎲 Selected ${picked.length} random questions.`)
  }

  async function create() {
    setErr(''); setMsg('')
    try {
      const questionIds = Object.keys(selected).filter(k => selected[k])
      await api('/api/quizzes', { token: auth.token, method: 'POST',
        body: { classId, subject, title, timeLimitMin: Number(timeLimitMin)||30,
          questionIds, pointsMap, retakePolicy, maxRetakes: Number(maxRetakes)||0,
          openAt: openAt || undefined, closeAt: closeAt || undefined } })
      setTitle(''); setSelected({}); setPointsMap({})
      setMsg('✓ Quiz created!')
      await refreshQuizzes()
    } catch (e) { setErr(e.message) }
  }

  async function setPub(id, published) {
    const d = await api(`/api/quizzes/${id}`, { token: auth.token, method: 'PATCH', body: { published } })
    setQuizzes(quizzes.map(q => q.id === id ? { ...q, ...d.quiz } : q))
    setMsg(published ? '✓ Published — students can now see it.' : '○ Quiz unpublished.')
  }

  async function setMarks(id, marksReleased) {
    const d = await api(`/api/quizzes/${id}`, { token: auth.token, method: 'PATCH', body: { marksReleased } })
    setQuizzes(quizzes.map(q => q.id === id ? { ...q, ...d.quiz } : q))
    setMsg(marksReleased ? '✓ Marks released to students.' : '🔒 Marks hidden.')
  }

  async function duplicateQuiz(id) {
    try {
      const d = await api(`/api/quizzes/${id}/duplicate`, { token: auth.token, method: 'POST' })
      setMsg('✓ Quiz duplicated (draft).')
      await refreshQuizzes()
    } catch (e) { setErr(e.message) }
  }

  async function deleteQuiz(id) {
    if (!confirm('Delete this quiz and all attempts?')) return
    await api(`/api/quizzes/${id}`, { token: auth.token, method: 'DELETE' })
    setQuizzes(quizzes.filter(q => q.id !== id))
  }

  async function loadResults() {
    try {
      const d = await api(`/api/attempts/results?classId=${classId}`, { token: auth.token })
      setResults(d.attempts); setShowResults(true)
    } catch (e) { setErr(e.message) }
  }

  const allTags = [...new Set(questions.flatMap(q => q.tags||[]))]
  const selectedIds = Object.keys(selected).filter(k => selected[k])

  if (!auth || auth.type !== 'USER') return <div className="card">Please login.</div>

  return (
    <div>
      {overrideAttempt && (
        <GradeOverrideModal
          attempt={overrideAttempt}
          totalPoints={results.find(r => r.id === overrideAttempt.id)?.totalPoints || 0}
          onSave={(id, score, note) => setResults(results.map(r => r.id === id ? { ...r, score, scoreOverride: score, overrideNote: note } : r))}
          onClose={() => setOverrideAttempt(null)} />
      )}
      {leaderboardQuiz && (
        <LeaderboardModal quizId={leaderboardQuiz.id} quizTitle={leaderboardQuiz.title} onClose={() => setLeaderboardQuiz(null)} />
      )}

      <BackBar to={`/teacher/class/${classId}`} title="Back to Class" />
      <div className="page-header">
        <h2>📝 Quizzes & Exams</h2>
      </div>

      {err && <div className="banner error" style={{ marginBottom: 14 }}>{err}</div>}
      {msg && <div className="banner success" style={{ marginBottom: 14, cursor: 'pointer' }} onClick={() => setMsg('')}>{msg}</div>}

      <div className="tab-bar">
        <button className={`tab-btn ${tab==='quizzes'?'active':''}`} onClick={() => setTab('quizzes')}>All Quizzes</button>
        <button className={`tab-btn ${tab==='create'?'active':''}`} onClick={() => setTab('create')}>+ Create</button>
        <button className={`tab-btn ${tab==='results'?'active':''}`} onClick={() => { setTab('results'); if (!results.length) loadResults() }}>Results</button>
      </div>

      {/* ── CREATE TAB ── */}
      {tab === 'create' && (
        <div className="card">
          <h3 style={{ marginBottom: 20 }}>Create New Quiz</h3>

          <div className="row">
            <div style={{ flex: 3, minWidth: 200 }}>
              <label className="small">Title</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., RLA Practice Test 1" />
            </div>
            <div style={{ flex: 1, minWidth: 110 }}>
              <label className="small">Time Limit (min)</label>
              <input className="input" type="number" value={timeLimitMin} onChange={e => setTimeLimitMin(e.target.value)} min={1} />
            </div>
          </div>

          {/* Retake + Scheduling */}
          <div className="row" style={{ marginTop: 4 }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="small">Retake Policy</label>
              <select className="input" value={retakePolicy} onChange={e => setRetakePolicy(e.target.value)}>
                {RETAKE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {retakePolicy === 'LIMITED' && (
              <div style={{ flex: 1, minWidth: 100 }}>
                <label className="small">Max Attempts</label>
                <input className="input" type="number" min="1" value={maxRetakes} onChange={e => setMaxRetakes(e.target.value)} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 190 }}>
              <label className="small">Opens At (optional)</label>
              <input className="input" type="datetime-local" value={openAt} onChange={e => setOpenAt(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 190 }}>
              <label className="small">Closes At (optional)</label>
              <input className="input" type="datetime-local" value={closeAt} onChange={e => setCloseAt(e.target.value)} />
            </div>
          </div>

          {/* Question selection */}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: '.875rem' }}>Select Questions</div>
            <div className="row">
              <div style={{ flex: 1, minWidth: 120 }}>
                <label className="small">Subject</label>
                <select className="input" value={subject} onChange={e => setSubject(e.target.value)}>
                  {SUBJ.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 110 }}>
                <label className="small">Difficulty</label>
                <select className="input" value={filterDiff} onChange={e => setFilterDiff(e.target.value)}>
                  <option value="">All</option>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 110 }}>
                <label className="small">Tag</label>
                <select className="input" value={filterTag} onChange={e => setFilterTag(e.target.value)}>
                  <option value="">All</option>
                  {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '.8rem', color: 'var(--text3)' }}><strong>{selectedIds.length}</strong>/{questions.length} selected</span>
              <button className="btn ghost sm" onClick={() => { const s={};const p={}; questions.forEach(q=>{s[q.id]=true;p[q.id]=1}); setSelected(s);setPointsMap(p) }}>All</button>
              <button className="btn ghost sm" onClick={() => { setSelected({}); setPointsMap({}) }}>Clear</button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="number" className="input" value={randomCount} onChange={e => setRandomCount(e.target.value)} style={{ width: 60, padding: '5px 8px' }} min={1} />
                <button className="btn secondary sm" onClick={randomPull}>🎲 Random</button>
              </div>
            </div>

            <div className="scroll-list" style={{ maxHeight: 260 }}>
              {questions.length === 0 && <p style={{ padding: '14px 16px', fontSize: '.875rem', color: 'var(--text3)' }}>No questions found. Add questions in the Question Bank first.</p>}
              {questions.map(q => (
                <label key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: selected[q.id] ? 'rgba(32,85,212,.04)' : 'transparent' }}>
                  <input type="checkbox" checked={!!selected[q.id]} onChange={() => toggle(q.id)} style={{ accent: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '.82rem' }}>
                    {DIFF[q.difficulty]} <span className="badge" style={{ marginRight: 4 }}>{q.type}</span>
                    {q.prompt?.slice(0,80)}{q.prompt?.length > 80 ? '…' : ''}
                  </span>
                  {selected[q.id] && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <span style={{ fontSize: '.75rem', color: 'var(--text3)' }}>pts</span>
                      <input type="number" min="0" className="input" value={pointsMap[q.id]??1}
                        onChange={e => setPointsMap(pm => ({ ...pm, [q.id]: Number(e.target.value)||0 }))}
                        style={{ width: 56, padding: '4px 6px', fontSize: '.82rem' }} />
                    </div>
                  )}
                </label>
              ))}
            </div>

            {selectedIds.length > 0 && (
              <div style={{ marginTop: 8, fontSize: '.875rem', color: 'var(--text3)' }}>
                Total: <strong>{selectedIds.reduce((s,id) => s+(Number(pointsMap[id])||0), 0)} pts</strong>
              </div>
            )}
          </div>

          <div style={{ marginTop: 20 }}>
            <button className="btn lg" onClick={create} disabled={!title.trim()}>
              Create Quiz {selectedIds.length > 0 ? `(${selectedIds.length} questions)` : ''}
            </button>
          </div>
        </div>
      )}

      {/* ── QUIZZES TAB ── */}
      {tab === 'quizzes' && (
        <div>
          {quizzes.length === 0 && (
            <div className="empty-state">
              <div className="icon">📝</div>
              <p>No quizzes yet. Switch to the Create tab to make one.</p>
            </div>
          )}
          {quizzes.map(q => (
            <div key={q.id} className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                    <strong style={{ fontSize: '1rem' }}>{q.title}</strong>
                    <span className="badge accent">{q.subject}</span>
                    <span className="badge">{q.questionCount||0} Qs</span>
                    <span className="badge">{q.totalPoints||0} pts</span>
                    <span className="badge">{q.timeLimitMin}m</span>
                    <span className="badge">{q.attemptCount||0} attempts</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className={`badge ${q.published ? 'success' : ''}`}>{q.published ? '● Published' : '○ Draft'}</span>
                    <span className={`badge ${q.marksReleased ? 'success' : ''}`}>{q.marksReleased ? '📊 Marks Released' : '🔒 Hidden'}</span>
                    <span className="badge">{q.retakePolicy === 'NO_RETAKE' ? '🚫 No Retake' : q.retakePolicy === 'ALLOW_RETAKE' ? '🔄 Unlimited' : `🔄 Max ${q.maxRetakes}`}</span>
                    {q.openAt && <span className="badge warning">📅 Opens {new Date(q.openAt).toLocaleDateString()}</span>}
                    {q.closeAt && <span className="badge warning">⏰ Closes {new Date(q.closeAt).toLocaleDateString()}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn ghost sm" onClick={() => setExpandedQuiz(expandedQuiz===q.id ? null : q.id)}>
                    {expandedQuiz===q.id ? '▲' : '▼ Manage'}
                  </button>
                  {q.published
                    ? <button className="btn secondary sm" onClick={() => setPub(q.id, false)}>Unpublish</button>
                    : <button className="btn sm" onClick={() => setPub(q.id, true)}>Publish</button>}
                  {q.marksReleased
                    ? <button className="btn secondary sm" onClick={() => setMarks(q.id, false)}>🔒 Hide</button>
                    : <button className="btn sm" onClick={() => setMarks(q.id, true)} disabled={!q.published}>📊 Release</button>}
                  <a className="btn ghost sm" href={`/api/quizzes/${q.id}/marks.csv`} target="_blank" rel="noreferrer">⬇️ CSV</a>
                  <button className="btn ghost sm" onClick={() => duplicateQuiz(q.id)}>📄 Copy</button>
                  <a className="btn ghost sm" href={`/teacher/quiz/${q.id}/submissions`}>📋 Submissions</a>
                  <button className="btn purple sm" onClick={() => setLeaderboardQuiz(q)}>🏆</button>
                  <button className="btn danger sm" onClick={() => deleteQuiz(q.id)}>🗑️</button>
                </div>
              </div>

              {expandedQuiz === q.id && q.questions?.length > 0 && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <h4 style={{ marginBottom: 12 }}>⚖️ Question Points</h4>
                  <PointsEditor quizId={q.id} questions={q.questions}
                    onSaved={pts => setQuizzes(quizzes.map(quiz => quiz.id === q.id
                      ? { ...quiz, questions: quiz.questions.map(qq => ({ ...qq, points: pts[qq.id]??qq.points })), totalPoints: Object.values(pts).reduce((s,v)=>s+v,0) }
                      : quiz))} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── RESULTS TAB ── */}
      {tab === 'results' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ margin: 0 }}>Student Results</h3>
            <div className="row nowrap">
              <button className="btn secondary" onClick={loadResults}>↺ Refresh</button>
              <a className="btn" href={`/api/attempts/results.csv?classId=${classId}`} target="_blank" rel="noreferrer">⬇️ CSV</a>
            </div>
          </div>
          {results.length === 0 && <div className="empty-state"><div className="icon">📊</div><p>No submitted attempts yet.</p></div>}
          {results.length > 0 && (
            <div className="card flush">
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr><th>Student</th><th>Quiz</th><th>Score</th><th>%</th><th>Marks</th><th>Submitted</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500 }}>{r.studentName}</td>
                        <td style={{ fontSize: '.82rem' }}>{r.quizTitle}</td>
                        <td>
                          <strong>{r.score}</strong>/{r.totalPoints}
                          {r.scoreOverride !== null && r.scoreOverride !== undefined && <span className="badge warning" style={{ marginLeft: 6 }}>edited</span>}
                        </td>
                        <td>
                          {r.totalPoints > 0
                            ? <span className={`badge ${(r.score/r.totalPoints)>=.7 ? 'success' : 'danger'}`}>{Math.round((r.score/r.totalPoints)*100)}%</span>
                            : '—'}
                        </td>
                        <td><span className={`badge ${r.marksReleased ? 'success' : ''}`}>{r.marksReleased ? 'Released' : 'Hidden'}</span></td>
                        <td style={{ fontSize: '.8rem', color: 'var(--text3)' }}>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '—'}</td>
                        <td><button className="btn ghost xs" onClick={() => setOverrideAttempt(r)}>✏️ Edit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}