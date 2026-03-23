import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { loadAuth } from '../lib/auth'
import { Link } from 'react-router-dom'

function parseCsv(text) {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g,''))
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g,''))
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cols[i] || '' })
    return obj
  }).filter(r => r.name || r.displayname)
    .map(r => ({ displayName: r.displayname || r.name, username: r.username || '', password: r.password || '' }))
}

export default function Students() {
  const auth = loadAuth()
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [confirmState, setConfirmState] = useState(null)
  const [tab, setTab] = useState('list')
  // Edit
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editUser, setEditUser] = useState('')
  const [editPass, setEditPass] = useState('')
  // Password reset
  const [resetId, setResetId] = useState(null)
  const [resetPass, setResetPass] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  // CSV import
  const [importClassId, setImportClassId] = useState('')
  const [csvText, setCsvText] = useState('')
  const [csvPreview, setCsvPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  async function load() {
    const [sd, cd] = await Promise.all([
      api('/api/students', { token: auth.token }),
      api('/api/classes', { token: auth.token })
    ])
    setStudents(sd.students)
    setClasses(cd.classes)
    if (!importClassId && cd.classes.length) setImportClassId(cd.classes[0].id)
  }

  useEffect(() => { if (auth?.token) load().catch(e => setErr(e.message)) }, [])

  function startEdit(s) {
    setEditId(s.id); setEditName(s.displayName); setEditUser(s.username || ''); setEditPass('')
    setResetId(null)
  }

  async function saveEdit() {
    setErr(''); setMsg('')
    try {
      const body = { displayName: editName }
      if (editUser) body.username = editUser
      if (editPass) body.password = editPass
      await api(`/api/students/${editId}`, { token: auth.token, method: 'PATCH', body })
      setMsg('✓ Student updated.')
      setEditId(null)
      await load()
    } catch (e) { setErr(e.message) }
  }

  async function doResetPassword() {
    if (!resetPass.trim() || resetPass.trim().length < 4) { setErr('Password must be at least 4 characters'); return }
    setResetSaving(true); setErr(''); setMsg('')
    try {
      await api(`/api/students/${resetId}/reset-password`, {
        token: auth.token, method: 'POST', body: { newPassword: resetPass.trim() }
      })
      setMsg('✓ Password reset successfully.')
      setResetId(null); setResetPass('')
      await load()
    } catch (e) { setErr(e.message) }
    setResetSaving(false)
  }

  function deleteStudent(id, name) {
    setConfirmState({
      title: `Delete ${name}?`,
      message: 'This removes their account and all quiz attempts. This cannot be undone.',
      danger: true,
      confirmLabel: 'Delete Student',
      onConfirm: () => doDeleteStudent(id)
    })
  }
  async function doDeleteStudent(id) {
    try {
      await api(`/api/students/${id}`, { token: auth.token, method: 'DELETE' })
      setMsg(`✓ ${name} deleted.`)
      setStudents(prev => prev.filter(s => s.id !== id))
    } catch (e) { setErr(e.message) }
  }

  function handleCsvFile(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target.result
      setCsvText(text)
      setCsvPreview(parseCsv(text))
      setImportResult(null)
    }
    reader.readAsText(file)
  }

  function handleCsvPaste(e) {
    const text = e.target.value
    setCsvText(text)
    setCsvPreview(parseCsv(text))
    setImportResult(null)
  }

  async function runImport() {
    if (!importClassId) { setErr('Select a class first'); return }
    if (!csvPreview.length) { setErr('No valid rows to import'); return }
    setImporting(true); setErr(''); setImportResult(null)
    try {
      const result = await api('/api/students/import', {
        token: auth.token, method: 'POST',
        body: { classId: importClassId, students: csvPreview }
      })
      setImportResult(result)
      setCsvText(''); setCsvPreview([])
      await load()
    } catch (e) { setErr(e.message) }
    setImporting(false)
  }

  const filtered = students.filter(s => {
    const matchSearch = !search || s.displayName.toLowerCase().includes(search.toLowerCase()) ||
      (s.username||'').toLowerCase().includes(search.toLowerCase())
    const matchClass = !filterClass || s.classes?.some(c => c.id === filterClass)
    return matchSearch && matchClass
  })

  if (!auth || auth.type !== 'USER') return <div className="card">Please login as Admin/Teacher.</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>👥 Students</h2>
          <p style={{ color: 'var(--text3)', fontSize: '.875rem' }}>{students.length} total students across all classes</p>
        </div>
      </div>

      {err && <div className="banner error" style={{ marginBottom: 14 }}>{err}</div>}
      {msg && <div className="banner success" style={{ marginBottom: 14, cursor:'pointer' }} onClick={() => setMsg('')}>{msg}</div>}

      <div className="tab-bar" style={{ marginBottom: 24 }}>
        {[['list', `📋 All Students (${students.length})`], ['import', '📥 Bulk Import CSV']].map(([t, l]) => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {/* ── STUDENT LIST ── */}
      {tab === 'list' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input className="input" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search by name or username…" style={{ flex: '1 1 200px' }} />
            <select className="input" value={filterClass} onChange={e => setFilterClass(e.target.value)} style={{ flex: '0 0 auto', minWidth: 160 }}>
              <option value="">All classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {filtered.length === 0 && (
            <div className="empty-state"><div className="icon">👥</div><p>No students found.</p></div>
          )}

          {filtered.map(s => (
            <div key={s.id} className="card" style={{ marginBottom: 10 }}>
              {editId === s.id ? (
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>✏️ Editing: {s.displayName}</div>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: '2 1 180px' }}>
                      <label className="small">Full Name</label>
                      <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                      <label className="small">Username</label>
                      <input className="input" value={editUser} onChange={e => setEditUser(e.target.value)} placeholder="username" />
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                      <label className="small">New Password (optional)</label>
                      <input className="input" type="password" value={editPass} onChange={e => setEditPass(e.target.value)} placeholder="leave blank to keep" />
                    </div>
                  </div>
                  <div className="row nowrap">
                    <button className="btn" onClick={saveEdit}>Save</button>
                    <button className="btn ghost" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                </div>
              ) : resetId === s.id ? (
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>🔑 Reset password for: {s.displayName}</div>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: '1 1 220px' }}>
                      <label className="small">New Password (min 4 chars)</label>
                      <input className="input" type="text" value={resetPass} onChange={e => setResetPass(e.target.value)}
                        placeholder="e.g. newpass123" autoFocus
                        onKeyDown={e => e.key === 'Enter' && doResetPassword()} />
                    </div>
                  </div>
                  <div className="row nowrap">
                    <button className="btn warning" onClick={doResetPassword} disabled={resetSaving}>
                      {resetSaving ? <span className="spinner"></span> : '🔑 Reset Password'}
                    </button>
                    <button className="btn ghost" onClick={() => { setResetId(null); setResetPass('') }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: '.95rem', flexShrink: 0
                    }}>
                      {s.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        <Link to={`/teacher/students/${s.id}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>{s.displayName}</Link>
                      </div>
                      <div style={{ fontSize: '.8rem', color: 'var(--text3)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                        {s.username && <span>@{s.username}</span>}
                        <span>{s.attemptCount || 0} attempt{s.attemptCount !== 1 ? 's' : ''}</span>
                        {s.classes?.map(c => <span key={c.id} className="badge" style={{ fontSize: '.7rem' }}>{c.name}</span>)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className={`badge ${s.hasPassword ? 'success' : ''}`} style={{ fontSize: '.72rem' }}>
                      {s.hasPassword ? '🔐 Account' : 'No login'}
                    </span>
                    <Link to={`/teacher/students/${s.id}`} className="btn ghost xs">📊 Profile</Link>
                    <button className="btn ghost xs" onClick={() => startEdit(s)}>✏️ Edit</button>
                    <button className="btn ghost xs" style={{ color: 'var(--warning)' }}
                      onClick={() => { setResetId(s.id); setResetPass(''); setEditId(null) }}>🔑 Reset PW</button>
                    <button className="btn ghost xs" style={{ color: 'var(--danger)' }}
                      onClick={() => deleteStudent(s.id, s.displayName)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── BULK CSV IMPORT ── */}
      {tab === 'import' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12 }}>📥 Bulk Import Students via CSV</h3>
            <div className="banner info" style={{ marginBottom: 16 }}>
              <strong>CSV Format:</strong> First row must be a header. Required column: <code>name</code> or <code>displayName</code>. Optional: <code>username</code>, <code>password</code><br/>
              <strong>Example:</strong> <code>name,username,password</code><br/><code>Juan dela Cruz,juan,pass123</code>
            </div>

            <label className="small">Assign to Class *</label>
            <select className="input" value={importClassId} onChange={e => setImportClassId(e.target.value)} style={{ marginBottom: 16 }}>
              <option value="">— select class —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <label className="small">Upload CSV File</label>
            <input type="file" accept=".csv,.txt" onChange={handleCsvFile}
              style={{ display: 'block', marginBottom: 12, color: 'var(--text2)', fontSize: '.875rem' }} />

            <label className="small">Or paste CSV content</label>
            <textarea className="input" rows={6} value={csvText} onChange={handleCsvPaste}
              placeholder={"name,username,password\nJuan dela Cruz,juan,pass123\nMaria Santos,,"}
              style={{ fontFamily: 'monospace', fontSize: '.82rem', resize: 'vertical' }} />
          </div>

          {csvPreview.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Preview — {csvPreview.length} student{csvPreview.length !== 1 ? 's' : ''}</h3>
                <button className="btn" onClick={runImport} disabled={importing || !importClassId}>
                  {importing ? <><span className="spinner"></span> Importing…</> : `⬆️ Import ${csvPreview.length} Students`}
                </button>
              </div>
              <div className="card flush">
                <table>
                  <thead><tr><th>#</th><th>Name</th><th>Username</th><th>Password</th></tr></thead>
                  <tbody>
                    {csvPreview.slice(0, 20).map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text3)' }}>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{r.displayName}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '.85rem', color: 'var(--text3)' }}>{r.username || '—'}</td>
                        <td style={{ color: 'var(--text3)', fontSize: '.85rem' }}>{r.password ? '••••••' : '—'}</td>
                      </tr>
                    ))}
                    {csvPreview.length > 20 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '.82rem' }}>…and {csvPreview.length - 20} more</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importResult && (
            <div className="card">
              <h3 style={{ marginBottom: 12 }}>✅ Import Complete</h3>
              <div className="stat-grid" style={{ marginBottom: 12 }}>
                <div className="stat-card"><div className="val" style={{ color: 'var(--success)' }}>{importResult.created}</div><div className="lbl">Created</div></div>
                <div className="stat-card"><div className="val">{importResult.skipped}</div><div className="lbl">Already Existed</div></div>
                <div className="stat-card"><div className="val" style={{ color: importResult.errors?.length ? 'var(--danger)' : 'var(--success)' }}>{importResult.errors?.length || 0}</div><div className="lbl">Errors</div></div>
              </div>
              {importResult.errors?.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--danger)' }}>Errors:</div>
                  {importResult.errors.map((e, i) => <div key={i} style={{ fontSize: '.82rem', color: 'var(--danger)', marginBottom: 4 }}>• {e}</div>)}
                </div>
              )}
            </div>
          )}

          {csvPreview.length === 0 && !importResult && (
            <div className="empty-state">
              <div className="icon">📄</div>
              <p>Upload a CSV file or paste content above to preview students before importing.</p>
              <a href="data:text/csv;charset=utf-8,name%2Cusername%2Cpassword%0AJuan+dela+Cruz%2Cjuan%2Cpass123%0AMaria+Santos%2C%2C"
                download="students-template.csv" className="btn secondary" style={{ marginTop: 12 }}>
                ⬇️ Download Template CSV
              </a>
            </div>
          )}
        </div>
      )}
      {confirmState && <ConfirmModal {...confirmState} onClose={() => setConfirmState(null)} />}
    </div>
  )
}
