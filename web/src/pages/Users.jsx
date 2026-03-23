import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { loadAuth } from '../lib/auth'

export default function Users() {
  const auth = loadAuth()
  const [users, setUsers] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  // Change my password
  const [curPass, setCurPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [changingSelf, setChangingSelf] = useState(false)

  // Create teacher
  const [newUser, setNewUser] = useState('')
  const [newTeacherPass, setNewTeacherPass] = useState('')
  const [creating, setCreating] = useState(false)

  // Reset user password
  const [resetId, setResetId] = useState('')
  const [resetPass, setResetPass] = useState('')
  const [resetting, setResetting] = useState(false)

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null)

  async function refresh() {
    if (auth?.role !== 'ADMIN') return
    const d = await api('/api/auth/users', { token: auth.token })
    setUsers(d.users)
  }

  useEffect(() => {
    if (!auth?.token || auth.type !== 'USER') return
    refresh().catch(() => {})
  }, [])

  function flash(m, isErr = false) {
    if (isErr) setErr(m)
    else { setMsg(m); setErr('') }
    setTimeout(() => { setMsg(''); setErr('') }, 4000)
  }

  async function changeMyPassword() {
    if (!curPass || !newPass) return flash('Both fields required.', true)
    if (newPass.length < 6) return flash('New password must be at least 6 characters.', true)
    setChangingSelf(true)
    try {
      await api('/api/auth/change-password', {
        token: auth.token, method: 'POST',
        body: { currentPassword: curPass, newPassword: newPass }
      })
      setCurPass(''); setNewPass('')
      flash('✓ Password updated successfully.')
    } catch (e) { flash(e.message, true) }
    setChangingSelf(false)
  }

  async function createTeacher() {
    if (!newUser.trim() || !newTeacherPass) return flash('Username and password required.', true)
    if (newTeacherPass.length < 6) return flash('Password must be at least 6 characters.', true)
    setCreating(true)
    try {
      await api('/api/auth/create-teacher', {
        token: auth.token, method: 'POST',
        body: { username: newUser.trim(), password: newTeacherPass }
      })
      setNewUser(''); setNewTeacherPass('')
      flash('✓ Teacher account created.')
      await refresh()
    } catch (e) { flash(e.message, true) }
    setCreating(false)
  }

  async function resetUserPassword() {
    if (!resetId || !resetPass) return flash('Select a user and enter new password.', true)
    if (resetPass.length < 6) return flash('Password must be at least 6 characters.', true)
    setResetting(true)
    try {
      await api('/api/auth/reset-user-password', {
        token: auth.token, method: 'POST',
        body: { userId: resetId, newPassword: resetPass }
      })
      setResetId(''); setResetPass('')
      flash('✓ Password reset successfully.')
    } catch (e) { flash(e.message, true) }
    setResetting(false)
  }

  async function deleteUser(id) {
    try {
      await api(`/api/auth/users/${id}`, { token: auth.token, method: 'DELETE' })
      setDeleteId(null)
      flash('✓ User deleted.')
      await refresh()
    } catch (e) { flash(e.message, true) }
  }

  if (!auth || auth.type !== 'USER') return <div className="card">Please login as Admin/Teacher.</div>

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ marginBottom: 4 }}>🔐 User Management</h2>
        <p style={{ color: 'var(--text3)', fontSize: '.875rem' }}>Manage teacher accounts and your own password.</p>
      </div>

      {err && <div className="banner error" style={{ marginBottom: 14 }}>{err}</div>}
      {msg && <div className="banner success" style={{ marginBottom: 14 }}>{msg}</div>}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="card" style={{ maxWidth: 380, width: '90%' }}>
            <h3 style={{ marginBottom: 8 }}>⚠️ Delete User?</h3>
            <p style={{ marginBottom: 20, color: 'var(--text2)', fontSize: '.9rem' }}>
              This will permanently delete the teacher account: <strong>{users.find(u => u.id === deleteId)?.username}</strong>. This cannot be undone.
            </p>
            <div className="row nowrap">
              <button className="btn danger" onClick={() => deleteUser(deleteId)}>Delete</button>
              <button className="btn ghost" onClick={() => setDeleteId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Change own password — available to all users */}
      <div className="card" style={{ marginBottom: 16, maxWidth: 460 }}>
        <h3 style={{ marginBottom: 16 }}>🔑 Change My Password</h3>
        <label className="small">Current Password</label>
        <input className="input" type="password" value={curPass} onChange={e => setCurPass(e.target.value)}
          placeholder="Current password" style={{ marginBottom: 10 }} />
        <label className="small">New Password (min 6 chars)</label>
        <input className="input" type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
          placeholder="New password"
          onKeyDown={e => e.key === 'Enter' && changeMyPassword()} />
        <div style={{ marginTop: 14 }}>
          <button className="btn" onClick={changeMyPassword} disabled={changingSelf || !curPass || !newPass}>
            {changingSelf ? <><span className="spinner"></span> Saving…</> : 'Update Password'}
          </button>
        </div>
      </div>

      {/* Admin-only section */}
      {auth.role !== 'ADMIN' ? (
        <div className="banner info">ℹ️ Only Admin accounts can create, reset, or delete other users.</div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>

            {/* Create teacher */}
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>➕ Create Teacher Account</h3>
              <label className="small">Username</label>
              <input className="input" value={newUser} onChange={e => setNewUser(e.target.value)}
                placeholder="e.g., teacher_juan" style={{ marginBottom: 10 }} />
              <label className="small">Password (min 6 chars)</label>
              <input className="input" type="password" value={newTeacherPass} onChange={e => setNewTeacherPass(e.target.value)}
                placeholder="••••••"
                onKeyDown={e => e.key === 'Enter' && createTeacher()} />
              <div style={{ marginTop: 14 }}>
                <button className="btn success" onClick={createTeacher} disabled={creating || !newUser.trim() || !newTeacherPass}>
                  {creating ? <><span className="spinner"></span> Creating…</> : 'Create Teacher'}
                </button>
              </div>
            </div>

            {/* Reset password */}
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>🔄 Reset User Password</h3>
              <label className="small">Select User</label>
              <select className="input" value={resetId} onChange={e => setResetId(e.target.value)} style={{ marginBottom: 10 }}>
                <option value="">— select user —</option>
                {users.filter(u => u.id !== auth.userId).map(u => (
                  <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                ))}
              </select>
              <label className="small">New Password (min 6 chars)</label>
              <input className="input" type="password" value={resetPass} onChange={e => setResetPass(e.target.value)}
                placeholder="••••••"
                onKeyDown={e => e.key === 'Enter' && resetUserPassword()} />
              <div style={{ marginTop: 14 }}>
                <button className="btn warning" onClick={resetUserPassword} disabled={resetting || !resetId || !resetPass}>
                  {resetting ? <><span className="spinner"></span> Resetting…</> : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>

          {/* Users table */}
          <h3 style={{ marginBottom: 14 }}>All Users ({users.length})</h3>
          {users.length === 0 && (
            <div className="empty-state"><div className="icon">👤</div><p>No users found.</p></div>
          )}
          {users.length > 0 && (
            <div className="card flush">
              <table>
                <thead>
                  <tr><th>Username</th><th>Role</th><th>Created</th><th></th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: u.role === 'ADMIN' ? 'var(--accent)' : 'var(--bg3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '.8rem', fontWeight: 700,
                            color: u.role === 'ADMIN' ? '#fff' : 'var(--text3)'
                          }}>
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 500 }}>{u.username}</span>
                          {u.id === auth.userId && <span className="badge accent" style={{ fontSize: '.68rem' }}>you</span>}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${u.role === 'ADMIN' ? 'accent' : 'success'}`}>{u.role}</span>
                      </td>
                      <td style={{ fontSize: '.8rem', color: 'var(--text3)' }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        {u.role !== 'ADMIN' && u.id !== auth.userId && (
                          <button className="btn ghost xs" style={{ color: 'var(--danger)' }}
                            onClick={() => setDeleteId(u.id)}>
                            🗑️ Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
