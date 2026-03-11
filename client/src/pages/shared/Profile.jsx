import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { updateProfile, changePassword } from '../../api'
import toast from 'react-hot-toast'

function PasswordStrength({ password }) {
    const checks = [
        { label: '8+ chars', pass: password.length >= 8 },
        { label: 'Uppercase', pass: /[A-Z]/.test(password) },
        { label: 'Lowercase', pass: /[a-z]/.test(password) },
        { label: 'Number', pass: /\d/.test(password) },
        { label: 'Special', pass: /[@$!%*?&#^()_+=\-~`|{}\[\]:;"'<>,.\/\\]/.test(password) },
    ]
    const score = checks.filter(c => c.pass).length
    const level = score <= 2 ? 'Weak' : score <= 4 ? 'Medium' : 'Strong'
    const color = score <= 2 ? 'bg-red-500' : score <= 4 ? 'bg-yellow-500' : 'bg-emerald-500'
    const textColor = score <= 2 ? 'text-red-400' : score <= 4 ? 'text-yellow-400' : 'text-emerald-400'

    if (!password) return null
    return (
        <div className="mt-2 space-y-2">
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= score ? color : 'bg-dark-500'}`} />
                ))}
            </div>
            <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${textColor}`}>{level}</span>
                <div className="flex gap-2 flex-wrap">
                    {checks.map(c => (
                        <span key={c.label} className={`text-xs ${c.pass ? 'text-emerald-400' : 'text-gray-500'}`}>
                            {c.pass ? '✓' : '○'} {c.label}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default function Profile() {
    const { user, login } = useAuth()
    const [activeTab, setActiveTab] = useState('profile')

    // Profile form
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')

    // Password form
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (user) {
            setName(user.name || '')
            setEmail(user.email || '')
            setPhone(user.phone || '')
        }
    }, [user])

    const ROLE_LABELS = {
        admin: 'Admin',
        teamleader: 'Team Leader',
        faculty: 'Faculty',
        member: 'Member',
        campus_ambassador: 'Campus Ambassador'
    }

    const handleProfileSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await updateProfile({ name, email, phone })
            if (res.data.success) {
                toast.success('Profile updated successfully')
                // Force a reload so AuthContext picks up new name/email immediately
                window.location.reload()
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error updating profile')
        } finally {
            setLoading(false)
        }
    }

    const handlePasswordSubmit = async (e) => {
        e.preventDefault()
        if (newPassword !== confirmPassword) {
            return toast.error("New passwords do not match")
        }
        const strongRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-~`|{}\[\]:;"'<>,.\/\\]).{8,}$/
        if (!strongRe.test(newPassword)) {
            return toast.error("Password must be 8+ chars with uppercase, lowercase, number, and special character")
        }

        setLoading(true)
        try {
            const res = await changePassword({ currentPassword, newPassword })
            if (res.data.success) {
                toast.success('Password updated successfully')
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error updating password')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div>
                <h1 className="page-title mb-1">Account & Security</h1>
                <p className="text-gray-400 text-sm">Manage your profile details and security settings.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left Column: Read-only Identity Card */}
                <div className="md:col-span-1 space-y-6">
                    <div className="card text-center p-6 border-t-4 border-t-primary-500">
                        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary-500 to-pink-500 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-primary-500/20 mb-4 ring-4 ring-dark-700">
                            {user?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1">{user?.name}</h2>
                        <span className="badge-primary mb-4 block w-fit mx-auto">{ROLE_LABELS[user?.role] || user?.role}</span>

                        <div className="text-left mt-6 space-y-3 pt-6 border-t border-dark-500">
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-semibold">Email Address</p>
                                <p className="text-sm text-gray-300 truncate">{user?.email}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-semibold">Assigned Teams</p>
                                <div className="space-y-2 mt-2">
                                    {user?.teamId && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: user.teamId.color || '#6366f1' }} />
                                            <p className="text-sm font-medium text-white">{user.teamId.name} <span className="text-[10px] text-primary-400 font-bold ml-1">(ACTIVE)</span></p>
                                        </div>
                                    )}
                                    {user?.role === 'teamleader' && user?.managedTeams?.map(t => (
                                        t._id !== user.teamId?._id && (
                                            <div key={t._id} className="flex items-center gap-2 opacity-60">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color || '#6366f1' }} />
                                                <p className="text-sm font-medium text-gray-300">{t.name}</p>
                                            </div>
                                        )
                                    ))}
                                    {!user?.teamId && (!user?.managedTeams || user?.managedTeams.length === 0) && (
                                        <p className="text-sm text-gray-500">No teams assigned</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Editing Forms */}
                <div className="md:col-span-2">
                    <div className="bg-dark-800 rounded-2xl border border-dark-500 overflow-hidden shadow-xl">
                        <div className="flex border-b border-dark-500 bg-dark-700/50">
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeTab === 'profile'
                                    ? 'text-primary-400 border-b-2 border-primary-500 bg-primary-500/5'
                                    : 'text-gray-400 hover:text-white hover:bg-dark-600'
                                    }`}
                            >
                                👤 Edit Profile
                            </button>
                            <button
                                onClick={() => setActiveTab('password')}
                                className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeTab === 'password'
                                    ? 'text-primary-400 border-b-2 border-primary-500 bg-primary-500/5'
                                    : 'text-gray-400 hover:text-white hover:bg-dark-600'
                                    }`}
                            >
                                🔒 Change Password
                            </button>
                        </div>

                        <div className="p-6 sm:p-8">
                            {activeTab === 'profile' ? (
                                <form onSubmit={handleProfileSubmit} className="space-y-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div className="sm:col-span-2">
                                            <label className="label">Full Name</label>
                                            <input
                                                type="text"
                                                required
                                                className="input"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="label">Email Address</label>
                                            <input
                                                type="email"
                                                required
                                                className="input"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="label">Phone (Optional)</label>
                                            <input
                                                type="tel"
                                                className="input"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                placeholder="+1 (555) 000-0000"
                                            />
                                        </div>
                                    </div>
                                    <div className="pt-4 mt-2 border-t border-dark-500">
                                        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                                            {loading ? '⏳ Saving...' : '💾 Save Profile Changes'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handlePasswordSubmit} className="space-y-5">
                                    <div>
                                        <label className="label">Current Password</label>
                                        <input
                                            type="password"
                                            required
                                            className="input"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                        />
                                    </div>
                                    <div className="pt-4 mt-2 border-t border-dark-500">
                                        <label className="label">New Password</label>
                                        <input
                                            type="password"
                                            required
                                            minLength={8}
                                            className="input"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Minimum 8 characters"
                                        />
                                        <PasswordStrength password={newPassword} />
                                        <div className="mt-4">
                                            <label className="label">Confirm New Password</label>
                                            <input
                                                type="password"
                                                required
                                                minLength={8}
                                                className="input"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Type new password again"
                                            />
                                            {confirmPassword && newPassword !== confirmPassword && (
                                                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="pt-4 mt-2 border-t border-dark-500">
                                        <button type="submit" disabled={loading} className="btn-primary w-full justify-center bg-red-600 hover:bg-red-700 shadow-red-500/20 border-red-500">
                                            {loading ? '⏳ Updating...' : '🔒 Update Security Password'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}