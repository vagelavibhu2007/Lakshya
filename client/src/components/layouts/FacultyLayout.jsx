import { Outlet } from 'react-router-dom'
import Sidebar from '../Sidebar'

const FACULTY_LINKS = [
    { to: '/faculty', label: 'Dashboard', icon: '📊', exact: true },
    { to: '/faculty/events', label: 'Events', icon: '🎪' },
    { to: '/faculty/announcements', label: 'Announcements', icon: '📢' },
    { to: '/faculty/attendance', label: 'Attendance Reports', icon: '📋' },
    { to: '/faculty/leaderboard', label: 'Leaderboard', icon: '🏆' },
    { to: '/faculty/todos', label: 'My Todos', icon: '📝' },
    { to: '/faculty/profile', label: 'Profile Settings', icon: '👤' },
    { to: '/faculty/contact', label: 'Contact Us', icon: '📞' },
]

export default function FacultyLayout() {
    return (
        <div className="flex min-h-screen">
            <Sidebar links={FACULTY_LINKS} title="Faculty Portal" />
            <main className="flex-1 min-w-0 ml-0 lg:ml-[var(--sidebar-width)] p-4 lg:p-6 pt-16 lg:pt-6 min-h-screen">
                <Outlet />
            </main>
        </div>
    )
}