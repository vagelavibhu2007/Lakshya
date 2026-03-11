import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Unauthorized() {
    const { user } = useAuth()
    const home = user ? ({ admin: '/admin', teamleader: '/tl', faculty: '/faculty', volunteer: '/vol', member: '/vol', campus_ambassador: '/vol' }[user.role] || '/') : '/login'
    return (
        <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
            <div className="text-center animate-fade-in">
                <div className="text-8xl mb-4">🚫</div>
                <h1 className="text-4xl font-black text-white mb-2">403</h1>
                <p className="text-gray-400 mb-2">Access Denied</p>
                <p className="text-gray-500 text-sm mb-6">You don't have permission to access this page.</p>
                <Link to={home} className="btn-primary">← Go to Dashboard</Link>
            </div>
        </div>
    )
}