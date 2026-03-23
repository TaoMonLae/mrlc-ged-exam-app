import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { loadAuth } from '../lib/auth'

const SUBJ_COLOR = { RLA: '#2563eb', MATH: '#059669', SCIENCE: '#d97706', SOCIAL_STUDIES: '#7c3aed' }

export default function ClassReport() {
  const { id: classId } = useParams()
  const auth = loadAuth()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('overview')
  const [selectedQuizId, setSelectedQuizId] = useState('')

  useEffect(() => {
    if (!auth?.token) return
    api(`/api/classes/${classId}/marks-report`, { token: auth.token })
      .then(d => { setData(d); if (d.quizzes?.length) setSelectedQuizId(d.quizzes[0].id) })
      .catch(e => setErr(e.message))
  }, [classId])

  if (!auth || auth.type !== 'USER') return <div className="card">Please login as Admin/Teacher.</div>
  if (err) return <div><div className="banner error">{err}</div><Link to="/teacher" className="btn secondary" style={{marginTop:12}}>← Dashboard</Link></div>
  if (!data) return <div style={{textAlign:'center',padding:60}}><span className="spinner dark" style={{width:32,height:32}}></span></div>

  const { class: cls, students, quizzes, attemptsMap, quizStats, missingByQuiz } = data
  const publishedQuizzes = quizzes.filter(q => q.published)

  // Compute per-student totals
  const studentTotals = students.map(st => {
    let total = 0, earned = 0, done = 0
    for (const q of publishedQuizzes) {
      const a = (attemptsMap[st.id]||{})[q.id]
      if (a && a.status === 'SUBMITTED') {
        earned += a.scoreOverride ?? a.score ?? 0
        done++
      }
    }
    return { ...st, earned, done }
  }).sort((a,b) => b.earned - a.earned)

  const selectedMissing = missingByQuiz?.find(m => m.quizId === selectedQuizId)
  const avgScore = quizStats.length ? (quizStats.reduce((s,q)=>s+q.avg,0)/quizStats.length).toFixed(1) : '—'
  const totalSubmissions = quizStats.reduce((s,q)=>s+q.submitted,0)

  return (
    <div>
      <div style={{marginBottom:20}}>
        <Link to={`/teacher/class/${classId}`} style={{fontSize:'.82rem',color:'var(--text3)',textDecoration:'none'}}>← {cls.name}</Link>
      </div>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{marginBottom:6}}>📊 Class Report</h2>
          <p style={{color:'var(--text3)',fontSize:'.875rem'}}>{cls.name} · {students.length} students · {publishedQuizzes.length} published quizzes</p>
        </div>
        <a className="btn secondary" href={`/api/classes/${classId}/marks-export?token=${auth.token}`}
          download={`${cls.name}-marks.csv`}>⬇️ Export CSV</a>
      </div>

      {/* Summary stats */}
      <div className="stat-grid" style={{marginBottom:24}}>
        <div className="stat-card"><div className="val">{students.length}</div><div className="lbl">Students</div></div>
        <div className="stat-card"><div className="val">{publishedQuizzes.length}</div><div className="lbl">Published Quizzes</div></div>
        <div className="stat-card"><div className="val">{totalSubmissions}</div><div className="lbl">Total Submissions</div></div>
        <div className="stat-card"><div className="val">{avgScore}</div><div className="lbl">Avg Score</div></div>
      </div>

      <div className="tab-bar" style={{marginBottom:24}}>
        {[['overview','📈 Overview'],['matrix','📋 Marks Matrix'],['missing','⚠️ Missing Submissions']].map(([t,l])=>(
          <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{l}</button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab==='overview' && (
        <div>
          <h3 style={{marginBottom:14}}>Quiz Statistics</h3>
          {quizStats.length === 0 && <div className="empty-state"><div className="icon">📝</div><p>No quizzes yet.</p></div>}
          {quizStats.map(s => {
            const pct = students.length > 0 ? Math.round((s.submitted/students.length)*100) : 0
            return (
              <div key={s.quizId} className="card" style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:10,marginBottom:10}}>
                  <div>
                    <div style={{fontWeight:600}}>{s.title}</div>
                    <div style={{fontSize:'.8rem',color:'var(--text3)',marginTop:2}}>
                      {s.submitted}/{students.length} submitted ({pct}%)
                    </div>
                  </div>
                  <div style={{display:'flex',gap:12}}>
                    {[['Avg',s.avg.toFixed(1),'var(--accent)'],['Max',s.max,'var(--success)'],['Min',s.min,'var(--danger)']].map(([lbl,val,col])=>(
                      <div key={lbl} style={{textAlign:'center'}}>
                        <div style={{fontWeight:700,color:col,fontFamily:"'DM Serif Display',serif",fontSize:'1.2rem'}}>{val}</div>
                        <div style={{fontSize:'.72rem',color:'var(--text3)'}}>{lbl}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{width:`${pct}%`,background:'var(--accent)'}}/>
                </div>
              </div>
            )
          })}

          <h3 style={{marginTop:24,marginBottom:14}}>Student Rankings</h3>
          {studentTotals.map((st,i)=>(
            <div key={st.id} className="card" style={{marginBottom:8,display:'flex',alignItems:'center',gap:14,padding:'12px 16px'}}>
              <div style={{
                width:32,height:32,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                fontWeight:700,fontSize:'.85rem',
                background: i===0?'#f59e0b': i===1?'#9ca3af': i===2?'#b45309':'var(--bg3)',
                color: i<3?'#fff':'var(--text3)'
              }}>{i+1}</div>
              <div style={{flex:1}}>
                <Link to={`/teacher/students/${st.id}`} style={{fontWeight:600,color:'var(--text)',textDecoration:'none'}}>{st.displayName}</Link>
                <div style={{fontSize:'.78rem',color:'var(--text3)',marginTop:2}}>{st.done}/{publishedQuizzes.length} quizzes taken</div>
              </div>
              <div style={{fontWeight:700,fontFamily:"'DM Serif Display',serif",fontSize:'1.15rem',color:'var(--accent)'}}>{st.earned} pts</div>
            </div>
          ))}
        </div>
      )}

      {/* ── MARKS MATRIX ── */}
      {tab==='matrix' && (
        <div>
          {students.length===0||publishedQuizzes.length===0 ? (
            <div className="empty-state"><div className="icon">📋</div><p>No students or published quizzes yet.</p></div>
          ) : (
            <div className="card flush" style={{overflowX:'auto'}}>
              <table>
                <thead>
                  <tr>
                    <th style={{minWidth:160,position:'sticky',left:0,background:'var(--card-bg)',zIndex:2}}>Student</th>
                    {publishedQuizzes.map(q=>(
                      <th key={q.id} style={{minWidth:100,textAlign:'center',fontSize:'.78rem'}}>
                        <div style={{maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{q.title}</div>
                        <div style={{color:'var(--text3)',fontSize:'.7rem',fontWeight:400}}>{q.subject}</div>
                      </th>
                    ))}
                    <th style={{textAlign:'center',color:'var(--accent)'}}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {studentTotals.map(st=>{
                    return (
                      <tr key={st.id}>
                        <td style={{position:'sticky',left:0,background:'var(--card-bg)',zIndex:1,fontWeight:500}}>
                          <Link to={`/teacher/students/${st.id}`} style={{color:'var(--text)',textDecoration:'none'}}>{st.displayName}</Link>
                        </td>
                        {publishedQuizzes.map(q=>{
                          const a=(attemptsMap[st.id]||{})[q.id]
                          const score = a?.status==='SUBMITTED' ? (a.scoreOverride??a.score) : null
                          return (
                            <td key={q.id} style={{textAlign:'center'}}>
                              {score!==null
                                ? <span style={{fontWeight:600,color:'var(--text)'}}>{score}</span>
                                : <span style={{color:'var(--text3)',fontSize:'.8rem'}}>—</span>}
                            </td>
                          )
                        })}
                        <td style={{textAlign:'center',fontWeight:700,color:'var(--accent)'}}>{st.earned}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p style={{fontSize:'.78rem',color:'var(--text3)',marginTop:10}}>Tip: Use ⬇️ Export CSV to open in Excel or Google Sheets.</p>
        </div>
      )}

      {/* ── MISSING ── */}
      {tab==='missing' && (
        <div>
          {missingByQuiz?.length===0 ? (
            <div className="empty-state"><div className="icon">✅</div><p>No quizzes yet.</p></div>
          ) : (
            <>
              <div className="card" style={{marginBottom:16}}>
                <label className="small">Select Quiz</label>
                <select className="input" value={selectedQuizId} onChange={e=>setSelectedQuizId(e.target.value)}>
                  {missingByQuiz?.map(q=>(
                    <option key={q.quizId} value={q.quizId}>{q.title} ({q.missingCount} missing)</option>
                  ))}
                </select>
              </div>
              {selectedMissing && (
                selectedMissing.missingCount===0
                  ? <div className="banner success">✅ All {students.length} students have submitted for this quiz.</div>
                  : <div className="card">
                      <div style={{fontWeight:600,marginBottom:12,color:'var(--danger)'}}>
                        ⚠️ {selectedMissing.missingCount} student{selectedMissing.missingCount!==1?'s':''} have NOT submitted
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {selectedMissing.missing.map(s=>(
                          <div key={s.id} style={{display:'flex',alignItems:'center',gap:10}}>
                            <div style={{width:8,height:8,borderRadius:'50%',background:'var(--danger)',flexShrink:0}}></div>
                            <Link to={`/teacher/students/${s.id}`} style={{color:'var(--text)',textDecoration:'none'}}>{s.displayName}</Link>
                          </div>
                        ))}
                      </div>
                    </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
