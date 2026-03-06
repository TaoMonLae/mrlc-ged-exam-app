import React from "react";
import { useNavigate } from "react-router-dom";

export default function BackBar({ to = -1, title = "" }) {
  const nav = useNavigate();
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
      <button className="btn secondary" onClick={() => nav(to)}>← Back</button>
      {title ? <strong>{title}</strong> : null}
    </div>
  );
}
