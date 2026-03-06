import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { loadAuth } from '../lib/auth'

const QUICK_LINKS = [
  { icon: '📄', label: 'Passages', desc: 'Reading passages for RLA, Science & Social Studies', color: '#2563eb', path: 'passages' },
  { icon: '❓', label: 'Question Bank', desc: 'Create and manage quiz questions by subject', color: '#059669', path: 'questions' },
  { icon: '📝', label: 'Quizzes & Exams', desc: 'Build quizzes, publish, release marks & leaderboard', color: '#7c3aed', path: 'quizzes' },
]

export default function ClassDetail() {
  const { id } = useParams()
  const auth = loadAuth()
  const [cls, setCls] = useState(null)
  const [roster, setRoster] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [allowAccountLogin, setAllowAccountLogin] = useState(true)
  const [allowCodeLogin, setAllowCodeLogin] = useState(true)
  const [policy, setPolicy] = useState('ROSTER_ONLY')
  const [joinPin, setJoinPin] = useState('')
  const [studentName, setStudentName] = useState('')
  const [studentUsername, setStudentUsername] = useState('')
  const [studentPassword, setStudentPassword] = useState('')
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    if (!auth?.token) return
    api('/api/classes', { token: auth.token }).then(d => {
      const found = d.classes.find(x => x.id === id)
      setCls(found || null)
      if (found) {
        setAllowAccountLogin(found.allowAccountLogin)
        setAllowCodeLogin(found.allowCodeLogin)
        setPolicy(found.codeModePolicy)
      }
    }).catch(e => setErr(e.message))
    api(`/api/classes/${id}/roster`, { token: auth.token }).then(d => setRoster(d.roster)).catch(() => {})
  }, [id])

  async function saveSettings() {
    setErr(''); setMsg('')
    try {
      const body = { allowAccountLogin, allowCodeLogin, codeModePolicy: policy }
      if (joinPin.trim()) body.joinPin = joinPin.trim()
      const d = await api(`/api/classes/${id}`, { token: auth.token, method: 'PATCH', body })
      setCls(d.class); setJoinPin(''); setMsg('✓ Settings saved.')
    } catch (e) { setErr(e.message) }
  }

  async function addStudent() {
    setErr(''); setMsg('')
    try {
      const body = { displayName: studentName.trim() }
      if (studentUsername.trim() && studentPassword.trim()) {
        body.username = studentUsername.trim()
        body.password = studentPassword.trim()
      }
      const d = await api(`/api/classes/${id}/roster`, { token: auth.token, method: 'POST', body })
      setRoster([...roster, d.student])
      setStudentName(''); setStudentUsername(''); setStudentPassword('')
      setMsg('✓ Student added.')
    } catch (e) { setErr(e.message) }
  }

  if (!auth || auth.type !== 'USER') return <div className="card">Please login as Admin/Teacher.</div>
  if (!cls) return <div style={{ textAlign: 'center', padding: 60 }}><span className="spinner dark" style={{ width: 32, height: 32 }}></span></div>

  
async function copyClassCode() {
  if (!cls?.classCode) return;
  try {
    await navigator.clipboard.writeText(cls.classCode);
    setMsg("✓ Class code copied.");
  } catch (e) {
    setMsg("Class code: " + cls.classCode);
  }
}

