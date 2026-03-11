import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const qc = useQueryClient()

    const fetchMe = useCallback(async () => {
        try {
            const token = localStorage.getItem('accessToken')
            if (!token) { setLoading(false); return }
            const { data } = await api.get('/auth/me')
            setUser(data.user)
        } catch {
            localStorage.removeItem('accessToken')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchMe() }, [fetchMe])

    const login = async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password })
        localStorage.setItem('accessToken', data.accessToken)
        qc.clear()
        setUser(data.user)
        return data.user
    }

    const logout = async () => {
        try { await api.post('/auth/logout') } catch { }
        localStorage.removeItem('accessToken')
        qc.clear()
        setUser(null)
    }

    const switchTeam = async (teamId) => {
        const { data } = await api.post('/auth/switch-team', { teamId })
        localStorage.setItem('accessToken', data.accessToken)
        qc.clear()
        setUser(data.user)
        return data.user
    }

    return (
        <AuthContext.Provider value={{ user, setUser, loading, login, logout, fetchMe, switchTeam }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)