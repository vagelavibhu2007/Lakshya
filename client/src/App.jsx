import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Pages
import LoginPage from './pages/LoginPage'
import NotFound from './pages/NotFound'
import Unauthorized from './pages/Unauthorized'

// Layouts
import AdminLayout from './components/layouts/AdminLayout'
import TLLayout from './components/layouts/TLLayout'
import FacultyLayout from './components/layouts/FacultyLayout'
import VolLayout from './components/layouts/VolLayout'

// Admin pages
import AdminDashboard from './pages/admin/Dashboard'
import AdminUsers from './pages/admin/Users'
import AdminImportMembers from './pages/admin/ImportMembers'
import AdminTeams from './pages/admin/Teams'
import AdminTasks from './pages/admin/Tasks'
import AdminAnnouncements from './pages/admin/Announcements'
import AdminResources from './pages/admin/Resources'
import AdminEvents from './pages/admin/Events'
import AdminBulkEmail from './pages/admin/BulkEmail'

// Team Leader pages
import TLDashboard from './pages/teamleader/Dashboard'
import TLTasks from './pages/teamleader/Tasks'
import TLVerify from './pages/teamleader/VerifySubmissions'
import TLAnnouncements from './pages/teamleader/Announcements'
import TLResources from './pages/teamleader/Resources'
import TLMembers from './pages/teamleader/TeamMembers'
import TLImportMembers from './pages/teamleader/TLImportMembers'

// Faculty pages
import FacultyDashboard from './pages/faculty/Dashboard'
import FacultyEvents from './pages/faculty/Events'
import FacultyAnnouncements from './pages/faculty/Announcements'

// Volunteer/CA pages (now "Member")
import VolDashboard from './pages/volunteer/Dashboard'
import VolTasks from './pages/volunteer/MyTasks'
import VolSubmit from './pages/volunteer/SubmitProof'
import VolPoints from './pages/volunteer/MyPoints'
import VolAnnouncements from './pages/volunteer/Announcements'
import VolResources from './pages/volunteer/Resources'
import VolReferrals from './pages/volunteer/Referrals'

// Shared pages
import Leaderboard from './pages/Leaderboard'
import Todos from './pages/shared/Todos'
import ContactUs from './pages/shared/ContactUs'
import Profile from './pages/shared/Profile'

// Attendance pages
import AdminAttendance from './pages/admin/Attendance'
import TLAttendance from './pages/teamleader/Attendance'
import FacultyAttendanceReport from './pages/faculty/AttendanceReport'
import MyAttendance from './pages/volunteer/MyAttendance'

function ProtectedRoute({ children, roles }) {
    const { user, loading } = useAuth()
    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" /></div>
    if (!user) return <Navigate to="/login" replace />
    if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />
    return children
}

function RoleRedirect() {
    const { user, loading } = useAuth()
    if (loading) return null
    if (!user) return <Navigate to="/login" replace />
    const map = { admin: '/admin', teamleader: '/tl', faculty: '/faculty', volunteer: '/vol', member: '/vol', campus_ambassador: '/vol' }
    return <Navigate to={map[user.role] || '/login'} replace />
}

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/" element={<RoleRedirect />} />

            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminLayout /></ProtectedRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="import-members" element={<AdminImportMembers />} />
                <Route path="teams" element={<AdminTeams />} />
                <Route path="tasks" element={<AdminTasks />} />
                <Route path="announcements" element={<AdminAnnouncements />} />
                <Route path="resources" element={<AdminResources />} />
                <Route path="events" element={<AdminEvents />} />
                <Route path="bulk-email" element={<AdminBulkEmail />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="attendance" element={<AdminAttendance />} />
                <Route path="todos" element={<Todos />} />
                <Route path="profile" element={<Profile />} />
                <Route path="contact" element={<ContactUs />} />
            </Route>

            {/* Team Leader */}
            <Route path="/tl" element={<ProtectedRoute roles={['teamleader']}><TLLayout /></ProtectedRoute>}>
                <Route index element={<TLDashboard />} />
                <Route path="tasks" element={<TLTasks />} />
                <Route path="members" element={<TLMembers />} />
                <Route path="verify" element={<TLVerify />} />
                <Route path="announcements" element={<TLAnnouncements />} />
                <Route path="resources" element={<TLResources />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="attendance" element={<TLAttendance />} />
                <Route path="todos" element={<Todos />} />
                <Route path="profile" element={<Profile />} />
                <Route path="contact" element={<ContactUs />} />
                <Route path="import-members" element={<TLImportMembers />} />
            </Route>

            {/* Faculty */}
            <Route path="/faculty" element={<ProtectedRoute roles={['faculty']}><FacultyLayout /></ProtectedRoute>}>
                <Route index element={<FacultyDashboard />} />
                <Route path="events" element={<FacultyEvents />} />
                <Route path="announcements" element={<FacultyAnnouncements />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="attendance" element={<FacultyAttendanceReport />} />
                <Route path="todos" element={<Todos />} />
                <Route path="profile" element={<Profile />} />
                <Route path="contact" element={<ContactUs />} />
            </Route>

            {/* Member (Volunteer / Campus Ambassador) */}
            <Route path="/vol" element={<ProtectedRoute roles={['volunteer', 'member', 'campus_ambassador']}><VolLayout /></ProtectedRoute>}>
                <Route index element={<VolDashboard />} />
                <Route path="tasks" element={<VolTasks />} />
                <Route path="submit/:taskId" element={<VolSubmit />} />
                <Route path="points" element={<VolPoints />} />
                <Route path="announcements" element={<VolAnnouncements />} />
                <Route path="resources" element={<VolResources />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="attendance" element={<MyAttendance />} />
                <Route path="todos" element={<Todos />} />
                <Route path="profile" element={<Profile />} />
                <Route path="contact" element={<ContactUs />} />
                <Route path="referrals" element={<VolReferrals />} />
            </Route>

            <Route path="*" element={<NotFound />} />
        </Routes>
    )
}