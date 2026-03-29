import React, { useState } from 'react'
import { api } from '../lib/api'
import { saveAuth, loadAuth } from '../lib/auth'
import { useNavigate } from 'react-router-dom'

const MODES = [
  { key: 'teacher', icon: '🏫', label: 'Admin / Teacher' },
  { key: 'student', icon: '🎓', label: 'Student Account' },
  { key: 'code',    icon: '🔑', label: 'Class Code' },
]

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

  const actions = { teacher: loginUser, student: loginStudent, code: joinByCode }

  return (
    <div className="tf-login-wrapper" style={{ marginTop: -24, marginBottom: -48 }}>
      <div className="tf-login-card">
        {/* Logo + branding */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
            <img
              src="/logo.png"
              alt="School Logo"
              style={{ height: 68, width: 'auto', objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }}
            />
            <div style={{ display: 'none', fontSize: 52 }}>📚</div>
          </div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: 4 }}>MRLC GED</h1>
          <p style={{ color: 'var(--text3)', fontSize: '.875rem', margin: 0 }}>Exam &amp; Quiz Platform</p>
        </div>

        {existing && (
          <div className="banner info" style={{ marginBottom: 20, textAlign: 'center' }}>
            You are already logged in — use the top menu.
          </div>
        )}

        {/* Mode selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {MODES.map(({ key, icon, label }) => (
            <button
              key={key}
              className={`tf-mode-btn ${tab === key ? 'active' : ''}`}
              onClick={() => { setTab(key); setErr('') }}
            >
              <div style={{ fontSize: 18, marginBottom: 3 }}>{icon}</div>
              <div style={{ lineHeight: 1.3 }}>{label}</div>
            </button>
          ))}
        </div>

        {err && <div className="banner error" style={{ marginBottom: 18 }}>{err}</div>}

        {/* ── Admin / Teacher ── */}
        {tab === 'teacher' && (
          <div>
            <label className="tf-field-label">Username</label>
            <input
              className="tf-field-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => handleKey(e, loginUser)}
              autoFocus
              autoComplete="username"
            />
            <label className="tf-field-label">Password</label>
            <input
              className="tf-field-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => handleKey(e, loginUser)}
              autoComplete="current-password"
            />
            <button className="btn full lg" onClick={loginUser} disabled={loading} style={{ marginTop: 28 }}>
              {loading ? <><span className="spinner"></span> Signing in…</> : 'Sign In →'}
            </button>
            <p style={{ textAlign: 'center', marginTop: 12, fontSize: '.78rem', color: 'var(--text3)' }}>
              Default: <code>admin</code> / <code>admin123</code>
            </p>
          </div>
        )}

        {/* ── Student Account ── */}
        {tab === 'student' && (
          <div>
            <label className="tf-field-label">Username</label>
            <input
              className="tf-field-input"
              value={suser}
              onChange={e => setSuser(e.target.value)}
              onKeyDown={e => handleKey(e, loginStudent)}
              autoFocus
              autoComplete="username"
            />
            <label className="tf-field-label">Password</label>
            <input
              className="tf-field-input"
              type="password"
              value={spass}
              onChange={e => setSpass(e.target.value)}
              onKeyDown={e => handleKey(e, loginStudent)}
              autoComplete="current-password"
            />
            <button className="btn full lg" onClick={loginStudent} disabled={loading} style={{ marginTop: 28 }}>
              {loading ? <><span className="spinner"></span> Signing in…</> : 'Sign In →'}
            </button>
          </div>
        )}

        {/* ── Class Code ── */}
        {tab === 'code' && (
          <div>
            <label className="tf-field-label">Class Code</label>
            <input
              className="tf-field-input"
              value={classCode}
              onChange={e => setClassCode(e.target.value)}
              placeholder="MRLC-XXXX"
              autoFocus
              onKeyDown={e => handleKey(e, joinByCode)}
            />
            <label className="tf-field-label">Your Name</label>
            <input
              className="tf-field-input"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Full name"
              onKeyDown={e => handleKey(e, joinByCode)}
            />
            <label className="tf-field-label">PIN <span style={{ fontWeight: 400, textTransform: 'none' }}>(if required)</span></label>
            <input
              className="tf-field-input"
              value={joinPin}
              onChange={e => setJoinPin(e.target.value)}
              placeholder="Leave blank if none"
              onKeyDown={e => handleKey(e, joinByCode)}
            />
            <button className="btn full lg" onClick={joinByCode} disabled={loading} style={{ marginTop: 28 }}>
              {loading ? <><span className="spinner"></span> Joining…</> : 'Join Class →'}
            </button>
            <p style={{ marginTop: 10, fontSize: '.78rem', color: 'var(--text3)', lineHeight: 1.5 }}>
              Your name must be on the roster if Roster Only mode is enabled.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
