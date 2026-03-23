import React, { useState } from 'react'
import { api } from '../lib/api'
import { saveAuth, loadAuth } from '../lib/auth'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const nav = useNavigate()
  const existing = loadAuth()
  const [tab, setTab] = useState('teacher')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [suser, setSuser] = useState('')
  const [spass, setSpass] = useState('')
  const [classCode, setClassCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [joinPin, setJoinPin] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function loginUser() {
    if (!username.trim()) { setErr('Username is required'); return }
    setErr(''); setLoading(true)
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: { username: username.trim(), password } })
      saveAuth({ type: 'USER', token: data.token, role: data.role, username: data.username })
      nav('/teacher')
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  async function loginStudent() {
    if (!suser.trim()) { setErr('Username is required'); return }
    setErr(''); setLoading(true)
    try {
      const data = await api('/api/auth/student-login', { method: 'POST', body: { username: suser.trim(), password: spass } })
      saveAuth({ type: 'STUDENT', token: data.token, displayName: data.displayName })
      nav('/student')
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  async function joinByCode() {
    if (!classCode.trim()) { setErr('Class code is required'); return }
    if (!displayName.trim()) { setErr('Your name is required'); return }
    setErr(''); setLoading(true)
    try {
      const data = await api('/api/auth/join-code', { method: 'POST', body: { classCode: classCode.trim(), displayName: displayName.trim(), joinPin: joinPin || undefined } })
      saveAuth({ type: 'STUDENT', token: data.token, displayName: data.displayName, classId: data.classId, className: data.className })
      nav('/student')
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  function handleKey(e, action) {
    if (e.key === 'Enter') action()
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        {/* ── LOGIN PAGE LOGO ── replace /logo.png in web/public/ ── */}
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
          <img src="/logo.png" alt="School Logo"
            style={{ height: 72, width: 'auto', objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
          <div style={{ display: 'none', fontSize: 56 }}>📚</div>
        </div>
        <h1 style={{ margin: 0, fontSize: 28 }}>MRLC GED</h1>
        <p className="small" style={{ marginTop: 4 }}>Exam & Quiz Platform</p>
      </div>

      {existing && (
        <div className="banner info" style={{ marginBottom: 16, textAlign: 'center' }}>
          You are already logged in — use the top menu.
        </div>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: 18 }}>
          {[['teacher', '🏫 Admin/Teacher'], ['student', '🎓 Student'], ['code', '🔑 Class Code']].map(([t, l]) => (
            <button key={t} className={`btn ${tab === t ? '' : 'secondary'}`} style={{ flex: 1 }}
              onClick={() => { setTab(t); setErr('') }}>
              {l}
            </button>
          ))}
        </div>

        {err && <div className="banner error" style={{ marginBottom: 14 }}>{err}</div>}

        {tab === 'teacher' && (
          <div>
            <h3>Admin / Teacher Login</h3>
            <label className="small">Username</label>
            <input className="input" value={username} onChange={e => setUsername(e.target.value)}
              onKeyDown={e => handleKey(e, loginUser)} autoFocus />
            <label className="small">Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => handleKey(e, loginUser)} />
            <div style={{ marginTop: 16 }}>
              <button className="btn full" onClick={loginUser} disabled={loading}>
                {loading ? <><span className="spinner"></span> Logging in…</> : 'Login'}
              </button>
            </div>
            <p className="small" style={{ textAlign: 'center', marginTop: 10 }}>
              Default: <code>admin</code> / <code>admin123</code>
            </p>
          </div>
        )}

        {tab === 'student' && (
          <div>
            <h3>Student Account Login</h3>
            <label className="small">Username</label>
            <input className="input" value={suser} onChange={e => setSuser(e.target.value)}
              onKeyDown={e => handleKey(e, loginStudent)} autoFocus />
            <label className="small">Password</label>
            <input className="input" type="password" value={spass} onChange={e => setSpass(e.target.value)}
              onKeyDown={e => handleKey(e, loginStudent)} />
            <div style={{ marginTop: 16 }}>
              <button className="btn full" onClick={loginStudent} disabled={loading}>
                {loading ? <><span className="spinner"></span> Logging in…</> : 'Login'}
              </button>
            </div>
          </div>
        )}

        {tab === 'code' && (
          <div>
            <h3>Join with Class Code</h3>
            <label className="small">Class Code</label>
            <input className="input" value={classCode} onChange={e => setClassCode(e.target.value)}
              placeholder="MRLC-XXXX" autoFocus onKeyDown={e => handleKey(e, joinByCode)} />
            <label className="small">Your Name</label>
            <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="Full name" onKeyDown={e => handleKey(e, joinByCode)} />
            <label className="small">PIN (if required)</label>
            <input className="input" value={joinPin} onChange={e => setJoinPin(e.target.value)}
              placeholder="Leave blank if none" onKeyDown={e => handleKey(e, joinByCode)} />
            <div style={{ marginTop: 16 }}>
              <button className="btn full" onClick={joinByCode} disabled={loading}>
                {loading ? <><span className="spinner"></span> Joining…</> : 'Join Class'}
              </button>
            </div>
            <p className="small" style={{ marginTop: 8 }}>
              Your name must be on the roster if Roster Only mode is enabled.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
