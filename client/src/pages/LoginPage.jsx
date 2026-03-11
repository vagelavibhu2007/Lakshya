import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import toast from 'react-hot-toast'

const ROLE_OPTIONS = [
    { value: '', label: 'Select your role...' },
    { value: 'admin', label: 'Admin' },
    { value: 'faculty', label: 'Faculty' },
    { value: 'teamleader', label: 'Team Leader' },
    { value: 'member', label: 'Member' },
    { value: 'campus_ambassador', label: 'Campus Ambassador' },
]

const ROLE_MAP = { admin: '/admin', teamleader: '/tl', faculty: '/faculty', volunteer: '/vol', member: '/vol', campus_ambassador: '/vol' }

// Roles that all redirect to /vol — treated as the same "bucket" for validation
const VOL_ROLES = ['member', 'volunteer', 'campus_ambassador']

export default function LoginPage() {
    const { setUser } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({ email: '', password: '' })
    const [selectedRole, setSelectedRole] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPass, setShowPass] = useState(false)
    const [showForgot, setShowForgot] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!selectedRole) {
            toast.error('Please select your role before signing in')
            return
        }
        setLoading(true)
        try {
            // Step 1: Call login API directly (without setting auth state yet)
            const { data } = await api.post('/auth/login', { email: form.email, password: form.password })
            const token = data.accessToken
            const u = data.user

            // Step 2: Validate role BEFORE setting auth state
            const actualRole = u.role
            const roleMismatch = !(
                actualRole === selectedRole ||
                (VOL_ROLES.includes(actualRole) && VOL_ROLES.includes(selectedRole))
            )

            if (roleMismatch) {
                // Don't set auth state — just logout on server to invalidate the session
                try { await api.post('/auth/logout') } catch { }
                const selectedLabel = ROLE_OPTIONS.find(r => r.value === selectedRole)?.label || selectedRole
                toast.error(`Role mismatch: you selected "${selectedLabel}" but your account role is "${actualRole}". Please select the correct role.`)
                setLoading(false)
                return
            }

            // Step 3: Role is valid — now commit auth state
            localStorage.setItem('accessToken', token)
            setUser(u)

            toast.success(`Welcome back, ${u.name}!`)
            navigate(ROLE_MAP[u.role] || '/login', { replace: true })
        } catch (err) {
            toast.error(err.response?.data?.message || 'Invalid email or password')
        } finally {
            setLoading(false)
        }
    }

    if (showForgot) return (
        <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md animate-fade-in">
                <div className="card border-dark-400 shadow-2xl text-center space-y-5">
                    <div>
                        <span className="text-4xl">🔐</span>
                        <h2 className="text-xl font-bold text-white mt-3">Forgot Password?</h2>
                        <p className="text-gray-400 text-sm mt-2">Password reset via email is not available yet. Please contact the system administrator to reset your password.</p>
                    </div>
                    <div className="p-4 rounded-xl bg-dark-700 border border-dark-500 text-left space-y-3">
                        <p className="text-sm font-semibold text-white">📬 Contact Admin / Developer</p>
                        <div className="text-sm text-gray-300 space-y-1.5">
                            <p>📧 <a href="mailto:aryanparvani12@gmail.com" className="text-primary-400 hover:underline">aryanparvani12@gmail.com</a></p>
                            <p>📧 <a href="mailto:aakub1096@gmail.com" className="text-primary-400 hover:underline">aakub1096@gmail.com</a></p>
                            <p>📧 <a href="mailto:kvshah25092005@gmail.com" className="text-primary-400 hover:underline">kvshah25092005@gmail.com</a></p>
                            <p>💬 Reach out via WhatsApp or your internal communication channel</p>
                        </div>
                    </div>
                    <button onClick={() => setShowForgot(false)} className="btn-secondary w-full justify-center">← Back to Login</button>
                </div>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md animate-fade-in">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-pink-500 items-center justify-center mb-4 shadow-lg shadow-primary-500/30">
                        <span className="text-white font-black text-2xl">TF</span>
                    </div>
                    <h1 className="text-3xl font-black text-white">TechFest 2026</h1>
                    <p className="text-gray-400 mt-1 text-sm">Internal Management Portal</p>
                </div>

                <div className="card border-dark-400 shadow-2xl">
                    <h2 className="text-xl font-bold text-white mb-6 text-center">Sign In</h2>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Role selector */}
                        <div>
                            <label className="label">Your Role</label>
                            <select
                                className="input"
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                required
                            >
                                {ROLE_OPTIONS.map(r => (
                                    <option key={r.value} value={r.value} disabled={r.value === ''}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Must match your account role</p>
                        </div>
                        <div>
                            <label className="label">Email address</label>
                            <input
                                type="email"
                                className="input"
                                placeholder="you@techfest.com"
                                value={form.email}
                                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                required
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="label">Password</label>
                            <div className="relative">
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    className="input pr-10"
                                    placeholder="••••••••"
                                    value={form.password}
                                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                                    onClick={() => setShowPass((s) => !s)}
                                >
                                    {showPass ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>
                        <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
                            {loading ? <><span className="animate-spin">⏳</span> Signing in...</> : '🚀 Sign In'}
                        </button>
                        <div className="text-center">
                            <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-gray-500 hover:text-primary-400 transition-colors">
                                🔐 Forgot password? Contact admin
                            </button>
                        </div>
                    </form>

                    {/* <div className="mt-6 pt-5 border-t border-dark-500">
                        <p className="text-xs text-gray-500 text-center mb-3">🔑 Demo Credentials — click to fill</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                            {[
                                ['admin@techfest.com', 'Admin@123', 'Admin', 'text-red-400', 'admin'],
                                ['faculty@techfest.com', 'Faculty@123', 'Faculty', 'text-yellow-400', 'faculty'],
                                ['tl.tech@techfest.com', 'Leader@123', 'TL – Tech', 'text-blue-400', 'teamleader'],
                                ['tl.pr@techfest.com', 'Leader@123', 'TL – PR', 'text-blue-400', 'teamleader'],
                                ['tl.mkt@techfest.com', 'Leader@123', 'TL – Marketing', 'text-blue-400', 'teamleader'],
                                ['vol1@techfest.com', 'Vol@12345', 'Member 1', 'text-primary-400', 'member'],
                                ['vol2@techfest.com', 'Vol@12345', 'Member 2', 'text-primary-400', 'member'],
                                ['ca1@techfest.com', 'CA@12345', 'Campus Amb.', 'text-emerald-400', 'campus_ambassador'],
                            ].map(([email, pass, label, color, role]) => (
                                <button
                                    key={email}
                                    type="button"
                                    onClick={() => { setForm({ email, password: pass }); setSelectedRole(role) }}
                                    className="text-left px-2.5 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 border border-dark-500 transition-colors"
                                >
                                    <span className={`block font-semibold ${color}`}>{label}</span>
                                    <span className="block text-gray-500 truncate text-[10px]">{email}</span>
                                </button>
                            ))}
                        </div>
                    </div> */}
                </div>
            </div>
        </div>
    )
}