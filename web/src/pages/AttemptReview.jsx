import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { loadAuth } from '../lib/auth'

function pretty(v) {
  if (v === null || v === undefined) return <em style={{ color: 'var(--text3)' }}>No answer</em>
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export default function AttemptReview() {
  const { attemptId } = useParams()
  const auth = loadAuth()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [overrideScore, setOverrideScore] = useState('')
  const [overrideNote, setOverrideNote] = useState('')
  const [overrideSaving, setOverrideSaving] = useState(false)
  const [overrideMsg, setOverrideMsg] = useState('')

  async function load() {
    setErr('')
    try {
      const d = await api(`/api/attempts/${attemptId}/review`, { token: auth.token })
      setData(d)
      setOverrideScore(String(d.attempt.score))
      setOverrideNote(d.attempt.overrideNote || '')
    } catch (e) { setErr(e.message) }
  }

  async function saveOverride() {
    setOverrideSaving(true); setOverrideMsg('')
    try {
      await api(`/api/attempts/${attemptId}/override`, {
        token: auth.token, method: 'PATCH',
        body: { scoreOverride: Number(overrideScore), overrideNote }
      })
      setOverrideMsg('✓ Score override saved.')
      await load()
    } catch (e) { setOverrideMsg('Error: ' + e.message) }
    setOverrideSaving(false)
  }

  useEffect(() => { if (auth?.token) load() }, [attemptId])

  if (!auth?.token) return <div className="card">Please login.</div>
  if (err) return <div><div className="banner error">{err}</div></div>
  if (!data) return <div style={{ textAlign: 'center', padding: 60 }}><span className="spinner dark" style={{ width: 32, height: 32 }}></span></div>

  const pct = data.attempt.totalPoints > 0 ? Math.round((data.attempt.score / data.attempt.totalPoints) * 100) : 0
  const passed = pct >= 70
  const backPath = `/teacher/quiz/${data.quiz.id}/submissions`

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to={backPath} style={{ fontSize: '.82rem', color: 'var(--text3)', textDecoration: 'none' }} className="no-print">← Back to Submissions</Link>
        <button className="btn secondary sm no-print" onClick={() => window.print()}>🖨️ Print / Save PDF</button>
      </div>

      {/* Header */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ marginBottom: 6 }}>{data.student.displayName}</h2>
            <p style={{ marginBottom: 10 }}>{data.quiz.title} · <span className="badge accent">{data.quiz.subject}</span></p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: "'DM Serif Display',serif", color: passed ? 'var(--success)' : 'var(--danger)' }}>
                {pct}%
              </span>
              <span style={{ color: 'var(--text2)' }}>{data.attempt.score} / {data.attempt.totalPoints} pts</span>
              <span className={`badge ${passed ? 'success' : 'danger'}`}>{passed ? '✓ Passed' : '✗ Failed'}</span>
              {data.attempt.submittedAt && <span className="badge">{new Date(data.attempt.submittedAt).toLocaleString()}</span>}
            </div>
          </div>

          {/* Grade override */}
          <div className="no-print" style={{ background: 'var(--bg3)', borderRadius: 10, padding: '14px 16px', minWidth: 260 }}>
            <div style={{ fontWeight: 600, fontSize: '.85rem', marginBottom: 10 }}>✏️ Override Grade</div>
            {overrideMsg && <div className={`banner ${overrideMsg.startsWith('Error') ? 'error' : 'success'}`} style={{ marginBottom: 8, padding: '6px 10px', fontSize: '.8rem' }}>{overrideMsg}</div>}
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="small">Score</label>
                <input className="input" type="number" min="0" max={data.attempt.totalPoints}
                  value={overrideScore} onChange={e => setOverrideScore(e.target.value)} />
              </div>
              <div style={{ alignSelf: 'flex-end' }}>
                <button className="btn sm" onClick={saveOverride} disabled={overrideSaving}>
                  {overrideSaving ? <span className="spinner"></span> : 'Save'}
                </button>
              </div>
            </div>
            <input className="input" value={overrideNote} onChange={e => setOverrideNote(e.target.value)}
              placeholder="Reason (e.g. short answer accepted)…" style={{ fontSize: '.82rem' }} />
          </div>
        </div>
      </div>

      {/* Answer items */}
      {data.items.map((it, idx) => {
        const correct = JSON.stringify(it.studentAnswer) === JSON.stringify(it.correctAnswer)
        const noAnswer = it.studentAnswer === undefined || it.studentAnswer === null || it.studentAnswer === ''
        return (
          <div key={it.questionId} className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${noAnswer ? 'var(--text3)' : correct ? 'var(--success)' : 'var(--danger)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Q{idx + 1}</strong>
                <span className="badge">{it.type}</span>
                <span className="badge accent">{it.points} pt{it.points !== 1 ? 's' : ''}</span>
              </div>
              <span className={`badge ${noAnswer ? '' : correct ? 'success' : 'danger'}`}>
                {noAnswer ? 'No answer' : correct ? '✓ Correct' : '✗ Incorrect'}
              </span>
            </div>

            <div style={{ fontSize: '.95rem', lineHeight: 1.7, marginBottom: 12, whiteSpace: 'pre-wrap' }}>{it.prompt}</div>

            {it.choices && (
              <div style={{ marginBottom: 12 }}>
                {it.choices.map((c, i) => {
                  const val = c.split(')')[0].trim()
                  const isStudentChoice = Array.isArray(it.studentAnswer)
                    ? it.studentAnswer.includes(val)
                    : String(it.studentAnswer) === val
                  const isCorrect = Array.isArray(it.correctAnswer)
                    ? it.correctAnswer.includes(val)
                    : String(it.correctAnswer) === val
                  return (
                    <div key={i} style={{
                      padding: '8px 12px', borderRadius: 6, marginBottom: 4, fontSize: '.875rem',
                      background: isCorrect ? 'var(--success-bg)' : isStudentChoice ? 'var(--danger-bg)' : 'var(--bg3)',
                      border: `1px solid ${isCorrect ? 'var(--success-border)' : isStudentChoice ? 'var(--danger-border)' : 'var(--border)'}`,
                      display: 'flex', gap: 8, alignItems: 'center'
                    }}>
                      {isCorrect && <span>✓</span>}
                      {isStudentChoice && !isCorrect && <span>✗</span>}
                      {!isCorrect && !isStudentChoice && <span style={{ opacity: .3 }}>○</span>}
                      {c}
                    </div>
                  )
                })}
              </div>
            )}

            {!it.choices && (
              <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Student's Answer</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '.9rem', color: noAnswer ? 'var(--text3)' : 'var(--text)' }}>{pretty(it.studentAnswer)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 200, background: 'var(--success-bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--success-border)' }}>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--success)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Correct Answer</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '.9rem' }}>{pretty(it.correctAnswer)}</div>
                </div>
              </div>
            )}

            {it.explanation && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(32,85,212,.06)', borderRadius: 6, fontSize: '.82rem', color: 'var(--text2)', borderLeft: '2px solid var(--accent)' }}>
                <strong>Explanation:</strong> {it.explanation}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
