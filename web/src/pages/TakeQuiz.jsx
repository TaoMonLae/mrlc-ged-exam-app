import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { loadAuth } from '../lib/auth'

const SUBJ_COLOR = { RLA: '#2563eb', MATH: '#059669', SCIENCE: '#d97706', SOCIAL_STUDIES: '#7c3aed' }

export default function TakeQuiz() {
  const { id } = useParams()
  const auth = loadAuth()
  const [quiz, setQuiz] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [answers, setAnswers] = useState({})
  const [err, setErr] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [warning, setWarning] = useState('')
  const [activePassage, setActivePassage] = useState(null)
  const submitRef = useRef(false)
  const attemptRef = useRef(null)   // always has latest attempt
  const answersRef = useRef({})     // always has latest answers for auto-submit

  // ── Load quiz + start/resume attempt ──────────────────────────────────
  useEffect(() => {
    if (!auth?.token) return
    ;(async () => {
      try {
        const q = await api(`/api/quizzes/${id}/student`, { token: auth.token })
        setQuiz(q.quiz)
        const firstWithPassage = q.quiz.questions.find(qq => qq.passage)
        if (firstWithPassage) setActivePassage(firstWithPassage.passage)

        const a = await api('/api/attempts/start', { token: auth.token, method: 'POST', body: { quizId: id } })
        const att = a.attempt
        setAttempt(att)
        attemptRef.current = att

        // Use server-authoritative remaining time
        if (typeof a.serverRemainingSec === 'number') {
          setSecondsLeft(a.serverRemainingSec)
        }

        if (a.expired && att?.status === 'SUBMITTED') {
          setWarning('⏱️ Time expired — your attempt was auto-submitted.')
        }

        const saved = JSON.parse(att.answersJson || '{}')
        setAnswers(saved)
        answersRef.current = saved
      } catch (e) { setErr(e.message) }
    })()
  }, [id])

  // ── Countdown (client-side tick, re-synced with server every 30s) ─────
  useEffect(() => {
    if (secondsLeft === null) return
    if (secondsLeft <= 0) {
      if (!submitRef.current) doSubmit()
      return
    }
    const tick = setInterval(() => setSecondsLeft(s => {
      if (s <= 1) { clearInterval(tick); return 0 }
      return s - 1
    }), 1000)
    return () => clearInterval(tick)
  }, [secondsLeft === null ? null : Math.floor(secondsLeft / 30)]) // restart effect only on 30s boundaries

  // Separate effect for warnings triggered by exact secondsLeft values
  useEffect(() => {
    if (secondsLeft === 300) showWarn('⏰ 5 minutes remaining!')
    if (secondsLeft === 60)  showWarn('⚠️ Only 1 minute left!')
    if (secondsLeft === 0 && !submitRef.current) doSubmit()
  }, [secondsLeft])

  // ── Server time sync every 30 seconds ────────────────────────────────
  useEffect(() => {
    if (!attempt?.id || secondsLeft === null) return
    const syncInterval = setInterval(async () => {
      try {
        const t = await api(`/api/attempts/${attempt.id}/time`, { token: auth.token })
        if (t.status === 'SUBMITTED') {
          // Already submitted server-side (e.g. tab was left open)
          if (!submitRef.current) {
            submitRef.current = true
            setResult({ score: 0, totalPoints: 0, marksReleased: false, autoExpired: true })
          }
          return
        }
        // Drift correction: trust server if diff > 5s
        setSecondsLeft(prev => {
          const diff = Math.abs((prev || 0) - t.remainingSec)
          return diff > 5 ? t.remainingSec : prev
        })
      } catch {}
    }, 30000)
    return () => clearInterval(syncInterval)
  }, [attempt?.id, secondsLeft !== null])

  function showWarn(m) { setWarning(m); setTimeout(() => setWarning(''), 5000) }

  const timeLabel = useMemo(() => {
    if (secondsLeft === null) return '--:--'
    const s = Math.max(0, secondsLeft)
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }, [secondsLeft])

  const timerColor = secondsLeft !== null && secondsLeft < 60 ? 'var(--danger)'
    : secondsLeft !== null && secondsLeft < 300 ? 'var(--warning)' : 'var(--text)'

  // ── Autosave ──────────────────────────────────────────────────────────
  const autosave = useCallback(async (next) => {
    setAnswers(next)
    answersRef.current = next
    if (!attemptRef.current) return
    try {
      const res = await api(`/api/attempts/${attemptRef.current.id}/save`, {
        token: auth.token, method: 'PATCH', body: { answers: next }
      })
      // Server says time expired during save → auto submit
      if (res.expired && res.autoSubmitted) {
        if (!submitRef.current) {
          submitRef.current = true
          setResult({ score: res.attempt?.score ?? 0, totalPoints: res.totalPoints ?? 0, marksReleased: res.marksReleased ?? false })
        }
      }
      if (typeof res.serverRemainingSec === 'number') {
        setSecondsLeft(prev => {
          const diff = Math.abs((prev || 0) - res.serverRemainingSec)
          return diff > 5 ? res.serverRemainingSec : prev
        })
      }
    } catch {}
  }, [auth?.token])

  // ── Submit ─────────────────────────────────────────────────────────────
  async function doSubmit() {
    if (submitRef.current) return
    submitRef.current = true
    setIsSubmitting(true); setErr('')
    try {
      const att = attemptRef.current
      if (!att) throw new Error('No active attempt')
      const d = await api(`/api/attempts/${att.id}/submit`, {
        token: auth.token, method: 'POST', body: { answers: answersRef.current }
      })
      setResult({ score: d.attempt.score, totalPoints: d.totalPoints, marksReleased: d.marksReleased })
    } catch (e) {
      setErr(e.message); submitRef.current = false; setIsSubmitting(false)
    }
  }

  const answeredCount = quiz ? quiz.questions.filter(q => {
    const a = answers[q.id]
    return a !== undefined && a !== '' && !(Array.isArray(a) && a.length === 0)
  }).length : 0

  const hasPassages = quiz?.questions?.some(q => q.passage)

  if (!auth || auth.type !== 'STUDENT') return <div className="card">Please login as a student.</div>
  if (err) return (
    <div>
      <div className="banner error" style={{ marginBottom: 16 }}>{err}</div>
      <Link to="/student" className="btn secondary">← Back to Home</Link>
    </div>
  )
  if (!quiz || !attempt) return (
    <div className="empty-state" style={{ padding: 80 }}>
      <span className="spinner dark" style={{ width: 32, height: 32 }}></span>
      <p style={{ marginTop: 16 }}>Loading quiz…</p>
    </div>
  )

  // ── Result screen ─────────────────────────────────────────────────────
  if (result) {
    if (result.autoExpired) {
      return (
        <div style={{ maxWidth: 480, margin: '48px auto' }}>
          <div className="card" style={{ textAlign: 'center', padding: '40px 32px' }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>⏱️</div>
            <h2>Time Expired</h2>
            <p style={{ marginBottom: 24 }}>Your quiz was automatically submitted when time ran out.</p>
            <Link to="/student" className="btn full lg">← Back to Home</Link>
          </div>
        </div>
      )
    }
    const pct = result.totalPoints > 0 ? Math.round((result.score / result.totalPoints) * 100) : 0
    const passed = pct >= 70
    return (
      <div style={{ maxWidth: 480, margin: '48px auto' }}>
        <div className="card" style={{ textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ fontSize: 72, marginBottom: 12 }}>{passed ? '🎉' : '📚'}</div>
          <h2 style={{ marginBottom: 6 }}>{passed ? 'Excellent Work!' : 'Good Effort!'}</h2>
          <p style={{ marginBottom: 28 }}>{quiz.title}</p>
          <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: 28, marginBottom: 28 }}>
            {result.marksReleased ? (
              <>
                <div style={{ fontSize: 52, fontWeight: 700, color: passed ? 'var(--success)' : 'var(--danger)', fontFamily: "'DM Serif Display', serif" }}>{pct}%</div>
                <div style={{ color: 'var(--text2)', marginTop: 6 }}>{result.score} / {result.totalPoints} points</div>
                <div className={`badge ${passed ? 'success' : 'danger'}`} style={{ marginTop: 12 }}>{passed ? '✓ Passed' : '✗ Needs improvement'}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>Quiz Submitted!</div>
                <div style={{ color: 'var(--text3)', marginTop: 6, fontSize: '.875rem' }}>Your teacher will release marks soon.</div>
              </>
            )}
          </div>
          <Link to="/student" className="btn full lg">← Back to Home</Link>
        </div>
      </div>
    )
  }

  const accentColor = SUBJ_COLOR[quiz.subject] || 'var(--accent)'

  return (
    <div>
      {/* Sticky header */}
      <div className="quiz-sticky-header" style={{ marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1060, margin: '0 auto' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '.95rem', fontFamily: "'DM Serif Display',serif" }}>{quiz.title}</div>
            <div style={{ fontSize: '.78rem', color: 'var(--text3)' }}>{quiz.subject} · {quiz.className}</div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Answered</div>
              <div style={{ fontWeight: 700 }}>{answeredCount}/{quiz.questions.length}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Time</div>
              <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '1.1rem', color: timerColor }}>{timeLabel}</div>
            </div>
          </div>
        </div>
        <div className="progress-bar" style={{ marginTop: 8, maxWidth: 1060, margin: '8px auto 0' }}>
          <div className="progress-bar-fill" style={{ width: `${quiz.questions.length ? (answeredCount / quiz.questions.length) * 100 : 0}%`, background: accentColor }} />
        </div>
        {warning && <div className="banner warning" style={{ marginTop: 8, maxWidth: 1060, margin: '8px auto 0' }}>{warning}</div>}
      </div>

      {/* Passage selector bar */}
      {hasPassages && (
        <div style={{ marginBottom: 14, marginTop: 16 }}>
          <div className="card inset" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text3)', marginBottom: 8 }}>📄 READING PASSAGES</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[...new Map(quiz.questions.filter(q => q.passage).map(q => [q.passage.id, q.passage])).values()].map(p => (
                <button key={p.id} onClick={() => setActivePassage(activePassage?.id === p.id ? null : p)}
                  className={`btn sm ${activePassage?.id === p.id ? '' : 'secondary'}`}>
                  {p.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={`quiz-layout ${activePassage ? 'has-passage' : ''}`} style={{ marginTop: 16 }}>
        {/* Passage panel */}
        {activePassage && (
          <div className="passage-panel">
            <div className="card" style={{ borderLeft: `4px solid ${accentColor}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Reading Passage</div>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{activePassage.title}</h3>
                </div>
                <button className="btn ghost sm icon" onClick={() => setActivePassage(null)}>✕</button>
              </div>
              <div style={{ fontSize: '.875rem', lineHeight: 1.85, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{activePassage.content}</div>
            </div>
          </div>
        )}

        {/* Questions */}
        <div>
          {quiz.questions.map((q, idx) => {
            const answered = answers[q.id] !== undefined && answers[q.id] !== '' && !(Array.isArray(answers[q.id]) && answers[q.id].length === 0)
            return (
              <div key={q.id} className="card" style={{ marginBottom: 14, borderLeft: `3px solid ${answered ? 'var(--success)' : 'var(--border)'}` }}>
                {q.passage && (
                  <button className="btn ghost xs" style={{ marginBottom: 8 }} onClick={() => setActivePassage(activePassage?.id === q.passage.id ? null : q.passage)}>
                    📄 {q.passage.title} {activePassage?.id === q.passage.id ? '(hide)' : '(read)'}
                  </button>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 10 }}>
                  <span style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Question {idx + 1} of {quiz.questions.length}
                  </span>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <span className="badge">{q.type}</span>
                    {q.points > 1 && <span className="badge accent">{q.points} pts</span>}
                    {answered && <span className="badge success">✓</span>}
                  </div>
                </div>
                <div style={{ fontSize: '.95rem', lineHeight: 1.7, marginBottom: 14, whiteSpace: 'pre-wrap' }}>{q.prompt}</div>

                {q.type === 'MCQ' && (
                  <div>{q.choices?.map((c, i) => {
                    const val = c.split(')')[0].trim()
                    const checked = answers[q.id] === val
                    return (
                      <label key={i} className={`answer-option ${checked ? 'selected' : ''}`} onClick={() => autosave({ ...answers, [q.id]: val })}>
                        <input type="radio" name={q.id} checked={checked} onChange={() => {}} />
                        <span style={{ fontSize: '.9rem' }}>{c}</span>
                      </label>
                    )
                  })}</div>
                )}

                {q.type === 'MULTI_SELECT' && (
                  <div>
                    <div style={{ fontSize: '.78rem', color: 'var(--text3)', marginBottom: 8, fontWeight: 600 }}>SELECT ALL THAT APPLY</div>
                    {q.choices?.map((c, i) => {
                      const val = c.split(')')[0].trim()
                      const current = Array.isArray(answers[q.id]) ? answers[q.id] : []
                      const checked = current.includes(val)
                      return (
                        <label key={i} className={`answer-option ${checked ? 'selected' : ''}`}
                          onClick={() => { const next = checked ? current.filter(x => x !== val) : [...current, val]; autosave({ ...answers, [q.id]: next }) }}>
                          <input type="checkbox" checked={checked} onChange={() => {}} />
                          <span style={{ fontSize: '.9rem' }}>{c}</span>
                        </label>
                      )
                    })}
                  </div>
                )}

                {(q.type === 'SHORT_ANSWER' || q.type === 'NUMERIC') && (
                  <input className="input" value={answers[q.id] || ''}
                    onChange={e => autosave({ ...answers, [q.id]: e.target.value })}
                    type={q.type === 'NUMERIC' ? 'number' : 'text'}
                    placeholder={q.type === 'NUMERIC' ? 'Enter a number…' : 'Type your answer…'}
                    style={{ maxWidth: 400 }} />
                )}

                {q.type === 'REORDER' && (
                  <div>
                    <div style={{ fontSize: '.8rem', color: 'var(--text3)', marginBottom: 6 }}>Enter the correct order as comma-separated numbers (e.g. 2,1,3,4)</div>
                    <input className="input" value={answers[q.id] || ''} onChange={e => autosave({ ...answers, [q.id]: e.target.value })} placeholder="e.g. 2,1,3,4" style={{ maxWidth: 300 }} />
                  </div>
                )}
              </div>
            )
          })}

          {/* Submit bar */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: 'var(--bg3)' }}>
            <div style={{ fontSize: '.875rem', color: answeredCount < quiz.questions.length ? 'var(--warning)' : 'var(--success)', fontWeight: 500 }}>
              {answeredCount < quiz.questions.length
                ? `⚠️ ${quiz.questions.length - answeredCount} question(s) unanswered`
                : '✅ All questions answered — ready to submit!'}
            </div>
            <div className="row nowrap">
              <Link to="/student" className="btn secondary">← Home</Link>
              <button className="btn lg" onClick={doSubmit} disabled={isSubmitting} style={{ background: accentColor }}>
                {isSubmitting ? <><span className="spinner"></span> Submitting…</> : 'Submit Quiz'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
