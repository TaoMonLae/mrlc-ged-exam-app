import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { loadAuth } from "../lib/auth";

export default function Users() {
  const auth = loadAuth();
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [newTeacherUser, setNewTeacherUser] = useState("");
  const [newTeacherPass, setNewTeacherPass] = useState("");

  const [resetUserId, setResetUserId] = useState("");
  const [resetPass, setResetPass] = useState("");

  async function refresh() {
    if (auth?.role !== "ADMIN") return;
    const d = await api("/api/auth/users", { token: auth.token });
    setUsers(d.users);
  }

  useEffect(() => {
    if (!auth?.token || auth.type !== "USER") return;
    refresh().catch(() => {});
  }, []);

  async function changeMyPassword(e) {
    e.preventDefault();
    setErr("");
    try {
      await api("/api/auth/change-password", {
        token: auth.token,
        method: "POST",
        body: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      alert("Password updated.");
    } catch (e) {
      setErr(e.message);
    }
  }

  async function createTeacher(e) {
    e.preventDefault();
    setErr("");
    try {
      await api("/api/auth/create-teacher", {
        token: auth.token,
        method: "POST",
        body: { username: newTeacherUser, password: newTeacherPass },
      });
      setNewTeacherUser("");
      setNewTeacherPass("");
      await refresh();
      alert("Teacher created.");
    } catch (e) {
      setErr(e.message);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setErr("");
    try {
      await api("/api/auth/reset-user-password", {
        token: auth.token,
        method: "POST",
        body: { userId: resetUserId, newPassword: resetPass },
      });
      setResetUserId("");
      setResetPass("");
      alert("Password reset.");
    } catch (e) {
      setErr(e.message);
    }
  }

  if (!auth || auth.type !== "USER") return <div className="card">Please login as Admin/Teacher.</div>;

  return (
    <div className="card">
      <h2>User Management</h2>
      {err && (
        <div className="card" style={{ borderColor: "#ffd1d1", background: "#fff5f5" }}>
          {err}
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>Change My Password</h3>
        <form onSubmit={changeMyPassword}>
          <label className="small">Current password</label>
          <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <label className="small">New password (min 6 chars)</label>
          <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <div style={{ marginTop: 10 }}>
            <button className="btn" disabled={!currentPassword || !newPassword}>Update Password</button>
          </div>
        </form>
      </div>

      {auth.role !== "ADMIN" ? (
        <div className="card">Only Admin can create/reset other users.</div>
      ) : (
        <>
          <div className="row">
            <div className="card" style={{ flex: 1, minWidth: 280 }}>
              <h3>Create Teacher</h3>
              <form onSubmit={createTeacher}>
                <label className="small">Username</label>
                <input className="input" value={newTeacherUser} onChange={(e) => setNewTeacherUser(e.target.value)} />
                <label className="small">Password</label>
                <input className="input" type="password" value={newTeacherPass} onChange={(e) => setNewTeacherPass(e.target.value)} />
                <div style={{ marginTop: 10 }}>
                  <button className="btn" disabled={!newTeacherUser || !newTeacherPass}>Create</button>
                </div>
              </form>
            </div>

            <div className="card" style={{ flex: 1, minWidth: 280 }}>
              <h3>Reset User Password</h3>
              <form onSubmit={resetPassword}>
                <label className="small">User</label>
                <select className="input" value={resetUserId} onChange={(e) => setResetUserId(e.target.value)}>
                  <option value="">Select user…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username} ({u.role})
                    </option>
                  ))}
                </select>
                <label className="small">New password</label>
                <input className="input" type="password" value={resetPass} onChange={(e) => setResetPass(e.target.value)} />
                <div style={{ marginTop: 10 }}>
                  <button className="btn" disabled={!resetUserId || !resetPass}>Reset</button>
                </div>
              </form>
            </div>
          </div>

          <hr />
          <h3>All Users</h3>
          <table>
            <thead><tr><th>Username</th><th>Role</th><th>Created</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.role}</td>
                  <td className="small">{new Date(u.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
