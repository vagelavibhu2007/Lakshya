import { Outlet } from 'react-router-dom'
import Sidebar from '../Sidebar'
import { useAuth } from '../../context/AuthContext'

const BASE_VOL_LINKS = [
    { to: '/vol', label: 'Dashboard', icon: '🏠', exact: true },
    { to: '/vol/tasks', label: 'My Tasks', icon: '✅' },
    { to: '/vol/points', label: 'My Points', icon: '⭐' },
    { to: '/vol/leaderboard', label: 'Leaderboard', icon: '🏆' },
    { to: '/vol/announcements', label: 'Announcements', icon: '📢' },
    { to: '/vol/resources', label: 'Resources', icon: '📁' },
    { to: '/vol/attendance', label: 'My Attendance', icon: '📋' },
    { to: '/vol/todos', label: 'My Todos', icon: '📝' },
    { to: '/vol/profile', label: 'Profile Settings', icon: '👤' },
    { to: '/vol/contact', label: 'Contact Us', icon: '📞' },
]

const CA_LINK = { to: '/vol/referrals', label: 'My Referrals', icon: '🎟️' }

export default function VolLayout() {
    const { user } = useAuth()
    const isCA = user?.role === 'campus_ambassador'
    const links = isCA
        ? [BASE_VOL_LINKS[0], BASE_VOL_LINKS[1], CA_LINK, ...BASE_VOL_LINKS.slice(2)]
        : BASE_VOL_LINKS

    return (
        <div className="flex min-h-screen">
            <Sidebar links={links} title={isCA ? 'CA Portal' : 'Member Portal'} />
            <main className="flex-1 min-w-0 ml-0 lg:ml-[var(--sidebar-width)] p-4 lg:p-6 pt-16 lg:pt-6 min-h-screen">
                <Outlet />
            </main>
        </div>
    )
}