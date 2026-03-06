import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { loadAuth } from '../lib/auth'
import { Link } from 'react-router-dom'

export default function Students() {
  const auth = loadAuth()
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editUser, setEditUser] = useState('')
  const [editPass, setEditPass] = useState('')

  useEffect(() => {
    if (!auth?.token) return
    Promise.all([
      api('/api/students', { token: auth.token }),
      api('/api/classes', { token: auth.token })
    ]).then(([sd, cd]) => { setStudents(sd.students); setClasses(cd.classes) })
      .catch(e => setErr(e.message))
  }, [])

  async function deleteStudent(id, name) {
    if (!confirm(`Delete ${name}? This will remove all their attempts.`)) return
    try {
      await api(`/api/students/${id}`, { token: auth.token, method: 'DELETE' })
      setStudents(students.filter(s => s.id !== id))
      setMsg('✓ Student removed.')
    } catch (e) { setErr(e.message) }
  }

  async function saveEdit(id) {
    setErr('')
    try {
      const body = { displayName: editName }
      if (editUser.trim()) body.username = editUser
      if (editPass.trim()) body.password = editPass
      const d = await api(`/api/students/${id}`, { token: auth.token, method: 'PATCH', body })
      setStudents(students.map(s => s.id === id ? { ...s, ...d.student } : s))
      setEditId(null); setMsg('✓ Updated.')
    } catch (e) { setErr(e.message) }
  }

  const filtered = students.filter(s => {
    const matchSearch = !search || s.displayName.toLowerCase().includes(search.toLowerCase()) || (s.username || '').toLowerCase().includes(search.toLowerCase())
    const matchClass = !filterClass || s.classes?.some(c => c.id === filterClass)
    return matchSearch && matchClass
  })

  if (!auth || auth.type !== 'USER') return <div className="card">Please login as Admin/Teacher.</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link to="/teacher" style={{ fontSize: '.875rem', color: 'var(--text3)' }}>← Dashboard</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>All Students</h2>
          <p style={{ fontSize: '.875rem' }}>{students.length} total students</p>
        </div>
      </div>

      {err && <div className="banner error" style={{ marginBottom: 14 }}>{err}</div>}
      {msg && <div className="banner success" style={{ marginBottom: 14 }}>{msg}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row">
          <div style={{ flex: 2, minWidth: 180 }}>
            <label className="small">Search</label>
            <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or username…" />
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label className="small">Filter by Class</label>
            <select className="input" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {filtered.length === 0 && <div className="empty-state"><div className="icon">👥</div><p>No students found.</p></div>}

      {filtered.length > 0 && (
        <div className="card flush">
          <table>
            <thead>
              <tr><th>Name</th><th>Username</th><th>Classes</th><th>Account</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <React.Fragment key={s.id}>
                  <tr>
                    <td>
                      <Link to={`/teacher/students/${s.id}`} style={{ fontWeight: 600 }}>{s.displayName}</Link>
                      {s.attemptCount > 0 && <span className="badge" style={{ marginLeft: 6, fontSize: '.7rem' }}>{s.attemptCount} attempts</span>}
                    </td>
                    <td style={{ color: 'var(--text3)' }}>{s.username || '—'}</td>
                    <td style={{ fontSize: '.8rem' }}>
                      {s.classes?.map(c => <span key={c.id} className="badge" style={{ marginRight: 4 }}>{c.name}</span>)}
                    </td>
                    <td><span className={`badge ${s.hasPassword ? 'success' : ''}`}>{s.hasPassword ? '🔐' : '—'}</span></td>
                    <td>
                      <div className="row nowrap">
                        <Link to={`/teacher/students/${s.id}`} className="btn ghost xs">View</Link>
                        <button className="btn ghost xs" onClick={() => { setEditId(editId === s.id ? null : s.id); setEditName(s.displayName); setEditUser(s.username || ''); setEditPass('') }}>Edit</button>
                        <button className="btn danger xs" onClick={() => deleteStudent(s.id, s.displayName)}>✕</button>
                      </div>
                    </td>
                  </tr>
                  {editId === s.id && (
                    <tr>
                      <td colSpan={5} style={{ background: 'var(--bg3)', padding: '12px 16px' }}>
                        <div className="row">
                          <div style={{ flex: 2, minWidth: 160 }}>
                            <label className="small">Name</label>
                            <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
                          </div>
                          <div style={{ flex: 1, minWidth: 130 }}>
                            <label className="small">Username</label>
                            <input className="input" value={editUser} onChange={e => setEditUser(e.target.value)} />
                          </div>
                          <div style={{ flex: 1, minWidth: 130 }}>
                            <label className="small">New Password</label>
                            <input className="input" type="password" value={editPass} onChange={e => setEditPass(e.target.value)} placeholder="leave blank to keep" />
                          </div>
                          <div style={{ alignSelf: 'flex-end', display: 'flex', gap: 6 }}>
                            <button className="btn sm" onClick={() => saveEdit(s.id)}>Save</button>
                            <button className="btn secondary sm" onClick={() => setEditId(null)}>Cancel</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
