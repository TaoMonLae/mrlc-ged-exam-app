import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import { loadAuth } from "../lib/auth";
import BackBar from "../components/BackBar.jsx";

function pretty(v) {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function StudentAttemptReview() {
  const { attemptId } = useParams();
  const auth = loadAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    const d = await api(`/api/attempts/${attemptId}/review`, { token: auth.token });
    setData(d);
  }

  useEffect(() => { load().catch(e => setErr(e.message)); }, [attemptId]);

  if (!auth?.token) return <div className="card">Please login.</div>;
  if (err) return <div className="card"><div className="alert error">{err}</div></div>;
  if (!data) return <div className="card">Loading...</div>;

  return (
    <div className="page">
      <BackBar to={`/student/home`} title="Back" />
      <div className="page-header">
        <h2>Review: {data.quiz.title}</h2>
        <div className="small">Score: {data.attempt.score} / {data.attempt.totalPoints}</div>
      </div>

      <div className="alert info" style={{ marginBottom: 12 }}>
        Teacher has released marks. You can review your answers and the correct answers.
      </div>

      {data.items.map((it, idx) => {
        const ok = JSON.stringify(it.studentAnswer) === JSON.stringify(it.correctAnswer);
        return (
          <div className="card" key={it.questionId} style={{ marginBottom: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div><strong>Q{idx + 1}</strong> <span className="badge">{it.type}</span></div>
              <div className={"badge " + (ok ? "success" : "danger")}>{ok ? "Correct" : "Incorrect"}</div>
            </div>

            <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{it.prompt}</div>

            {it.choices && (
              <div className="small" style={{ marginTop: 8 }}>
                <strong>Choices:</strong>
                <ul>
                  {it.choices.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}

            <div className="row" style={{ marginTop: 10, gap: 18, flexWrap: "wrap" }}>
              <div style={{ minWidth: 260 }}>
                <div className="small"><strong>Your answer</strong></div>
                <div className="mono">{pretty(it.studentAnswer)}</div>
              </div>
              <div style={{ minWidth: 260 }}>
                <div className="small"><strong>Correct answer</strong></div>
                <div className="mono">{pretty(it.correctAnswer)}</div>
              </div>
            </div>

            {it.explanation && (
              <div className="small" style={{ marginTop: 10 }}>
                <strong>Explanation:</strong> {it.explanation}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
