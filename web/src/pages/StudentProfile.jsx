import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { loadAuth } from '../lib/auth'

const SUBJ_COLOR = { RLA: '#2563eb', MATH: '#059669', SCIENCE: '#d97706', SOCIAL_STUDIES: '#7c3aed' }
const SUBJ_ICON = { RLA: '📖', MATH: '🔢', SCIENCE: '🔬', SOCIAL_STUDIES: '🌍' }

export default function StudentProfile() {
  const { id } = useParams()
  const auth = loadAuth()
  const [student, setStudent] = useState(null)
  const [err, setErr] = useState('')
  const [overrideModal, setOverrideModal] = useState(null)
  const [showResetPw, setShowResetPw] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  useEffect(() => {
    if (!auth?.token) return
    api(`/api/students/${id}`, { token: auth.token }).then(d => setStudent(d.student)).catch(e => setErr(e.message))
  }, [id])

  async function resetPassword() {
    if (!newPw.trim() || newPw.trim().length < 4) { setPwMsg('Password must be at least 4 characters'); return }
    setPwSaving(true); setPwMsg('')
    try {
      await api(`/api/students/${id}/reset-password`, {
        token: auth.token, method: 'POST', body: { newPassword: newPw.trim() }
      })
      setPwMsg('✓ Password reset successfully.')
      setNewPw('')
      setTimeout(() => { setShowResetPw(false); setPwMsg('') }, 2000)
    } catch (e) { setPwMsg('Error: ' + e.message) }
    setPwSaving(false)
  }

  if (!auth || auth.type !== 'USER') return <div className="card">Please login as Admin/Teacher.</div>
  if (err) return <div><div className="banner error">{err}</div></div>
  if (!student) return <div style={{ textAlign: 'center', padding: 60 }}><span className="spinner dark" style={{ width: 32, height: 32 }}></span></div>

  const attempts = student.attempts || []
  const submitted = attempts.filter(a => a.status === 'SUBMITTED')
  const totalScore = submitted.reduce((s, a) => s + (a.scoreOverride ?? a.score), 0)
  const totalPts = submitted.reduce((s, a) => s + a.totalPoints, 0)
  const avgPct = totalPts > 0 ? Math.round((totalScore / totalPts) * 100) : null

  const bySubject = {}
  for (const a of submitted) {
    if (!bySubject[a.subject]) bySubject[a.subject] = []
    bySubject[a.subject].push(a)
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link to="/teacher/students" style={{ fontSize: '.875rem', color: 'var(--text3)' }}>← All Students</Link>
      </div>

      {/* Profile header */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
              {student.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ margin: 0 }}>{student.displayName}</h2>
              {student.username && <p style={{ fontSize: '.875rem', marginTop: 2 }}>@{student.username}</p>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {student.classes?.map(c => <span key={c.id} className="badge">{c.name}</span>)}
                <span className={`badge ${student.hasPassword ? 'success' : ''}`}>{student.hasPassword ? '🔐 Has Account' : 'No Account'}</span>
              </div>
            </div>
          </div>
          <div className="row nowrap" style={{ alignSelf: 'flex-start' }}>
            <button className="btn secondary sm" onClick={() => { setShowResetPw(!showResetPw); setPwMsg(''); setNewPw('') }}>
              🔑 Reset Password
            </button>
          </div>
        </div>
        {showResetPw && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            {pwMsg && <div className={`banner ${pwMsg.startsWith('Error') ? 'error' : 'success'}`} style={{ marginBottom: 10 }}>{pwMsg}</div>}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label className="small">New Password (min 4 chars)</label>
                <input className="input" type="text" value={newPw} onChange={e => setNewPw(e.target.value)}
                  placeholder="e.g. newpass123" autoFocus
                  onKeyDown={e => e.key === 'Enter' && resetPassword()} />
              </div>
              <button className="btn warning" onClick={resetPassword} disabled={pwSaving}>
                {pwSaving ? <span className="spinner"></span> : 'Set Password'}
              </button>
              <button className="btn ghost" onClick={() => setShowResetPw(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card"><div className="val">{submitted.length}</div><div className="lbl">Quizzes Done</div></div>
        <div className="stat-card"><div className="val">{avgPct !== null ? `${avgPct}%` : '—'}</div><div className="lbl">Avg Score</div></div>
        <div className="stat-card"><div className="val">{totalScore}/{totalPts}</div><div className="lbl">Total Points</div></div>
        <div className="stat-card">
          <div className="val">{submitted.filter(a => a.totalPoints > 0 && ((a.scoreOverride ?? a.score) / a.totalPoints) >= .7).length}</div>
          <div className="lbl">Passed</div>
        </div>
      </div>

      {/* Subject breakdown */}
      {Object.keys(bySubject).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-title"><h3>Performance by Subject</h3></div>
          <div className="row">
            {Object.entries(bySubject).map(([subj, atts]) => {
              const sp = atts.reduce((s, a) => s + (a.scoreOverride ?? a.score), 0)
              const tp = atts.reduce((s, a) => s + a.totalPoints, 0)
              const pct = tp > 0 ? Math.round((sp / tp) * 100) : 0
              return (
                <div key={subj} className="card" style={{ flex: '1 1 160px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{SUBJ_ICON[subj] || '📚'}</div>
                  <div style={{ fontWeight: 700, fontSize: '1.4rem', fontFamily: "'DM Serif Display',serif", color: SUBJ_COLOR[subj] }}>{pct}%</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--text3)', marginBottom: 8 }}>{atts.length} attempts</div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${pct}%`, background: SUBJ_COLOR[subj] }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Attempts history */}
      <div className="section-title"><h3>Attempt History</h3></div>
      {submitted.length === 0 && <div className="empty-state"><div className="icon">📊</div><p>No attempts yet.</p></div>}
      {submitted.length > 0 && (
        <div className="card flush">
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Quiz</th><th>Subject</th><th>Score</th><th>%</th><th>Marks</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {submitted.map(a => {
                  const finalScore = a.scoreOverride ?? a.score
                  const pct = a.totalPoints > 0 ? Math.round((finalScore / a.totalPoints) * 100) : 0
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 500 }}>{a.quizTitle}</td>
                      <td><span className="badge">{a.subject}</span></td>
                      <td>
                        <strong>{finalScore}</strong>/{a.totalPoints}
                        {a.scoreOverride !== null && a.scoreOverride !== undefined && <span className="badge warning" style={{ marginLeft: 6, fontSize: '.7rem' }}>edited</span>}
                      </td>
                      <td><span className={`badge ${pct >= 70 ? 'success' : 'danger'}`}>{pct}%</span></td>
                      <td><span className={`badge ${a.marksReleased ? 'success' : ''}`}>{a.marksReleased ? '✓ Released' : '🔒 Hidden'}</span></td>
                      <td style={{ fontSize: '.8rem', color: 'var(--text3)' }}>{a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '—'}</td>
                      <td><Link to={`/teacher/attempt/${a.id}`} className="btn ghost xs">📋 Review</Link></td>
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
