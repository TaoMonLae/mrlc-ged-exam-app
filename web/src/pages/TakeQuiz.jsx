import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { loadAuth } from '../lib/auth'

const SUBJ_COLOR = { RLA: '#2563eb', MATH: '#059669', SCIENCE: '#d97706', SOCIAL_STUDIES: '#7c3aed' }
const SUBJ_LABEL = { RLA: 'Reading Language Arts', MATH: 'Mathematics', SCIENCE: 'Science', SOCIAL_STUDIES: 'Social Studies' }
const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

export default function TakeQuiz() {
  const { id } = useParams()
  const auth = loadAuth()

  // ── Core quiz state ────────────────────────────────────────────
  const [quiz, setQuiz] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [answers, setAnswers] = useState({})
  const [err, setErr] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [warning, setWarning] = useState('')
  const submitRef = useRef(false)
  const attemptRef = useRef(null)
  const answersRef = useRef({})

  // ── Typeform UI state ──────────────────────────────────────────
  const [showIntro, setShowIntro] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [slideDir, setSlideDir] = useState('up')
  const [slideKey, setSlideKey] = useState(0)
  const [passageOpen, setPassageOpen] = useState(false)
  const [activePassage, setActivePassage] = useState(null)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const currentIdxRef = useRef(0)

  // Keep body scroll locked when overlay is active
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // ── Load quiz + start/resume attempt ──────────────────────────
  useEffect(() => {
    if (!auth?.token) return
    ;(async () => {
      try {
        const q = await api(`/api/quizzes/${id}/student`, { token: auth.token })
        setQuiz(q.quiz)

        const a = await api('/api/attempts/start', { token: auth.token, method: 'POST', body: { quizId: id } })
        const att = a.attempt
        setAttempt(att)
        attemptRef.current = att

        if (typeof a.serverRemainingSec === 'number') {
          setSecondsLeft(a.serverRemainingSec)
        }
        if (a.expired && att?.status === 'SUBMITTED') {
          setWarning('Time expired — your attempt was auto-submitted.')
        }

        const saved = JSON.parse(att.answersJson || '{}')
        setAnswers(saved)
        answersRef.current = saved

        // Skip intro if already in-progress with saved answers
        if (att.status === 'IN_PROGRESS' && Object.keys(saved).length > 0) {
          setShowIntro(false)
        }
      } catch (e) { setErr(e.message) }
    })()
  }, [id])

  // ── Countdown ─────────────────────────────────────────────────
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
  }, [secondsLeft === null ? null : Math.floor(secondsLeft / 30)])

  useEffect(() => {
    if (secondsLeft === 300) showWarn('5 minutes remaining!')
    if (secondsLeft === 60)  showWarn('Only 1 minute left!')
    if (secondsLeft === 0 && !submitRef.current) doSubmit()
  }, [secondsLeft])

  // ── Server time sync every 30s ────────────────────────────────
  useEffect(() => {
    if (!attempt?.id || secondsLeft === null) return
    const syncInterval = setInterval(async () => {
      try {
        const t = await api(`/api/attempts/${attempt.id}/time`, { token: auth.token })
        if (t.status === 'SUBMITTED') {
          if (!submitRef.current) {
            submitRef.current = true
            setResult({ score: 0, totalPoints: 0, marksReleased: false, autoExpired: true })
          }
          return
        }
        setSecondsLeft(prev => {
          const diff = Math.abs((prev || 0) - t.remainingSec)
          return diff > 5 ? t.remainingSec : prev
        })
      } catch {}
    }, 30000)
    return () => clearInterval(syncInterval)
  }, [attempt?.id, secondsLeft !== null])

  function showWarn(m) { setWarning(m); setTimeout(() => setWarning(''), 6000) }

  const timeLabel = useMemo(() => {
    if (secondsLeft === null) return '--:--'
    const s = Math.max(0, secondsLeft)
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }, [secondsLeft])

  const timerClass = secondsLeft !== null && secondsLeft < 60 ? 'danger'
    : secondsLeft !== null && secondsLeft < 300 ? 'warn' : ''

  // ── Autosave ──────────────────────────────────────────────────
  const autosave = useCallback(async (next) => {
    setAnswers(next)
    answersRef.current = next
    if (!attemptRef.current) return
    try {
      const res = await api(`/api/attempts/${attemptRef.current.id}/save`, {
        token: auth.token, method: 'PATCH', body: { answers: next }
      })
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

  // ── Submit ────────────────────────────────────────────────────
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

  // ── Navigation ────────────────────────────────────────────────
  function goTo(idx, dir = 'up') {
    if (!quiz || idx < 0 || idx >= quiz.questions.length) return
    currentIdxRef.current = idx
    setSlideDir(dir)
    setCurrentIdx(idx)
    setSlideKey(k => k + 1)
    const q = quiz.questions[idx]
    if (q.passage) {
      setActivePassage(q.passage)
      // Auto-open passage panel on desktop if question has one
      if (window.innerWidth >= 760) setPassageOpen(true)
    } else {
      setPassageOpen(false)
      setActivePassage(null)
    }
  }

  // Keep ref updated so keyboard handler always has latest idx
  useEffect(() => { currentIdxRef.current = currentIdx }, [currentIdx])

  // ── Keyboard navigation ───────────────────────────────────────
  useEffect(() => {
    if (showIntro || result || showSubmitConfirm || !quiz) return

    function advance() {
      const nIdx = currentIdxRef.current + 1
      if (nIdx < quiz.questions.length) goTo(nIdx, 'up')
      else setShowSubmitConfirm(true)
    }
    function retreat() {
      const pIdx = currentIdxRef.current - 1
      if (pIdx >= 0) goTo(pIdx, 'down')
    }

    function handleKey(e) {
      const tag = e.target.tagName
      const isText = tag === 'INPUT' || tag === 'TEXTAREA'

      if (isText) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); advance() }
        return
      }

      if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); advance(); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); retreat(); return }
      if (e.key === 'Escape') { setPassageOpen(false); return }

      // Letter keys A–H → select MCQ/MULTI_SELECT option
      if (/^[a-hA-H]$/.test(e.key)) {
        const q = quiz.questions[currentIdxRef.current]
        const optIdx = e.key.toUpperCase().charCodeAt(0) - 65
        if (q?.type === 'MCQ' && optIdx < (q.choices?.length ?? 0)) {
          const val = q.choices[optIdx].split(')')[0].trim()
          autosave({ ...answersRef.current, [q.id]: val })
          setTimeout(advance, 500)
        } else if (q?.type === 'MULTI_SELECT' && optIdx < (q.choices?.length ?? 0)) {
          const val = q.choices[optIdx].split(')')[0].trim()
          const current = Array.isArray(answersRef.current[q.id]) ? answersRef.current[q.id] : []
          const next = current.includes(val) ? current.filter(x => x !== val) : [...current, val]
          autosave({ ...answersRef.current, [q.id]: next })
        }
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [showIntro, result, showSubmitConfirm, quiz, autosave])

  // ── Computed ──────────────────────────────────────────────────
  const answeredCount = quiz ? quiz.questions.filter(q => {
    const a = answers[q.id]
    return a !== undefined && a !== '' && !(Array.isArray(a) && a.length === 0)
  }).length : 0

  // ── Guards ────────────────────────────────────────────────────
  if (!auth || auth.type !== 'STUDENT') return (
    <div className="tf-overlay" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ marginBottom: 16 }}>Please login as a student.</p>
        <Link to="/" className="btn">Go to Login</Link>
      </div>
    </div>
  )

  if (err) return (
    <div className="tf-overlay" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: '0 20px' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>⚠️</div>
        <div className="banner error" style={{ marginBottom: 20 }}>{err}</div>
        <Link to="/student" className="btn">← Back to Home</Link>
      </div>
    </div>
  )

  if (!quiz || !attempt) return (
    <div className="tf-overlay" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <span className="spinner dark" style={{ width: 40, height: 40 }}></span>
        <p style={{ marginTop: 16, color: 'var(--text3)', fontSize: '.9rem' }}>Loading quiz…</p>
      </div>
    </div>
  )

  const accentColor = SUBJ_COLOR[quiz.subject] || 'var(--accent)'
  const progressPct = quiz.questions.length ? (answeredCount / quiz.questions.length) * 100 : 0

  // ── Result screen ─────────────────────────────────────────────
  if (result) {
    if (result.autoExpired) return (
      <div className="tf-overlay" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="tf-center" style={{ position: 'relative' }}>
          <div style={{ fontSize: 72, marginBottom: 20 }}>⏱️</div>
          <h1 style={{ marginBottom: 12 }}>Time's Up!</h1>
          <p style={{ fontSize: '1.05rem', color: 'var(--text2)', marginBottom: 36, maxWidth: 360 }}>
            Your quiz was automatically submitted when the timer expired.
          </p>
          <Link to="/student" className="btn lg" style={{ minWidth: 180 }}>← Back to Home</Link>
        </div>
      </div>
    )

    const scorePct = result.totalPoints > 0 ? Math.round((result.score / result.totalPoints) * 100) : 0
    const passed = scorePct >= 70
    return (
      <div className="tf-overlay" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="tf-center" style={{ position: 'relative' }}>
          <div className="tf-accent-bar" style={{ background: accentColor, marginBottom: 36 }}></div>
          <div style={{ fontSize: 68, marginBottom: 16 }}>{passed ? '🎉' : '📚'}</div>
          <h1 style={{ marginBottom: 10, fontSize: 'clamp(1.6rem,4vw,2.2rem)' }}>
            {passed ? 'Well done!' : 'Good effort!'}
          </h1>
          <p style={{ fontSize: '1rem', color: 'var(--text2)', marginBottom: 36, maxWidth: 380 }}>
            You've completed <strong>{quiz.title}</strong>
          </p>

          {result.marksReleased ? (
            <div style={{ background: 'var(--bg3)', borderRadius: 16, padding: '28px 40px', marginBottom: 32, border: '1px solid var(--border)', minWidth: 220 }}>
              <div style={{ fontSize: 58, fontWeight: 800, color: passed ? 'var(--success)' : 'var(--danger)', fontFamily: "'DM Serif Display',serif", lineHeight: 1 }}>
                {scorePct}%
              </div>
              <div style={{ color: 'var(--text2)', marginTop: 8, fontSize: '.9rem' }}>
                {result.score} / {result.totalPoints} points
              </div>
              <div style={{ marginTop: 14 }}>
                <span className={`badge ${passed ? 'success' : 'danger'}`} style={{ fontSize: '.85rem', padding: '5px 14px' }}>
                  {passed ? '✓ Passed' : '✗ Needs improvement'}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg3)', borderRadius: 16, padding: '28px 40px', marginBottom: 32, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 6 }}>Submitted!</div>
              <div style={{ color: 'var(--text3)', fontSize: '.875rem' }}>Your teacher will release marks soon.</div>
            </div>
          )}

          <Link to="/student" className="btn lg" style={{ background: accentColor, minWidth: 180 }}>
            ← Back to Home
          </Link>
        </div>
      </div>
    )
  }

  // ── Intro screen ──────────────────────────────────────────────
  if (showIntro) return (
    <div className="tf-overlay" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="tf-center" style={{ position: 'relative' }}>
        <div className="tf-accent-bar" style={{ background: accentColor }}></div>

        <div style={{ marginBottom: 16 }}>
          <span className="badge" style={{ background: accentColor + '20', color: accentColor, border: 'none', fontSize: '.78rem', padding: '5px 14px', borderRadius: 20 }}>
            {SUBJ_LABEL[quiz.subject] || quiz.subject}
          </span>
        </div>

        <h1 style={{ fontSize: 'clamp(1.5rem,5vw,2.4rem)', marginBottom: 10, lineHeight: 1.2, maxWidth: 480 }}>
          {quiz.title}
        </h1>
        <p style={{ color: 'var(--text2)', marginBottom: 36, fontSize: '.95rem' }}>{quiz.className}</p>

        <div className="tf-stat-row">
          {[
            ['📝', quiz.questions.length, 'Questions'],
            ['⏱️', `${quiz.timeLimitMin}m`, 'Time limit'],
            ['✏️', answeredCount > 0 ? `${answeredCount}/${quiz.questions.length}` : 'All new', answeredCount > 0 ? 'Saved' : 'Progress'],
          ].map(([icon, val, lbl]) => (
            <div key={lbl} className="tf-stat-box">
              <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
              <div className="s-val">{val}</div>
              <div className="s-lbl">{lbl}</div>
            </div>
          ))}
        </div>

        <button
          className="btn lg"
          onClick={() => setShowIntro(false)}
          style={{ background: accentColor, minWidth: 200, fontSize: '1rem' }}
          autoFocus
        >
          {answeredCount > 0 ? 'Resume Quiz →' : 'Start Quiz →'}
        </button>

        <div style={{ marginTop: 20 }}>
          <Link to="/student" style={{ color: 'var(--text3)', fontSize: '.85rem', textDecoration: 'none' }}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )

  // ── Submit confirmation screen ────────────────────────────────
  if (showSubmitConfirm) {
    const unanswered = quiz.questions.length - answeredCount
    return (
      <div className="tf-overlay" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="tf-center" style={{ position: 'relative' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>📋</div>
          <h2 style={{ marginBottom: 12 }}>Ready to submit?</h2>

          {unanswered > 0 ? (
            <p style={{ color: 'var(--warning)', marginBottom: 32, fontSize: '1rem', fontWeight: 500 }}>
              ⚠️ {unanswered} question{unanswered !== 1 ? 's' : ''} left unanswered.
            </p>
          ) : (
            <p style={{ color: 'var(--success)', marginBottom: 32, fontSize: '1rem', fontWeight: 500 }}>
              ✅ All {quiz.questions.length} questions answered!
            </p>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn secondary" onClick={() => setShowSubmitConfirm(false)}>
              ← Review Answers
            </button>
            <button className="btn lg" onClick={doSubmit} disabled={isSubmitting} style={{ background: accentColor }}>
              {isSubmitting ? <><span className="spinner"></span> Submitting…</> : 'Submit Quiz'}
            </button>
          </div>

          {err && <div className="banner error" style={{ marginTop: 16, maxWidth: 400 }}>{err}</div>}
        </div>
      </div>
    )
  }

  // ── Main quiz screen ──────────────────────────────────────────
  const q = quiz.questions[currentIdx]
  const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '' &&
    !(Array.isArray(answers[q.id]) && answers[q.id].length === 0)

  function handleMCQSelect(questionId, val) {
    autosave({ ...answersRef.current, [questionId]: val })
    setTimeout(() => {
      const nIdx = currentIdxRef.current + 1
      if (nIdx < quiz.questions.length) goTo(nIdx, 'up')
      else setShowSubmitConfirm(true)
    }, 500)
  }

  function goNext() {
    const nIdx = currentIdxRef.current + 1
    if (nIdx < quiz.questions.length) goTo(nIdx, 'up')
    else setShowSubmitConfirm(true)
  }
  function goPrev() {
    const pIdx = currentIdxRef.current - 1
    if (pIdx >= 0) goTo(pIdx, 'down')
  }

  return (
    <div className="tf-overlay">
      {/* ── Progress bar ── */}
      <div className="tf-progress-bar">
        <div className="tf-progress-fill" style={{ width: `${progressPct}%`, background: accentColor }}></div>
      </div>

      {/* ── Header ── */}
      <div className="tf-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            className="btn ghost sm icon"
            onClick={() => setShowIntro(true)}
            title="Back to intro"
            style={{ flexShrink: 0 }}
          >←</button>
          <div style={{ fontWeight: 600, fontSize: '.875rem', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {quiz.title}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <div style={{ fontSize: '.8rem', color: 'var(--text3)', fontWeight: 500 }}>
            {answeredCount}/{quiz.questions.length} answered
          </div>
          <div className={`tf-timer ${timerClass}`}>{timeLabel}</div>
        </div>
      </div>

      {/* ── Body: passage drawer + question ── */}
      <div className="tf-body">
        {/* Passage drawer */}
        {activePassage && (
          <div className={`tf-passage-drawer ${passageOpen ? 'open' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
                Reading Passage
              </div>
              <button className="btn ghost sm icon" onClick={() => setPassageOpen(false)}>✕</button>
            </div>
            <h3 style={{ marginBottom: 16, fontSize: '.95rem', paddingBottom: 10, borderBottom: `3px solid ${accentColor}` }}>
              {activePassage.title}
            </h3>
            <div style={{ fontSize: '.875rem', lineHeight: 1.95, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>
              {activePassage.content}
            </div>
          </div>
        )}

        {/* Question area — adjusts padding when passage is open */}
        <div
          className="tf-question-area"
          style={passageOpen && activePassage ? { paddingLeft: 'calc(min(44%, 480px) + 5%)' } : undefined}
        >
          {/* Animated question slide — key forces re-mount for animation */}
          <div
            key={slideKey}
            className={`tf-slide-${slideDir}`}
            style={{ width: '100%', maxWidth: 720 }}
          >
            {/* Question number */}
            <div className="tf-q-num">
              <span className="num">{String(currentIdx + 1).padStart(2, '0')}</span>
              <span style={{ opacity: .4 }}>→</span>
              <span style={{ opacity: .5, fontWeight: 400 }}>of {quiz.questions.length}</span>
            </div>

            {/* Passage button */}
            {q.passage && (
              <button
                className="btn ghost sm"
                style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => {
                  setActivePassage(q.passage)
                  setPassageOpen(v => !v)
                }}
              >
                📄 {passageOpen ? 'Hide' : 'Read'}: {q.passage.title}
              </button>
            )}

            {/* Question text */}
            <div className="tf-q-text">{q.prompt}</div>

            {/* ── MCQ ── */}
            {q.type === 'MCQ' && (
              <div>
                {q.choices?.map((c, i) => {
                  const val = c.split(')')[0].trim()
                  const label = c.includes(')') ? c.substring(c.indexOf(')') + 1).trim() : c
                  const checked = answers[q.id] === val
                  return (
                    <label
                      key={i}
                      className={`tf-option ${checked ? 'selected' : ''}`}
                      onClick={() => handleMCQSelect(q.id, val)}
                    >
                      <div className="tf-key">{OPTION_KEYS[i]}</div>
                      <div className="tf-option-text">{label}</div>
                      {checked && <div className="tf-option-check">✓</div>}
                    </label>
                  )
                })}
              </div>
            )}

            {/* ── MULTI_SELECT ── */}
            {q.type === 'MULTI_SELECT' && (
              <div>
                <div style={{ fontSize: '.72rem', color: 'var(--text3)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                  Select all that apply
                </div>
                {q.choices?.map((c, i) => {
                  const val = c.split(')')[0].trim()
                  const label = c.includes(')') ? c.substring(c.indexOf(')') + 1).trim() : c
                  const current = Array.isArray(answers[q.id]) ? answers[q.id] : []
                  const checked = current.includes(val)
                  return (
                    <label
                      key={i}
                      className={`tf-option ${checked ? 'selected' : ''}`}
                      style={{ borderRadius: 10 }}
                      onClick={() => {
                        const next = checked ? current.filter(x => x !== val) : [...current, val]
                        autosave({ ...answers, [q.id]: next })
                      }}
                    >
                      <div className="tf-key" style={{ borderRadius: 5 }}>{OPTION_KEYS[i]}</div>
                      <div className="tf-option-text">{label}</div>
                      {checked && <div className="tf-option-check">✓</div>}
                    </label>
                  )
                })}
                <button className="tf-ok-btn" onClick={goNext}>
                  OK <span className="shortcut">↵ Enter</span>
                </button>
              </div>
            )}

            {/* ── SHORT_ANSWER / NUMERIC ── */}
            {(q.type === 'SHORT_ANSWER' || q.type === 'NUMERIC') && (
              <div>
                <input
                  className="tf-input"
                  value={answers[q.id] || ''}
                  onChange={e => autosave({ ...answers, [q.id]: e.target.value })}
                  type={q.type === 'NUMERIC' ? 'number' : 'text'}
                  placeholder={q.type === 'NUMERIC' ? 'Type your number here…' : 'Type your answer here…'}
                  autoFocus
                />
                <button className="tf-ok-btn" onClick={goNext}>
                  OK <span className="shortcut">↵ Enter</span>
                </button>
              </div>
            )}

            {/* ── REORDER ── */}
            {q.type === 'REORDER' && (
              <div>
                <div style={{ fontSize: '.85rem', color: 'var(--text3)', marginBottom: 12, lineHeight: 1.6 }}>
                  Enter the correct sequence as comma-separated numbers (e.g. <code>2,1,3,4</code>)
                </div>
                <input
                  className="tf-input"
                  value={answers[q.id] || ''}
                  onChange={e => autosave({ ...answers, [q.id]: e.target.value })}
                  placeholder="e.g. 2,1,3,4"
                  autoFocus
                />
                <button className="tf-ok-btn" onClick={goNext}>
                  OK <span className="shortcut">↵ Enter</span>
                </button>
              </div>
            )}

            {/* Answered indicator for non-MCQ */}
            {q.type !== 'MCQ' && isAnswered && (
              <div style={{ fontSize: '.8rem', color: 'var(--success)', marginTop: 8, fontWeight: 500 }}>
                ✓ Saved
              </div>
            )}
          </div>

          {/* Warning toast */}
          {warning && <div className="tf-toast">{warning}</div>}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="tf-footer">
        <div style={{ fontSize: '.78rem', color: 'var(--text3)' }}>
          {isAnswered
            ? <span style={{ color: 'var(--success)' }}>✓ Answered</span>
            : <span>Not answered yet</span>
          }
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '.75rem', color: 'var(--text3)' }}>
            Use <kbd style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 4, padding: '1px 5px', fontSize: '.7rem' }}>↑</kbd>
            {' '}<kbd style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 4, padding: '1px 5px', fontSize: '.7rem' }}>↓</kbd>
            {' '}to navigate
          </span>
          <div className="tf-nav-btns">
            <button className="tf-nav-btn" onClick={goPrev} disabled={currentIdx === 0} title="Previous (↑)">▲</button>
            <button
              className="tf-nav-btn"
              onClick={goNext}
              title={currentIdx === quiz.questions.length - 1 ? 'Submit' : 'Next (↓)'}
              style={currentIdx === quiz.questions.length - 1 ? { borderColor: accentColor, color: accentColor } : undefined}
            >
              {currentIdx === quiz.questions.length - 1 ? '✓' : '▼'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
