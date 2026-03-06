import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function BackButton({ to, label = 'Back' }) {
  const nav = useNavigate()
  return (
    <button
      className="btn ghost sm"
      onClick={() => to ? nav(to) : nav(-1)}
      style={{ marginBottom: 16 }}
    >
      ← {label}
    </button>
  )
}
