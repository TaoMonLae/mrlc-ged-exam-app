import React from 'react'

/**
 * Drop-in replacement for window.confirm()
 *
 * Usage:
 *   const [confirmState, setConfirmState] = useState(null)
 *
 *   // Trigger:
 *   setConfirmState({
 *     title: 'Delete class?',
 *     message: 'This cannot be undone.',
 *     danger: true,               // red confirm button
 *     confirmLabel: 'Delete',     // defaults to 'Confirm'
 *     onConfirm: () => doDelete()
 *   })
 *
 *   // Render (anywhere in return):
 *   {confirmState && <ConfirmModal {...confirmState} onClose={() => setConfirmState(null)} />}
 */
export default function ConfirmModal({ title, message, danger = false, confirmLabel = 'Confirm', onConfirm, onClose }) {
  function handleConfirm() {
    onClose()
    onConfirm()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 24 }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 420, width: '100%', margin: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: 10 }}>{title}</h3>
        {message && (
          <p style={{ color: 'var(--text2)', fontSize: '.9rem', lineHeight: 1.6, marginBottom: 20 }}>
            {message}
          </p>
        )}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className={`btn ${danger ? 'danger' : ''}`} onClick={handleConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
