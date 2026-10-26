import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, RequireAuth, RequireAdmin } from "./auth/AuthContext";
import { useAccess } from "./auth/access";
import { isAdminUser } from "./constants";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ComplaintList from "./pages/ComplaintList";
import ComplaintForm from "./pages/ComplaintForm";
import ComplaintDetail from "./pages/ComplaintDetail";
import Team from "./pages/Team";
import Projects from "./pages/Projects";
import Sprints from "./pages/Sprints";
import MySprints from "./pages/Mysprints";
import SprintBoard from "./pages/SprintBoard";
import MyComplaints from "./pages/MyComplaints";
import MyComplaintTasks from "./pages/MyComplaintTasks";
import Users from "./pages/Users";

// Sprints are for the support side: admin, or a login with support / both access.
// Developers are sent back to the board (the server refuses them as well).
// "My complaints" (a support user's complaints and their tasks) uses the same guard.
function RequireSupport() {
  const { access } = useAccess();
  const allowed = isAdminUser() || access !== "developer";
  return allowed ? <Outlet /> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/" element={<ComplaintList />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/new" element={<ComplaintForm />} />
            <Route path="/complaints/:id" element={<ComplaintDetail />} />

            {/* The user's own sprints: open to every logged-in user */}
            <Route path="/my-sprints" element={<MySprints />} />
            <Route path="/my-sprints/:id" element={<SprintBoard />} />

            <Route element={<RequireSupport />}>
              <Route path="/sprints" element={<Sprints />} />

              {/* Support side: the complaints a user handles, and the tasks added to each */}
              <Route path="/my-complaints" element={<MyComplaints />} />
              <Route path="/my-complaints/:id" element={<MyComplaintTasks />} />
            </Route>

            <Route element={<RequireAdmin />}>
              <Route path="/team" element={<Team />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/users" element={<Users />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}