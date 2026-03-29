import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { loadAuth } from '../lib/auth'
import { Link } from 'react-router-dom'

const SUBJ_COLOR = { RLA: '#2563eb', MATH: '#059669', SCIENCE: '#d97706', SOCIAL_STUDIES: '#7c3aed' }
const SUBJ_ICON  = { RLA: '📖', MATH: '🔢', SCIENCE: '🔬', SOCIAL_STUDIES: '🌍' }
const SUBJ_CLASS = { RLA: 'subj-rla', MATH: 'subj-math', SCIENCE: 'subj-science', SOCIAL_STUDIES: 'subj-social' }

function LeaderboardView({ quizId }) {
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
  if (data.leaderboard.length === 0) return <p style={{ color: 'var(--text3)', fontSize: '.875rem', padding: '8px 0' }}>No results yet.</p>

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginTop: 12 }}>
      {data.leaderboard.slice(0, 10).map(e => (
        <div key={e.studentId} className="lb-row">
          <div className={`lb-rank ${e.rank <= 3 ? ['gold', 'silver', 'bronze'][e.rank - 1] : 'other'}`}>{rankEmoji(e.rank)}</div>
          <div style={{ flex: 1, fontWeight: e.rank <= 3 ? 700 : 400, fontSize: '.9rem' }}>{e.name}</div>
          <span className={`badge ${e.pct >= 70 ? 'success' : 'danger'}`}>{e.pct}%</span>
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
  const upcoming  = quizzes.filter(q => q.notYetOpen)
  const closed    = quizzes.filter(q => q.closed && !q.latestAttempt)

  const passedCount = myResults.filter(r => r.marksReleased && r.totalPoints > 0 && (r.score / r.totalPoints) >= .7).length
  const avgPct = myResults.filter(r => r.marksReleased && r.totalPoints > 0).length > 0
    ? Math.round(myResults.filter(r => r.marksReleased && r.totalPoints > 0).reduce((s, r) => s + (r.score / r.totalPoints) * 100, 0) / myResults.filter(r => r.marksReleased && r.totalPoints > 0).length)
    : null

  return (
    <div>
      {/* ── Hero greeting ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)',
        borderRadius: 18, padding: '28px 28px 24px', marginBottom: 24, color: '#fff'
      }}>
        <div style={{ fontSize: '.8rem', fontWeight: 600, opacity: .75, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>
          Welcome back
        </div>
        <h2 style={{ color: '#fff', marginBottom: 4, fontSize: 'clamp(1.3rem,3vw,1.8rem)' }}>
          {auth.displayName}
        </h2>
        <p style={{ color: 'rgba(255,255,255,.8)', fontSize: '.875rem', margin: 0 }}>
          MRLC GED Practice Platform
        </p>
      </div>

      {/* ── Stats row ── */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {[
          { val: available.length, lbl: 'Available', color: 'var(--accent)' },
          { val: completed.length, lbl: 'Completed', color: 'var(--success)' },
          { val: myResults.length, lbl: 'Attempts',  color: 'var(--text)' },
          { val: avgPct !== null ? `${avgPct}%` : '—', lbl: 'Avg Score', color: passedCount > 0 ? 'var(--success)' : 'var(--text)' },
        ].map(({ val, lbl, color }) => (
          <div key={lbl} className="stat-card">
            <div className="val" style={{ color }}>{val}</div>
            <div className="lbl">{lbl}</div>
          </div>
        ))}
      </div>

      {err && <div className="banner error" style={{ marginBottom: 16 }}>{err}</div>}

      {/* ── Tab bar ── */}
      <div className="tab-bar" style={{ marginBottom: 24 }}>
        <button className={`tab-btn ${tab === 'quizzes' ? 'active' : ''}`} onClick={() => setTab('quizzes')}>📝 Quizzes</button>
        <button className={`tab-btn ${tab === 'results' ? 'active' : ''}`} onClick={() => setTab('results')}>📊 My Results</button>
        <button className={`tab-btn ${tab === 'leaderboard' ? 'active' : ''}`} onClick={() => setTab('leaderboard')}>🏆 Leaderboard</button>
      </div>

      {/* ══ QUIZZES TAB ══ */}
      {tab === 'quizzes' && (
        <>
          {loading && (
            <div className="empty-state">
              <span className="spinner dark" style={{ width: 32, height: 32 }}></span>
            </div>
          )}

          {!loading && quizzes.length === 0 && (
            <div className="empty-state">
              <div className="icon">📭</div>
              <p>No quizzes available yet. Your teacher will publish them soon.</p>
            </div>
          )}

          {/* Available */}
          {available.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)' }}></div>
                <h3 style={{ margin: 0, fontSize: '.95rem', fontWeight: 700, color: 'var(--text2)' }}>
                  Available Now
                </h3>
                <span className="badge success" style={{ marginLeft: 4 }}>{available.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                {available.map(q => {
                  const accent = SUBJ_COLOR[q.subject] || 'var(--accent)'
                  return (
                    <div key={q.id} style={{
                      background: 'var(--bg2)', border: '1px solid var(--border)',
                      borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow)',
                      transition: 'box-shadow .2s, transform .2s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--shadow)' }}
                    >
                      {/* Subject color strip */}
                      <div style={{ height: 5, background: accent }}></div>
                      <div style={{ padding: '18px 18px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <span style={{ fontSize: 26 }}>{SUBJ_ICON[q.subject]}</span>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <span className={`badge ${SUBJ_CLASS[q.subject]}`}>{q.subject}</span>
                            <span className="badge">{q.timeLimitMin}m</span>
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--text)', marginBottom: 4, lineHeight: 1.3 }}>{q.title}</div>
                        <div style={{ fontSize: '.78rem', color: 'var(--text3)', marginBottom: 14 }}>
                          {q.className} · {q.questionCount} questions
                          {q.attemptCount > 0 && ` · attempt ${q.attemptCount + 1}`}
                        </div>
                        {q.closeAt && (
                          <div style={{ fontSize: '.72rem', color: 'var(--warning)', marginBottom: 10, fontWeight: 600 }}>
                            ⏰ Closes {new Date(q.closeAt).toLocaleDateString()}
                          </div>
                        )}
                        <Link
                          to={`/student/quiz/${q.id}`}
                          className="btn full sm"
                          style={{ background: accent, justifyContent: 'center' }}
                        >
                          {q.inProgressAttempt ? '▶ Resume' : q.canRetake ? '🔄 Retake' : 'Start →'}
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--warning)' }}></div>
                <h3 style={{ margin: 0, fontSize: '.95rem', fontWeight: 700, color: 'var(--text2)' }}>Upcoming</h3>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {upcoming.map(q => (
                  <div key={q.id} className="card" style={{ flex: '1 1 220px', opacity: .75 }}>
                    <div style={{ fontWeight: 600, fontSize: '.9rem', marginBottom: 4 }}>{q.title}</div>
                    <div style={{ fontSize: '.78rem', color: 'var(--text3)', marginBottom: 8 }}>{q.className}</div>
                    <span className="badge warning">📅 Opens {new Date(q.openAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--border2)' }}></div>
                <h3 style={{ margin: 0, fontSize: '.95rem', fontWeight: 700, color: 'var(--text2)' }}>Completed</h3>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {completed.map(q => (
                  <div key={q.id} className="card" style={{ flex: '1 1 220px', opacity: .8 }}>
                    <div style={{ fontWeight: 600, fontSize: '.9rem', marginBottom: 4 }}>{q.title}</div>
                    <div style={{ fontSize: '.78rem', color: 'var(--text3)', marginBottom: 10 }}>{q.className}</div>
                    {q.marksReleased && q.latestAttempt ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="badge success">Score: {q.latestAttempt.score} pts</span>
                        <Link to={`/student/attempt/${q.latestAttempt.id}`} className="btn ghost xs">📝 Review</Link>
                      </div>
                    ) : (
                      <span className="badge">⏳ Marks pending</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ══ RESULTS TAB ══ */}
      {tab === 'results' && (
        <>
          {myResults.length === 0 && (
            <div className="empty-state">
              <div className="icon">📊</div>
              <p>No results yet. Complete a quiz to see your scores here!</p>
            </div>
          )}
          {myResults.length > 0 && (
            <div className="card flush">
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Quiz</th>
                      <th>Subject</th>
                      <th>Score</th>
                      <th>%</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {myResults.map(r => {
                      const pct = r.marksReleased && r.totalPoints > 0 ? Math.round((r.score / r.totalPoints) * 100) : null
                      return (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 500, maxWidth: 200 }}>{r.quizTitle}</td>
                          <td><span className={`badge ${SUBJ_CLASS[r.subject] || ''}`}>{r.subject}</span></td>
                          <td>
                            {r.marksReleased
                              ? <strong>{r.score}/{r.totalPoints}</strong>
                              : <span className="badge">🔒 Pending</span>}
                          </td>
                          <td>
                            {pct !== null
                              ? <span className={`badge ${pct >= 70 ? 'success' : 'danger'}`}>{pct}%</span>
                              : '—'}
                          </td>
                          <td style={{ fontSize: '.8rem', color: 'var(--text3)' }}>
                            {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '—'}
                          </td>
                          <td>
                            {r.marksReleased
                              ? <Link to={`/student/attempt/${r.id}`} className="btn ghost xs">📝 Review</Link>
                              : <span style={{ color: 'var(--text3)', fontSize: '.78rem' }}>Pending</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ LEADERBOARD TAB ══ */}
      {tab === 'leaderboard' && (
        <>
          {quizzes.filter(q => q.marksReleased).length === 0 && (
            <div className="empty-state">
              <div className="icon">🏆</div>
              <p>Leaderboards appear after your teacher releases marks.</p>
            </div>
          )}
          {quizzes.filter(q => q.marksReleased).map(q => (
            <div key={q.id} className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{q.title}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: 2 }}>{q.className}</div>
                </div>
                <button
                  className="btn ghost sm"
                  onClick={() => setLbQuiz(lbQuiz?.id === q.id ? null : q)}
                >
                  {lbQuiz?.id === q.id ? '▲ Hide' : '▼ View'}
                </button>
              </div>
              {lbQuiz?.id === q.id && <LeaderboardView quizId={q.id} />}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