return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <Link to="/teacher" style={{ fontSize: '.82rem', color: 'var(--text3)', textDecoration: 'none' }}>
          ← Dashboard
        </Link>
      </div>

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ marginBottom: 8 }}>{cls.name}</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              background: 'rgba(32,85,212,.1)', color: 'var(--accent)',
              border: '1px solid rgba(32,85,212,.2)', borderRadius: 6,
              fontFamily: 'monospace', fontWeight: 700, fontSize: '.9rem',
              padding: '4px 12px', letterSpacing: '.1em'
            }}>🔑 {cls.classCode}</span>
            <button className="btn sm secondary" onClick={copyClassCode}>Copy</button>
            <a className="btn sm ghost" href={`/api/attempts/results.csv?classId=${id}`} target="_blank" rel="noreferrer">Export Results CSV</a>
            <span className="badge">{roster.length} student{roster.length !== 1 ? 's' : ''}</span>
            {cls.allowAccountLogin && <span className="badge success" style={{ fontSize: '.72rem' }}>👤 Account</span>}
            {cls.allowCodeLogin && <span className="badge accent" style={{ fontSize: '.72rem' }}>🔑 Code</span>}
          </div>
        </div>
      </div>

      {err && <div className="banner error" style={{ marginBottom: 14 }}>{err}</div>}
      {msg && <div className="banner success" style={{ marginBottom: 14 }}>{msg}</div>}

      {/* Tab bar */}
      <div className="tab-bar" style={{ marginBottom: 24 }}>
        {[['overview','🏠 Overview'], ['roster',`👥 Roster (${roster.length})`], ['settings','⚙️ Settings']].map(([t, l]) => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          <div className="carousel" style={{ marginBottom: 28 }}>
            <div className="carousel-track">
            {QUICK_LINKS.map(item => (
              <Link
                key={item.label}
                to={`/teacher/${item.path}/${id}`}
                style={{ textDecoration: 'none' }}
              >
                <div className="card carousel-item" style={{
                  cursor: 'pointer', transition: 'all .18s', height: '100%',
                  borderTop: `3px solid ${item.color}`,
                  display: 'flex', flexDirection: 'column', gap: 10
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: `${item.color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: '.82rem', color: 'var(--text3)', lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                    <span style={{ color: item.color, fontWeight: 600, fontSize: '.82rem' }}>Open →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Quick stats */}
          <div className="stat-grid">
            <div className="stat-card">
              <div className="val">{roster.length}</div>
              <div className="lbl">Students</div>
            </div>
            <div className="stat-card">
              <div className="val">{roster.filter(s => s.hasPassword).length}</div>
              <div className="lbl">With Accounts</div>
            </div>
            <div className="stat-card">
              <div className="val">{cls.classCode}</div>
              <div className="lbl" style={{ fontFamily: 'monospace' }}>Class Code</div>
            </div>
          </div>
        </div>
      )}

      {/* ── ROSTER ── */}
      {tab === 'roster' && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 16 }}>➕ Add Student</h3>
            <div className="row">
              <div style={{ flex: '2 1 180px', minWidth: 160 }}>
                <label className="small">Full Name *</label>
                <input className="input" value={studentName} onChange={e => setStudentName(e.target.value)}
                  placeholder="e.g., Juan dela Cruz"
                  onKeyDown={e => e.key === 'Enter' && studentName.trim() && addStudent()} />
              </div>
              <div style={{ flex: '1 1 140px', minWidth: 130 }}>
                <label className="small">Username (optional)</label>
                <input className="input" value={studentUsername} onChange={e => setStudentUsername(e.target.value)} placeholder="juandc" />
              </div>
              <div style={{ flex: '1 1 140px', minWidth: 130 }}>
                <label className="small">Password (optional)</label>
                <input className="input" type="password" value={studentPassword} onChange={e => setStudentPassword(e.target.value)} placeholder="••••••" />
              </div>
              <div style={{ alignSelf: 'flex-end' }}>
                <button className="btn" onClick={addStudent} disabled={!studentName.trim()}>Add Student</button>
              </div>
            </div>
          </div>

          {roster.length === 0 && (
            <div className="empty-state">
              <div className="icon">👥</div>
              <p>No students yet. Add one above or use a class code.</p>
            </div>
          )}

          {roster.length > 0 && (
            <div className="card flush">
              <table>
                <thead>
                  <tr><th>#</th><th>Name</th><th>Username</th><th>Account</th></tr>
                </thead>
                <tbody>
                  {roster.map((s, i) => (
                    <tr key={s.id}>
                      <td style={{ color: 'var(--text3)', width: 40 }}>{i + 1}</td>
                      <td>
                        <Link to={`/teacher/students/${s.id}`} style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {s.displayName}
                        </Link>
                      </td>
                      <td style={{ color: 'var(--text3)', fontFamily: 'monospace', fontSize: '.85rem' }}>
                        {s.username || '—'}
                      </td>
                      <td>
                        <span className={`badge ${s.hasPassword ? 'success' : ''}`}>
                          {s.hasPassword ? '🔐 Active' : 'No account'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS ── */}
      {tab === 'settings' && (
        <div style={{ maxWidth: 500 }}>
          <div className="card">
            <h3 style={{ marginBottom: 20 }}>Login Settings</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 16px', borderRadius: 8, border: '1.5px solid var(--border)', background: allowAccountLogin ? 'rgba(32,85,212,.04)' : 'transparent' }}>
                <input type="checkbox" checked={allowAccountLogin} onChange={e => setAllowAccountLogin(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', width: 17, height: 17, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '.9rem' }}>👤 Account Login</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text3)' }}>Students log in with username and password</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 16px', borderRadius: 8, border: '1.5px solid var(--border)', background: allowCodeLogin ? 'rgba(32,85,212,.04)' : 'transparent' }}>
                <input type="checkbox" checked={allowCodeLogin} onChange={e => setAllowCodeLogin(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', width: 17, height: 17, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '.9rem' }}>🔑 Class Code Login</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text3)' }}>Students type their name and class code</div>
                </div>
              </label>
            </div>

            <label className="small">Code Mode Policy</label>
            <select className="input" value={policy} onChange={e => setPolicy(e.target.value)} style={{ marginBottom: 4 }}>
              <option value="ROSTER_ONLY">Roster Only — only enrolled students can use the code</option>
              <option value="FREE_TYPING">Free Typing — auto-enroll anyone who types the code</option>
            </select>

            <label className="small">Change Join PIN <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(leave blank to keep existing)</span></label>
            <input className="input" value={joinPin} onChange={e => setJoinPin(e.target.value)} placeholder="e.g., 1234" />

            <div style={{ marginTop: 20 }}>
              <button className="btn" onClick={saveSettings}>Save Settings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
