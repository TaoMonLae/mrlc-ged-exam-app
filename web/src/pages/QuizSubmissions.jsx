import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { loadAuth } from '../lib/auth'

export default function QuizSubmissions() {
  const { quizId } = useParams()
  const auth = loadAuth()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')

  async function load() {
    setErr('')
    try {
      const d = await api(`/api/quizzes/${quizId}/submissions`, { token: auth.token })
      setData(d)
    } catch (e) { setErr(e.message) }
  }

  async function toggleRelease(v) {
    setErr(''); setMsg('')
    try {
      await api(`/api/quizzes/${quizId}/marks-release`, { token: auth.token, method: 'PATCH', body: { marksReleased: v } })
      setMsg(v ? '✓ Marks released — students can now view their answers.' : '✓ Marks hidden from students.')
      await load()
    } catch (e) { setErr(e.message) }
  }

  useEffect(() => { if (auth?.token) load() }, [quizId])

  if (!auth?.token) return <div className="card">Please login.</div>
  if (err && !data) return (
    <div>
      <div className="banner error">{err}</div>
      <Link to="/teacher" className="btn secondary" style={{ marginTop: 12 }}>← Dashboard</Link>
    </div>
  )
  if (!data) return <div style={{ textAlign: 'center', padding: 60 }}><span className="spinner dark" style={{ width: 32, height: 32 }}></span></div>

  const submitted   = data.attempts.filter(a => a.status === 'SUBMITTED')
  const inProgress  = data.attempts.filter(a => a.status === 'IN_PROGRESS')
  const notStarted  = data.attempts.filter(a => a.status === 'NOT_STARTED')
  const enrolled    = data.enrolledCount ?? data.attempts.length

  const avgScore = submitted.length > 0
    ? Math.round(submitted.reduce((s, a) => s + ((a.scoreOverride ?? a.score) || 0), 0) / submitted.length)
    : null
  const passCount = data.totalPoints > 0
    ? submitted.filter(a => ((a.scoreOverride ?? a.score) / data.totalPoints) >= 0.7).length
    : null

  const classId = data.class?.id
  const backPath = classId ? `/teacher/quizzes/${classId}` : '/teacher'

  const statusFilters = [
    { key: 'ALL',         label: 'All',          count: data.attempts.length },
    { key: 'SUBMITTED',   label: '✓ Submitted',   count: submitted.length },
    { key: 'IN_PROGRESS', label: '⏳ In Progress', count: inProgress.length },
    { key: 'NOT_STARTED', label: '○ Not Started', count: notStarted.length },
  ]

  const visible = filterStatus === 'ALL'
    ? data.attempts
    : data.attempts.filter(a => a.status === filterStatus)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link to={backPath} style={{ fontSize: '.82rem', color: 'var(--text3)', textDecoration: 'none' }}>← Back to Quizzes</Link>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 6 }}>📋 {data.quiz.title}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="badge accent">{data.quiz.subject}</span>
          <span className="badge">{data.totalPoints} pts total</span>
          <span className={`badge ${data.quiz.marksReleased ? 'success' : ''}`}>
            {data.quiz.marksReleased ? '📊 Marks Released' : '🔒 Marks Hidden'}
          </span>
          {data.class && <span className="badge">{data.class.name}</span>}
        </div>
      </div>

      {err && <div className="banner error" style={{ marginBottom: 14 }}>{err}</div>}
      {msg && <div className="banner success" style={{ marginBottom: 14, cursor: 'pointer' }} onClick={() => setMsg('')}>{msg}</div>}

      {/* Stats — now 6 cards including enrolled + not started */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="val">{enrolled}</div>
          <div className="lbl">Enrolled</div>
        </div>
        <div className="stat-card">
          <div className="val" style={{ color: 'var(--success)' }}>{submitted.length}</div>
          <div className="lbl">Submitted</div>
        </div>
        <div className="stat-card">
          <div className="val" style={{ color: 'var(--warning)' }}>{inProgress.length}</div>
          <div className="lbl">In Progress</div>
        </div>
        <div className="stat-card">
          <div className="val" style={{ color: notStarted.length > 0 ? 'var(--danger)' : 'var(--text3)' }}>
            {notStarted.length}
          </div>
          <div className="lbl">Not Started</div>
        </div>
        <div className="stat-card">
          <div className="val">{avgScore !== null ? avgScore : '—'}</div>
          <div className="lbl">Avg Score</div>
        </div>
        <div className="stat-card">
          <div className="val">{passCount !== null ? passCount : '—'}</div>
          <div className="lbl">Passed ≥70%</div>
        </div>
      </div>

      {/* Completion progress bar */}
      {enrolled > 0 && (
        <div className="card" style={{ marginBottom: 20, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>Completion</span>
            <span style={{ color: 'var(--text3)' }}>
              {submitted.length} / {enrolled} submitted
              {notStarted.length > 0 && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>· {notStarted.length} haven't started</span>}
            </span>
          </div>
          <div className="progress-bar" style={{ height: 10 }}>
            {/* submitted = green, in-progress = yellow, not started = red bg implicitly */}
            <div className="progress-bar-fill" style={{ width: `${(submitted.length / enrolled) * 100}%`, background: 'var(--success)', borderRadius: 0 }}></div>
            <div className="progress-bar-fill" style={{
              width: `${(inProgress.length / enrolled) * 100}%`,
              background: 'var(--warning)',
              borderRadius: 0,
              position: 'absolute',
              left: `${(submitted.length / enrolled) * 100}%`
            }}></div>
          </div>
        </div>
      )}

      {/* Release marks control */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Marks Visibility:{' '}
              <span style={{ color: data.quiz.marksReleased ? 'var(--success)' : 'var(--text3)' }}>
                {data.quiz.marksReleased ? 'Released to students' : 'Hidden from students'}
              </span>
            </div>
            <div style={{ fontSize: '.8rem', color: 'var(--text3)' }}>
              When released, students can see their score and review correct answers.
            </div>
          </div>
          <div className="row nowrap">
            {data.quiz.marksReleased
              ? <button className="btn secondary" onClick={() => toggleRelease(false)}>🔒 Hide Marks</button>
              : <button className="btn success" onClick={() => toggleRelease(true)}>📊 Release Marks</button>}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="tab-bar" style={{ marginBottom: 16 }}>
        {statusFilters.map(f => (
          <button key={f.key} className={`tab-btn ${filterStatus === f.key ? 'active' : ''}`}
            onClick={() => setFilterStatus(f.key)}>
            {f.label}
            <span className="badge" style={{ marginLeft: 6, fontSize: '.7rem' }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Submissions table */}
      {visible.length === 0 && (
        <div className="empty-state">
          <div className="icon">📭</div>
          <p>{filterStatus === 'NOT_STARTED' ? 'All enrolled students have started.' : 'No entries for this filter.'}</p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="card flush">
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>%</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a, idx) => {
                  const finalScore = a.scoreOverride ?? a.score
                  const pct = data.totalPoints > 0 && finalScore !== null
                    ? Math.round((finalScore / data.totalPoints) * 100)
                    : null
                  return (
                    <tr key={a.id ?? `ns-${idx}`}
                      style={{ opacity: a.status === 'NOT_STARTED' ? 0.6 : 1 }}>
                      <td style={{ fontWeight: 500 }}>{a.studentName}</td>
                      <td>
                        {a.status === 'SUBMITTED' && <span className="badge success">✓ Submitted</span>}
                        {a.status === 'IN_PROGRESS' && <span className="badge warning">⏳ In Progress</span>}
                        {a.status === 'NOT_STARTED' && <span className="badge">○ Not Started</span>}
                      </td>
                      <td>
                        {a.status === 'SUBMITTED' ? (
                          <span>
                            <strong>{finalScore}</strong>/{data.totalPoints}
                            {a.scoreOverride !== null && a.scoreOverride !== undefined &&
                              <span className="badge warning" style={{ marginLeft: 6, fontSize: '.7rem' }}>edited</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {pct !== null
                          ? <span className={`badge ${pct >= 70 ? 'success' : 'danger'}`}>{pct}%</span>
                          : '—'}
                      </td>
                      <td style={{ fontSize: '.8rem', color: 'var(--text3)' }}>
                        {a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '—'}
                      </td>
                      <td>
                        {a.status === 'SUBMITTED'
                          ? <Link to={`/teacher/attempt/${a.id}`} className="btn ghost xs">📝 View</Link>
                          : <span style={{ color: 'var(--text3)', fontSize: '.8rem' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
