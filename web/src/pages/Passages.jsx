import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { loadAuth } from '../lib/auth'
import BackBar from "../components/BackBar.jsx"
import ConfirmModal from '../components/ConfirmModal.jsx'

export default function Passages() {
  const { classId } = useParams()
  const auth = loadAuth()
  const [subject, setSubject] = useState('RLA')
  const [passages, setPassages] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  // Create form
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  // Edit state
  const [editId, setEditId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  // Expand
  const [expanded, setExpanded] = useState(null)
  const [confirmState, setConfirmState] = useState(null)

  async function refresh() {
    const d = await api(`/api/passages?classId=${classId}&subject=${subject}`, { token: auth.token })
    setPassages(d.passages)
  }

  useEffect(() => {
    if (!auth?.token) return
    refresh().catch(e => setErr(e.message))
  }, [subject])

  async function create() {
    setSaving(true); setErr(''); setMsg('')
    try {
      await api('/api/passages', { token: auth.token, method: 'POST', body: { classId, subject, title, content } })
      setTitle(''); setContent('')
      setMsg('✓ Passage saved!')
      await refresh()
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  function startEdit(p) {
    setEditId(p.id); setEditTitle(p.title); setEditContent(p.content)
  }

  async function saveEdit() {
    setEditSaving(true); setErr('')
    try {
      await api(`/api/passages/${editId}`, { token: auth.token, method: 'PATCH', body: { title: editTitle, content: editContent } })
      setEditId(null)
      setMsg('✓ Passage updated.')
      await refresh()
    } catch (e) { setErr(e.message) }
    setEditSaving(false)
  }

  function deletePassage(id, title) {
    setConfirmState({
      title: `Delete "${title}"?`,
      message: 'Questions linked to this passage will be unlinked. This cannot be undone.',
      danger: true,
      confirmLabel: 'Delete Passage',
      onConfirm: () => doDeletePassage(id)
    })
  }
  async function doDeletePassage(id) {
    try {
      await api(`/api/passages/${id}`, { token: auth.token, method: 'DELETE' })
      setPassages(passages.filter(p => p.id !== id))
      setMsg('✓ Passage deleted.')
    } catch (e) { setErr(e.message) }
  }

  if (!auth || auth.type !== 'USER') return <div className="card">Please login as Admin/Teacher.</div>

  return (
    <div>
      <BackBar to={`/teacher/class/${classId}`} title="Back to Class" />
      <div className="page-header">
        <h2>📄 Passage Library</h2>
        <p style={{ marginTop: 4 }}>Reading passages for RLA, Science, and Social Studies questions.</p>
      </div>

      {err && <div className="banner error" style={{ marginBottom: 14 }}>{err}</div>}
      {msg && <div className="banner success" style={{ marginBottom: 14 }}>{msg}</div>}

      {/* Subject filter */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        {['RLA','SCIENCE','SOCIAL_STUDIES'].map(s => (
          <button key={s} className={`tab-btn ${subject === s ? 'active' : ''}`} onClick={() => setSubject(s)}>
            {s === 'SOCIAL_STUDIES' ? 'Social Studies' : s}
          </button>
        ))}
      </div>

      {/* Add new */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>➕ Add New Passage</h3>
        <label className="small">Title</label>
        <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., The Water Cycle" />
        <label className="small" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Passage Content</span>
          {content && (() => {
            const words = content.trim().split(/\s+/).filter(Boolean).length
            const mins = Math.ceil(words / 200)
            return <span style={{ fontWeight: 400, color: 'var(--text3)' }}>{words.toLocaleString()} words · ~{mins} min read</span>
          })()}
        </label>
        <textarea className="input" value={content} onChange={e => setContent(e.target.value)}
          placeholder="Paste or type the full passage text…" style={{ minHeight: 160 }} />
        <div style={{ marginTop: 14 }}>
          <button className="btn" onClick={create} disabled={!title.trim() || !content.trim() || saving}>
            {saving ? <><span className="spinner"></span> Saving…</> : 'Save Passage'}
          </button>
        </div>
      </div>

      {/* Passage list */}
      <div className="section-title">
        <h3>Saved Passages</h3>
        <span className="badge">{passages.length}</span>
      </div>

      {passages.length === 0 && (
        <div className="empty-state">
          <div className="icon">📄</div>
          <p>No passages yet for {subject}. Add one above.</p>
        </div>
      )}

      {passages.map(p => (
        <div key={p.id} className="card" style={{ marginBottom: 12 }}>
          {editId === p.id ? (
            // Edit form inline
            <div>
              <label className="small">Title</label>
              <input className="input" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
              <label className="small" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Content</span>
                {editContent && (() => {
                  const words = editContent.trim().split(/\s+/).filter(Boolean).length
                  return <span style={{ fontWeight: 400, color: 'var(--text3)' }}>{words.toLocaleString()} words</span>
                })()}
              </label>
              <textarea className="input" value={editContent} onChange={e => setEditContent(e.target.value)} style={{ minHeight: 140 }} />
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn sm" onClick={saveEdit} disabled={editSaving}>
                  {editSaving ? <><span className="spinner"></span></> : '✓ Save'}
                </button>
                <button className="btn secondary sm" onClick={() => setEditId(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ fontSize: '1rem' }}>{p.title}</strong>
                  <div style={{ marginTop: 4, fontSize: '.8rem', color: 'var(--text3)' }}>
                    {(() => {
                      const words = p.content.trim().split(/\s+/).filter(Boolean).length
                      const mins = Math.ceil(words / 200)
                      return `${new Date(p.createdAt).toLocaleDateString()} · ${words.toLocaleString()} words · ~${mins} min read`
                    })()}
                  </div>
                </div>
                <div className="row nowrap">
                  <button className="btn ghost sm" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                    {expanded === p.id ? '▲ Hide' : '▼ View'}
                  </button>
                  <button className="btn ghost sm" onClick={() => startEdit(p)}>✏️ Edit</button>
                  <button className="btn danger sm" onClick={() => deletePassage(p.id, p.title)}>🗑️</button>
                </div>
              </div>
              {expanded === p.id && (
                <div style={{ marginTop: 14, background: 'var(--bg3)', borderRadius: 8, padding: '14px 16px', fontSize: '.875rem', lineHeight: 1.75, color: 'var(--text2)', whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                  {p.content}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {confirmState && <ConfirmModal {...confirmState} onClose={() => setConfirmState(null)} />}
    </div>
  )
}