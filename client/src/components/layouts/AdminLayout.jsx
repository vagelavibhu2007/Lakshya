import { Outlet } from 'react-router-dom'
import Sidebar from '../Sidebar'

const ADMIN_LINKS = [
    { to: '/admin', label: 'Dashboard', icon: '📊', exact: true },
    { to: '/admin/users', label: 'Users', icon: '👥' },
    { to: '/admin/teams', label: 'Teams', icon: '🏷️' },
    { to: '/admin/tasks', label: 'Tasks', icon: '✅' },
    { to: '/admin/announcements', label: 'Announcements', icon: '📢' },
    { to: '/admin/events', label: 'Events', icon: '🎪' },
    { to: '/admin/attendance', label: 'Attendance', icon: '📋' },
    { to: '/admin/leaderboard', label: 'Leaderboard', icon: '🏆' },
    { to: '/admin/resources', label: 'Resources', icon: '📁' },
    { to: '/admin/bulk-email', label: 'Bulk Email', icon: '📧' },
    { to: '/admin/import-members', label: 'Import Members', icon: '📥' },
    { to: '/admin/todos', label: 'My Todos', icon: '📝' },
    { to: '/admin/profile', label: 'Profile Settings', icon: '👤' },
    { to: '/admin/contact', label: 'Contact Us', icon: '📞' },
]

export default function AdminLayout() {
    return (
        <div className="flex min-h-screen">
            <Sidebar links={ADMIN_LINKS} title="Admin Portal" />
            <main className="flex-1 min-w-0 ml-0 lg:ml-[var(--sidebar-width)] p-4 lg:p-6 pt-16 lg:pt-6 min-h-screen">
                <Outlet />
            </main>
        </div>
    )
}