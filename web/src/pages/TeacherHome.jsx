import React, { useEffect, useState, useRef } from 'react'
import { api } from '../lib/api'
import { loadAuth } from '../lib/auth'
import { Link } from 'react-router-dom'

const SUBJ_ICONS = ['📖','🔢','🔬','🌍']

export default function TeacherHome() {
  const auth = loadAuth()
  const [classes, setClasses] = useState([])
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const trackRef = useRef(null)
  const scrollTrack = (dir) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }

  useEffect(() => {
    if (!auth?.token) return
    api('/api/classes', { token: auth.token }).then(d => setClasses(d.classes)).catch(e => setErr(e.message))
  }, [])

  async function createClass() {
    setErr(''); setMsg('')
    try {
      const d = await api('/api/classes', { token: auth.token, method: 'POST', body: { name } })
      setClasses([d.class, ...classes]); setName(''); setMsg('✓ Class created!')
    } catch (e) { setErr(e.message) }
  }

  if (!auth || auth.type !== 'USER') return <div className="card">Please login as Admin/Teacher.</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Dashboard</h2>
          <p>Welcome back, <strong>{auth.username}</strong> · <span className="badge accent">{auth.role}</span></p>
        </div>
        <div className="row">
          <Link to="/teacher/students" className="btn secondary">👥 Students</Link>
          {auth.role === 'ADMIN' && <Link to="/teacher/users" className="btn secondary">🔐 Users</Link>}
        </div>
      </div>

      {err && <div className="banner error" style={{ marginBottom: 14 }}>{err}</div>}
      {msg && <div className="banner success" style={{ marginBottom: 14 }}>{msg}</div>}

      <div className="card" style={{ marginBottom: 28 }}>
        <h3 style={{ marginBottom: 16 }}>Create New Class</h3>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="small">Class Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name.trim() && createClass()}
              placeholder="e.g., MRLC GED Batch 2026-A" />
          </div>
          <button className="btn" onClick={createClass} disabled={!name.trim()}>Create</button>
        </div>
      </div>

      <div className="section-title">
        <h3>Your Classes</h3>
        <span className="badge">{classes.length}</span>
      </div>

      {classes.length === 0 && (
        <div className="empty-state">
          <div className="icon">🏫</div>
          <p>No classes yet. Create one above to get started.</p>
        </div>
      )}

      <div className="carousel">
        <button className="carousel-nav left" onClick={() => scrollTrack(-1)} aria-label="Scroll left">‹</button>
        <div className="carousel-track" ref={trackRef}>
        {classes.map((c, i) => (
          <div key={c.id} className="card carousel-item" style={{ minWidth: 255 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ fontSize: 32 }}>{SUBJ_ICONS[i % 4]}</div>
              <span className="badge accent" style={{ fontFamily: 'monospace', letterSpacing: '.05em' }}>{c.classCode}</span>
            </div>
            <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>{c.name}</h3>
            <p style={{ fontSize: '.8rem', color: 'var(--text3)', marginBottom: 16 }}>
              {[c.allowAccountLogin && 'Account', c.allowCodeLogin && 'Code'].filter(Boolean).join(' + ')} login
            </p>
            <div className="row">
              <Link to={`/teacher/class/${c.id}`} className="btn sm">Open →</Link>
              <Link to={`/teacher/questions/${c.id}`} className="btn ghost sm">❓ Qs</Link>
              <Link to={`/teacher/quizzes/${c.id}`} className="btn ghost sm">📝</Link>
            </div>
          </div>
        ))}
      </div>
      <button className="carousel-nav right" onClick={() => scrollTrack(1)} aria-label="Scroll right">›</button>
    </div>
    </div>
  )
}
