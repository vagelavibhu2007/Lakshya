import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useQueryClient } from '@tanstack/react-query'
import { getManagedTeams } from '../api'
import toast from 'react-hot-toast'

const ROLE_LABELS = {
    admin: 'Admin',
    teamleader: 'Team Leader',
    faculty: 'Faculty',
    member: 'Member',
    campus_ambassador: 'Campus Ambassador',
}

const ROLE_COLORS = {
    admin: 'bg-primary-500/20 text-primary-400',
    teamleader: 'bg-amber-500/20 text-amber-400',
    faculty: 'bg-emerald-500/20 text-emerald-400',
    member: 'bg-blue-500/20 text-blue-400',
    campus_ambassador: 'bg-pink-500/20 text-pink-400',
}

export default function Sidebar({ links, title }) {
    const { user, logout, switchTeam } = useAuth()
    const qc = useQueryClient()
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const [managedTeams, setManagedTeams] = useState([])
    const [switching, setSwitching] = useState(false)

    useEffect(() => {
        // Leaders always fetch managed teams
        if (user?.role === 'teamleader') {
            getManagedTeams()
                .then(res => setManagedTeams(res.data.teams || []))
                .catch(() => setManagedTeams([]))
        } else if (user?.secondaryTeamIds?.length > 0) {
            // For others, if they have secondary teams, make sure they are in the list
            // We can derive the list from user object, but managedTeams state is used for UI
            const teams = [
                user.teamId,
                ...user.secondaryTeamIds
            ].filter(Boolean);
            // unique by _id
            const uniqueTeams = [];
            const seen = new Set();
            for (const t of teams) {
                const id = t._id || t;
                if (!seen.has(id.toString())) {
                    seen.add(id.toString());
                    uniqueTeams.push(t);
                }
            }
            setManagedTeams(uniqueTeams);
        }
    }, [user?.role, user?.secondaryTeamIds, user?.teamId])

    const handleLogout = async () => {
        await logout()
        toast.success('Logged out successfully')
        navigate('/login')
    }

    const handleTeamSwitch = async (teamId) => {
        if (teamId === user.teamId?._id || teamId === user.teamId) return
        try {
            setSwitching(true)
            await switchTeam(teamId)
            qc.invalidateQueries() // Clear ALL cache to force fresh data for new team
            toast.success('Switched team successfully')
            setOpen(false)
            navigate('/') // Go to dashboard of new team
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to switch team')
        } finally {
            setSwitching(false)
        }
    }

    const navContent = (
        <div className="flex flex-col h-full bg-dark-800 border-r border-dark-500">
            {/* Logo */}
            <div className="flex items-center gap-3 px-5 py-5 border-b border-dark-500">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">TF</span>
                </div>
                <div className="flex-1">
                    <p className="text-white font-bold text-sm leading-tight">TechFest 2026</p>
                    <p className="text-gray-500 text-xs">{title}</p>
                </div>
                <button onClick={() => setOpen(false)} className="lg:hidden text-gray-400 hover:text-white text-xl p-1">✕</button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {links.map((link) => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.exact}
                        onClick={() => setOpen(false)}
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        <span className="text-lg">{link.icon}</span>
                        <span>{link.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* User info */}
            <div className="px-3 py-4 border-t border-dark-500 space-y-3">
                {user && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {user.name?.[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                    <span className={`badge text-[10px] ${ROLE_COLORS[user.role] || 'badge-gray'}`}>
                                        {ROLE_LABELS[user.role] || user.role}
                                    </span>
                                    {user.role === 'teamleader' && user.managedTeams?.length > 0 && user.managedTeams.map(t => (
                                        <span key={t._id} className="badge bg-dark-500 text-gray-300 text-[10px] border border-dark-400">
                                            {t.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Team Switcher for anyone with multiple teams */}
                        {managedTeams.length > 1 && (
                            <div className="px-2 pt-1">
                                <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1 ml-1">
                                    Switch Team
                                </label>
                                <div className="space-y-1">
                                    {managedTeams.map(t => (
                                        <button
                                            key={t._id}
                                            disabled={switching}
                                            onClick={() => handleTeamSwitch(t._id)}
                                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                                                (user.teamId?._id === t._id || user.teamId === t._id)
                                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                    : 'text-gray-400 hover:text-white hover:bg-dark-600'
                                            }`}
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color || '#f59e0b' }} />
                                            <span className="truncate">{t.name}</span>
                                            {(user.teamId?._id === t._id || user.teamId === t._id) && (
                                                <span className="ml-auto text-[10px] font-bold">ACTIVE</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                <button onClick={handleLogout} className="w-full sidebar-link text-red-400 hover:text-red-300 hover:bg-red-500/10 mt-1">
                    <span>🚪</span>
                    <span>Logout</span>
                </button>
            </div>
        </div>
    )

    return (
        <>
            {/* Mobile hamburger */}
            <button
                onClick={() => setOpen(true)}
                className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-xl bg-dark-700 border border-dark-500 flex items-center justify-center text-gray-300 hover:text-white shadow-lg"
                aria-label="Open menu"
            >
                ☰
            </button>

            {/* Mobile overlay */}
            {open && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Mobile drawer */}
            <div
                className={`lg:hidden fixed left-0 top-0 bottom-0 z-50 w-[var(--sidebar-width)] transform transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {navContent}
            </div>

            {/* Desktop sidebar */}
            <div className="hidden lg:block fixed left-0 top-0 bottom-0 w-[var(--sidebar-width)] z-40">
                {navContent}
            </div>
        </>
    )
}