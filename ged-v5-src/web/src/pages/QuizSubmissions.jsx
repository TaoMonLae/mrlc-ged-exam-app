import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import { loadAuth } from "../lib/auth";
import BackBar from "../components/BackBar.jsx";

export default function QuizSubmissions() {
  const { quizId } = useParams();
  const auth = loadAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [release, setRelease] = useState(false);

  async function load() {
    setErr("");
    const d = await api(`/api/quizzes/${quizId}/submissions`, { token: auth.token });
    setData(d);
    setRelease(!!d.quiz.marksReleased);
  }

  async function toggleRelease(v) {
    setErr(""); setMsg("");
    try {
      await api(`/api/quizzes/${quizId}/marks-release`, { token: auth.token, method: "PATCH", body: { marksReleased: v } });
      setMsg(v ? "✓ Marks released to students." : "✓ Marks hidden from students.");
      await load();
    } catch (e) { setErr(e.message); }
  }

  useEffect(() => { load().catch(e => setErr(e.message)); }, [quizId]);

  if (!auth?.token) return <div className="card">Please login.</div>;
  if (!data) return <div className="card">Loading...</div>;

  return (
    <div className="page">
      <BackBar to={`/teacher/class/${data.class?.id || ""}/quizzes`} title="Back to Quizzes" />
      <div className="page-header">
        <h2>Submissions: {data.quiz.title}</h2>
        <div className="small">Total points: {data.totalPoints}</div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert success">{msg}</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div><strong>Marks visibility:</strong> {data.quiz.marksReleased ? "Released" : "Hidden"}</div>
            <div className="small">Students can review answers only after marks are released.</div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className={"btn " + (data.quiz.marksReleased ? "secondary" : "")} onClick={() => toggleRelease(true)}>Release</button>
            <button className={"btn ghost " + (!data.quiz.marksReleased ? "secondary" : "")} onClick={() => toggleRelease(false)}>Hide</button>
          </div>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Status</th>
              <th>Score</th>
              <th>Submitted</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.attempts.map(a => {
              const finalScore = (a.scoreOverride !== null && a.scoreOverride !== undefined) ? a.scoreOverride : a.score;
              return (
                <tr key={a.id}>
                  <td>{a.studentName}</td>
                  <td>{a.status}</td>
                  <td>{a.status === "SUBMITTED" ? `${finalScore} / ${data.totalPoints}` : "-"}</td>
                  <td>{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : "-"}</td>
                  <td>
                    {a.status === "SUBMITTED" ? (
                      <a className="btn sm" href={`/teacher/attempt/${a.id}`}>View answers</a>
                    ) : (
                      <span className="small">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
