import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { loadAuth } from '../lib/auth'
import { Link } from 'react-router-dom'

const SUBJ_COLOR = { RLA: '#2563eb', MATH: '#059669', SCIENCE: '#d97706', SOCIAL_STUDIES: '#7c3aed' }
const SUBJ_ICON = { RLA: '📖', MATH: '🔢', SCIENCE: '🔬', SOCIAL_STUDIES: '🌍' }
const SUBJ_CLASS = { RLA: 'subj-rla', MATH: 'subj-math', SCIENCE: 'subj-science', SOCIAL_STUDIES: 'subj-social' }

function LeaderboardView({ quizId, quizTitle }) {
  const auth = loadAuth()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api(`/api/quizzes/${quizId}/leaderboard`, { token: auth.token })
      .then(d => setData(d))
      .catch(e => setErr(e.message))
  }, [quizId])

  const rankEmoji = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`

  if (err) return <div className="banner error">{err}</div>
  if (!data) return <div style={{ textAlign: 'center', padding: 16 }}><span className="spinner dark"></span></div>
  if (data.leaderboard.length === 0) return <p style={{ color: 'var(--text3)', fontSize: '.875rem' }}>No results yet.</p>

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginTop: 8 }}>
      {data.leaderboard.slice(0, 10).map(e => (
        <div key={e.studentId} className="lb-row">
          <div className={`lb-rank ${e.rank <= 3 ? ['gold','silver','bronze'][e.rank-1] : 'other'}`}>{rankEmoji(e.rank)}</div>
          <div style={{ flex: 1, fontWeight: e.rank <= 3 ? 700 : 400 }}>{e.name}</div>
          <div style={{ textAlign: 'right' }}>
            <span className={`badge ${e.pct >= 70 ? 'success' : 'danger'}`}>{e.pct}%</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function StudentHome() {
  const auth = loadAuth()
  const [quizzes, setQuizzes] = useState([])
  const [myResults, setMyResults] = useState([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('quizzes')
  const [lbQuiz, setLbQuiz] = useState(null)

  useEffect(() => {
    if (!auth?.token || auth.type !== 'STUDENT') return
    Promise.all([
      api('/api/quizzes/student-list', { token: auth.token }),
      api('/api/attempts/my-results', { token: auth.token })
    ]).then(([qd, rd]) => { setQuizzes(qd.quizzes); setMyResults(rd.results) })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (!auth || auth.type !== 'STUDENT') return <div className="card">Please login as a student.</div>

  const available = quizzes.filter(q => !q.latestAttempt || q.inProgressAttempt || q.canRetake)
  const completed = quizzes.filter(q => q.latestAttempt && !q.inProgressAttempt && !q.canRetake)
  const upcoming = quizzes.filter(q => q.notYetOpen)
  const closed = quizzes.filter(q => q.closed && !q.latestAttempt)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 4 }}>👋 Hello, {auth.displayName}!</h2>
        <p>Welcome back to MRLC GED Practice</p>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="val">{available.length}</div>
          <div className="lbl">Available</div>
        </div>
        <div className="stat-card">
          <div className="val">{completed.length}</div>
          <div className="lbl">Completed</div>
        </div>
        <div className="stat-card">
          <div className="val">{myResults.length}</div>
          <div className="lbl">Total Attempts</div>
        </div>
        <div className="stat-card">
          <div className="val">
            {myResults.filter(r => r.marksReleased && r.totalPoints > 0 && (r.score/r.totalPoints) >= .7).length}
          </div>
          <div className="lbl">Passed</div>
        </div>
      </div>

      {err && <div className="banner error" style={{ marginBottom: 14 }}>{err}</div>}

      <div className="tab-bar">
        <button className={`tab-btn ${tab==='quizzes'?'active':''}`} onClick={() => setTab('quizzes')}>📝 Quizzes</button>
        <button className={`tab-btn ${tab==='results'?'active':''}`} onClick={() => setTab('results')}>📊 My Results</button>
        <button className={`tab-btn ${tab==='leaderboard'?'active':''}`} onClick={() => setTab('leaderboard')}>🏆 Leaderboard</button>
      </div>

      {/* ── QUIZZES ── */}
      {tab === 'quizzes' && (
        <>
          {loading && <div className="empty-state"><span className="spinner dark" style={{ width: 32, height: 32 }}></span></div>}

          {!loading && quizzes.length === 0 && (
            <div className="empty-state">
              <div className="icon">📭</div>
              <p>No quizzes available yet. Your teacher will publish them soon.</p>
            </div>
          )}

          {available.length > 0 && (
            <>
              <h3 style={{ marginBottom: 14 }}>🟢 Available Now</h3>
              <div className="row" style={{ marginBottom: 24 }}>
                {available.map(q => (
                  <div key={q.id} className="quiz-card" style={{ flex: '1 1 260px', minWidth: 240 }}>
                    <div className="quiz-card-subj-bar" style={{ background: SUBJ_COLOR[q.subject] }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <span style={{ fontSize: 28 }}>{SUBJ_ICON[q.subject]}</span>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <span className={`badge ${SUBJ_CLASS[q.subject]}`}>{q.subject}</span>
                        <span className="badge">{q.timeLimitMin}m</span>
                      </div>
                    </div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '.95rem' }}>{q.title}</h3>
                    <p style={{ fontSize: '.8rem', marginBottom: 14, color: 'var(--text3)' }}>
                      {q.className} · {q.questionCount} questions
                      {q.attemptCount > 0 && ` · attempt ${q.attemptCount + 1}`}
                    </p>
                    {q.closeAt && <div style={{ fontSize: '.75rem', color: 'var(--warning)', marginBottom: 10 }}>⏰ Closes {new Date(q.closeAt).toLocaleDateString()}</div>}
                    <Link to={`/student/quiz/${q.id}`} className="btn full" style={{ background: SUBJ_COLOR[q.subject] }}>
                      {q.inProgressAttempt ? '▶ Resume' : q.canRetake ? '🔄 Retake' : 'Start →'}
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <h3 style={{ marginBottom: 14 }}>🕐 Upcoming</h3>
              <div className="row" style={{ marginBottom: 24 }}>
                {upcoming.map(q => (
                  <div key={q.id} className="quiz-card" style={{ flex: '1 1 240px', minWidth: 220, opacity: .7 }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: '.95rem' }}>{q.title}</h3>
                    <p style={{ fontSize: '.8rem', color: 'var(--text3)', marginBottom: 8 }}>{q.className}</p>
                    <div className="badge warning">📅 Opens {new Date(q.openAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {completed.length > 0 && (
            <>
              <h3 style={{ marginBottom: 14 }}>✅ Completed</h3>
              <div className="row">
                {completed.map(q => (
                  <div key={q.id} className="quiz-card" style={{ flex: '1 1 240px', minWidth: 220, opacity: .8 }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: '.95rem' }}>{q.title}</h3>
                    <p style={{ fontSize: '.8rem', color: 'var(--text3)', marginBottom: 8 }}>{q.className}</p>
                    {q.marksReleased && q.latestAttempt ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        <span className="badge success">Score: {q.latestAttempt.score} pts</span>
                        <Link to={`/student/attempt/${q.latestAttempt.id}`} className="btn ghost xs">📝 Review</Link>
                      </div>
                    ) : (
                      <span className="badge">⏳ Marks pending</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── RESULTS ── */}
      {tab === 'results' && (
        <>
          <h3 style={{ marginBottom: 14 }}>My Results</h3>
          {myResults.length === 0 && (
            <div className="empty-state"><div className="icon">📊</div><p>No results yet. Complete a quiz!</p></div>
          )}
          {myResults.length > 0 && (
            <div className="card flush">
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead><tr><th>Quiz</th><th>Subject</th><th>Score</th><th>%</th><th>Date</th><th></th></tr></thead>
                  <tbody>
                    {myResults.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500 }}>{r.quizTitle}</td>
                        <td><span className={`badge ${SUBJ_CLASS[r.subject]||''}`}>{r.subject}</span></td>
                        <td>{r.marksReleased ? <strong>{r.score}/{r.totalPoints}</strong> : <span className="badge">🔒 Pending</span>}</td>
                        <td>{r.marksReleased && r.totalPoints > 0
                          ? <span className={`badge ${(r.score/r.totalPoints)>=.7?'success':'danger'}`}>{Math.round((r.score/r.totalPoints)*100)}%</span>
                          : '—'}</td>
                        <td style={{ fontSize: '.8rem', color: 'var(--text3)' }}>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '—'}</td>
                        <td>
                          {r.marksReleased
                            ? <Link to={`/student/attempt/${r.id}`} className="btn ghost xs">📝 Review</Link>
                            : <span style={{ color: 'var(--text3)', fontSize: '.78rem' }}>Pending</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── LEADERBOARD ── */}
      {tab === 'leaderboard' && (
        <>
          <h3 style={{ marginBottom: 14 }}>🏆 Class Leaderboards</h3>
          {quizzes.filter(q => q.marksReleased).length === 0 && (
            <div className="empty-state"><div className="icon">🏆</div><p>Leaderboards appear after your teacher releases marks.</p></div>
          )}
          {quizzes.filter(q => q.marksReleased).map(q => (
            <div key={q.id} className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <h3 style={{ margin: 0, fontSize: '.95rem' }}>{q.title}</h3>
                <button className="btn ghost sm" onClick={() => setLbQuiz(lbQuiz?.id === q.id ? null : q)}>{lbQuiz?.id === q.id ? '▲' : '▼ View'}</button>
              </div>
              <p style={{ fontSize: '.8rem', color: 'var(--text3)', margin: 0 }}>{q.className}</p>
              {lbQuiz?.id === q.id && <LeaderboardView quizId={q.id} quizTitle={q.title} />}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
