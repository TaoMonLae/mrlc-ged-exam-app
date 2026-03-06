import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BackBar from "../components/BackBar.jsx";
import { api } from "../lib/api";
import { loadAuth } from "../lib/auth";

export default function ClassReport() {
  const { classId } = useParams();
  const auth = loadAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [missingQuizId, setMissingQuizId] = useState("");

  async function load() {
    const d = await api(`/api/classes/${classId}/marks-report`, { token: auth.token });
    setData(d);
    if (!missingQuizId && d?.missingByQuiz?.length) setMissingQuizId(d.missingByQuiz[0].quizId);
  }

  useEffect(() => { if (auth?.token) load().catch(e=>setErr(e.message)); }, []);

  if (!auth || auth.type !== "USER") return <div className="card">Please login as Admin/Teacher.</div>;

  return (
    <div className="card">
      <BackBar to={`/teacher/class/${classId}`} title="Class Report" />
      {err && <div className="card" style={{borderColor:"#ffb4b4"}}>{err}</div>}
      {!data ? <p className="small">Loading…</p> : (
        <>
          <div className="row" style={{justifyContent:"space-between", alignItems:"center", flexWrap:"wrap"}}>
            <div>
              <h2 style={{margin:0}}>{data.class.name}</h2>
              <p className="small">{data.students.length} students • {data.quizzes.length} quizzes</p>
            </div>
            <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
              <a className="btn secondary" href={`/api/classes/${classId}/marks-export`} target="_blank" rel="noreferrer">Export class marks CSV</a>
            </div>
          </div>

          <h3>Quiz statistics</h3>
          <table>
            <thead>
              <tr><th>Quiz</th><th>Submitted</th><th>Avg</th><th>Max</th><th>Min</th></tr>
            </thead>
            <tbody>
              {data.quizStats.map(s => (
                <tr key={s.quizId}>
                  <td>{s.title}</td>
                  <td>{s.submitted}/{s.total}</td>
                  <td>{Math.round(s.avg * 10)/10}</td>
                  <td>{s.max}</td>
                  <td>{s.min}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Missing students</h3>
{data.missingByQuiz && data.missingByQuiz.length === 0 ? (
  <p className="small">No quizzes yet.</p>
) : (
  <>
    <div className="row" style={{ alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <label className="small">Select quiz:</label>
      <select className="input" value={missingQuizId} onChange={e => setMissingQuizId(e.target.value)}>
        {data.missingByQuiz.map(q => (
          <option key={q.quizId} value={q.quizId}>{q.title} (missing {q.missingCount})</option>
        ))}
      </select>
    </div>
    {(() => {
      const item = data.missingByQuiz.find(x => x.quizId === missingQuizId);
      if (!item) return null;
      if (item.missingCount === 0) return <p className="small">✅ Everyone submitted for this quiz.</p>;
      return (
        <div className="card" style={{ marginTop: 10 }}>
          <strong>Not submitted:</strong>
          <ul style={{ marginTop: 8 }}>
            {item.missing.map(s => <li key={s.id}>{s.displayName}</li>)}
          </ul>
        </div>
      );
    })()}
  </>
)}

              <h3>Marks matrix</h3>
          <div className="card" style={{overflowX:"auto"}}>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  {data.quizzes.filter(q=>q.published).map(q => (
                    <th key={q.id}>{q.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.students.map(st => (
                  <tr key={st.id}>
                    <td>{st.displayName}</td>
                    {data.quizzes.filter(q=>q.published).map(q => {
                      const a = (data.attemptsMap[st.id] || {})[q.id];
                      return <td key={q.id}>{a && a.status === "SUBMITTED" ? a.score : ""}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small">Tip: Use Export CSV to open in Excel/Google Sheets.</p>
        </>
      )}
    </div>
  );
}
