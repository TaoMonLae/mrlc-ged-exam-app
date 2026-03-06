import React from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import { loadAuth, clearAuth } from './lib/auth'
import { useTheme } from './lib/theme.jsx'
import Login from './pages/Login.jsx'
import TeacherHome from './pages/TeacherHome.jsx'
import ClassDetail from './pages/ClassDetail.jsx'
import Passages from './pages/Passages.jsx'
import Questions from './pages/Questions.jsx'
import Quizzes from './pages/Quizzes.jsx'
import StudentHome from './pages/StudentHome.jsx'
import TakeQuiz from './pages/TakeQuiz.jsx'
import Users from './pages/Users.jsx'
import Students from './pages/Students.jsx'
import StudentProfile from './pages/StudentProfile.jsx'

function Navbar() {
  const nav = useNavigate()
  const auth = loadAuth()
  const { dark, toggle } = useTheme()
  const dest = auth?.type === 'STUDENT' ? '/student' : auth ? '/teacher' : '/'

  return (
    <div className="nav">
      {/* Brand */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <span className="nav-brand" style={{ cursor: 'pointer' }} onClick={() => nav(dest)}>
          📚 MRLC GED
        </span>
        {auth && (
          <span className="badge" style={{ background: 'rgba(255,255,255,.12)', color: 'var(--nav-text)', border: 'none', fontSize: '.7rem' }}>
            {auth?.role || auth?.type}
          </span>
        )}
      </div>

      {/* Desktop nav — hidden on mobile via CSS only (no inline display) */}
      <div className="nav-links">
        {auth?.type === 'USER' && <Link to="/teacher">Dashboard</Link>}
        {auth?.type === 'USER' && <Link to="/teacher/students">Students</Link>}
        {auth?.type === 'USER' && auth?.role === 'ADMIN' && <Link to="/teacher/users">Users</Link>}
        {auth?.type === 'STUDENT' && <Link to="/student">Home</Link>}
        {!auth && <Link to="/">Login</Link>}
        <button className="theme-toggle" onClick={toggle}>{dark ? '☀️' : '🌙'}</button>
        {auth && <button className="btn secondary sm" onClick={() => { clearAuth(); nav('/') }}>Logout</button>}
      </div>

      {/* Mobile nav — shown on mobile via CSS only (no inline display) */}
      <div className="mobile-menu">
        <button className="theme-toggle" onClick={toggle}>{dark ? '☀️' : '🌙'}</button>
        {auth && <button className="btn secondary sm" onClick={() => { clearAuth(); nav('/') }}>Logout</button>}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/teacher" element={<TeacherHome />} />
          <Route path="/teacher/class/:id" element={<ClassDetail />} />
          <Route path="/teacher/passages/:classId" element={<Passages />} />
          <Route path="/teacher/questions/:classId" element={<Questions />} />
          <Route path="/teacher/quizzes/:classId" element={<Quizzes />} />
          <Route path="/teacher/users" element={<Users />} />
          <Route path="/teacher/students" element={<Students />} />
          <Route path="/teacher/students/:id" element={<StudentProfile />} />
          <Route path="/student" element={<StudentHome />} />
          <Route path="/student/quiz/:id" element={<TakeQuiz />} />
        </Routes>
      </div>
    </>
  )
}
