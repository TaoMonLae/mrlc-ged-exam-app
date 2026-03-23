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

export default function StudentAttemptReview() {
  const { attemptId } = useParams()
  const auth = loadAuth()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!auth?.token) return
    api(`/api/attempts/${attemptId}/review`, { token: auth.token })
      .then(d => setData(d))
      .catch(e => setErr(e.message))
  }, [attemptId])

  if (!auth?.token) return <div className="card">Please login.</div>
  if (err) return (
    <div>
      <div className="banner error" style={{ marginBottom: 14 }}>{err}</div>
      <Link to="/student" className="btn secondary">← Back to Home</Link>
    </div>
  )
  if (!data) return <div style={{ textAlign: 'center', padding: 60 }}><span className="spinner dark" style={{ width: 32, height: 32 }}></span></div>

  const pct = data.attempt.totalPoints > 0 ? Math.round((data.attempt.score / data.attempt.totalPoints) * 100) : 0
  const passed = pct >= 70
  const correct = data.items.filter(it => JSON.stringify(it.studentAnswer) === JSON.stringify(it.correctAnswer)).length

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link to="/student" style={{ fontSize: '.82rem', color: 'var(--text3)', textDecoration: 'none' }}>← Back to Home</Link>
      </div>

      {/* Score card */}
      <div className="card" style={{ textAlign: 'center', padding: '32px 24px', marginBottom: 24 }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>{passed ? '🎉' : '📖'}</div>
        <h2 style={{ marginBottom: 4 }}>{data.quiz.title}</h2>
        <p style={{ marginBottom: 20, color: 'var(--text3)' }}>{data.quiz.subject} · {data.quiz.class?.name}</p>
        <div style={{ display: 'inline-flex', gap: 24, background: 'var(--bg3)', borderRadius: 12, padding: '20px 32px', marginBottom: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.4rem', fontWeight: 700, fontFamily: "'DM Serif Display',serif", color: passed ? 'var(--success)' : 'var(--danger)' }}>{pct}%</div>
            <div style={{ fontSize: '.8rem', color: 'var(--text3)' }}>{data.attempt.score}/{data.attempt.totalPoints} points</div>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }}></div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.4rem', fontWeight: 700, fontFamily: "'DM Serif Display',serif" }}>{correct}/{data.items.length}</div>
            <div style={{ fontSize: '.8rem', color: 'var(--text3)' }}>Correct answers</div>
          </div>
        </div>
        <div><span className={`badge ${passed ? 'success' : 'danger'}`} style={{ fontSize: '.9rem', padding: '6px 16px' }}>{passed ? '✓ Passed' : '✗ Needs improvement'}</span></div>
      </div>

      <div className="banner info" style={{ marginBottom: 20 }}>
        📊 Your teacher has released the marks. Review your answers and the correct answers below.
      </div>

      {/* Answer review */}
      {data.items.map((it, idx) => {
        const correct = JSON.stringify(it.studentAnswer) === JSON.stringify(it.correctAnswer)
        const noAnswer = it.studentAnswer === undefined || it.studentAnswer === null || it.studentAnswer === ''
        return (
          <div key={it.questionId} className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${noAnswer ? 'var(--text3)' : correct ? 'var(--success)' : 'var(--danger)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Question {idx + 1}</strong>
                <span className="badge">{it.type}</span>
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
                      {isCorrect ? <span style={{ color: 'var(--success)' }}>✓</span>
                        : isStudentChoice ? <span style={{ color: 'var(--danger)' }}>✗</span>
                        : <span style={{ opacity: .3 }}>○</span>}
                      {c}
                      {isStudentChoice && isCorrect && <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: 'var(--success)', fontWeight: 600 }}>Your answer ✓</span>}
                      {isStudentChoice && !isCorrect && <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: 'var(--danger)', fontWeight: 600 }}>Your answer</span>}
                      {!isStudentChoice && isCorrect && <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: 'var(--success)', fontWeight: 600 }}>Correct answer</span>}
                    </div>
                  )
                })}
              </div>
            )}

            {!it.choices && (
              <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>YOUR ANSWER</div>
                  <div style={{ fontFamily: 'monospace' }}>{pretty(it.studentAnswer)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 200, background: 'var(--success-bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--success-border)' }}>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>CORRECT ANSWER</div>
                  <div style={{ fontFamily: 'monospace' }}>{pretty(it.correctAnswer)}</div>
                </div>
              </div>
            )}

            {it.explanation && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(32,85,212,.06)', borderRadius: 6, fontSize: '.82rem', borderLeft: '2px solid var(--accent)' }}>
                <strong>Explanation:</strong> {it.explanation}
              </div>
            )}
          </div>
        )
      })}

      <div style={{ marginTop: 24 }}>
        <Link to="/student" className="btn secondary">← Back to Home</Link>
      </div>
    </div>
  )
}
