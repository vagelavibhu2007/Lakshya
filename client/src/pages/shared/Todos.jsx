import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTodos, createTodo, updateTodo, deleteTodo } from '../../api'
import toast from 'react-hot-toast'

export default function Todos() {
    const qc = useQueryClient()
    const [text, setText] = useState('')
    const [filter, setFilter] = useState('all') // all, active, completed
    const [editId, setEditId] = useState(null)
    const [editText, setEditText] = useState('')

    const { data, isLoading } = useQuery({ queryKey: ['todos'], queryFn: getTodos })
    const allTodos = data?.data?.todos || []

    const filtered = allTodos.filter((t) => {
        if (filter === 'active') return !t.completed
        if (filter === 'completed') return t.completed
        return true
    })

    const stats = {
        total: allTodos.length,
        active: allTodos.filter((t) => !t.completed).length,
        completed: allTodos.filter((t) => t.completed).length,
    }

    const createMut = useMutation({
        mutationFn: createTodo,
        onSuccess: () => { qc.invalidateQueries(['todos']); setText(''); toast.success('Added!') },
        onError: (e) => toast.error(e.response?.data?.message || 'Error'),
    })

    const updateMut = useMutation({
        mutationFn: ({ id, ...d }) => updateTodo(id, d),
        onSuccess: () => { qc.invalidateQueries(['todos']); setEditId(null); },
    })

    const deleteMut = useMutation({
        mutationFn: deleteTodo,
        onSuccess: () => { qc.invalidateQueries(['todos']); toast.success('Deleted') },
    })

    const handleAdd = (e) => {
        e.preventDefault()
        if (!text.trim()) return
        createMut.mutate({ text: text.trim() })
    }

    const handleToggle = (todo) => {
        updateMut.mutate({ id: todo._id, completed: !todo.completed })
    }

    const handleEdit = (todo) => {
        setEditId(todo._id)
        setEditText(todo.text)
    }

    const handleEditSave = (id) => {
        if (!editText.trim()) return
        updateMut.mutate({ id, text: editText.trim() })
    }

    return (
        <div className="space-y-5 animate-fade-in max-w-2xl">
            <div>
                <h1 className="page-title">📝 My Todos</h1>
                <p className="text-gray-400 text-sm -mt-4">Your personal task list — only you can see these</p>
            </div>

            {/* Add Todo */}
            <form onSubmit={handleAdd} className="flex gap-3">
                <input
                    className="input flex-1"
                    placeholder="What do you need to do?"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={500}
                />
                <button type="submit" className="btn-primary flex-shrink-0" disabled={createMut.isPending || !text.trim()}>
                    {createMut.isPending ? '⏳' : '➕'} Add
                </button>
            </form>

            {/* Stats */}
            <div className="flex gap-4 items-center">
                <div className="flex gap-2 text-sm">
                    <span className="badge-gray">{stats.total} total</span>
                    <span className="badge-primary">{stats.active} active</span>
                    <span className="badge-success">{stats.completed} done</span>
                </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-3 border-b border-dark-500">
                {['all', 'active', 'completed'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`pb-2 px-2 border-b-2 font-medium capitalize transition-colors text-sm ${filter === f ? 'border-primary-500 text-primary-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Todo list */}
            {isLoading ? (
                <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" /></div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((todo) => (
                        <div key={todo._id} className={`card flex items-center gap-3 group hover:border-dark-400 transition-all ${todo.completed ? 'opacity-60' : ''}`}>
                            <button onClick={() => handleToggle(todo)} className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110"
                                style={{
                                    borderColor: todo.completed ? '#10b981' : '#4b5563',
                                    background: todo.completed ? '#10b981' : 'transparent',
                                }}>
                                {todo.completed && <span className="text-white text-xs">✓</span>}
                            </button>

                            {editId === todo._id ? (
                                <input
                                    className="input flex-1 text-sm"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    onBlur={() => handleEditSave(todo._id)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(todo._id); if (e.key === 'Escape') setEditId(null) }}
                                    autoFocus
                                />
                            ) : (
                                <span
                                    className={`flex-1 text-sm cursor-pointer ${todo.completed ? 'line-through text-gray-500' : 'text-white'}`}
                                    onDoubleClick={() => handleEdit(todo)}
                                >
                                    {todo.text}
                                </span>
                            )}

                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <button onClick={() => handleEdit(todo)} className="text-gray-400 hover:text-primary-400 transition-colors text-sm p-1">✏️</button>
                                <button onClick={() => deleteMut.mutate(todo._id)} className="text-gray-400 hover:text-red-400 transition-colors text-sm p-1">🗑️</button>
                            </div>

                            <span className="text-xs text-gray-600 flex-shrink-0">
                                {new Date(todo.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div className="card text-center text-gray-500 py-10">
                            {filter === 'all' ? "No todos yet — add one above! 🎯" : `No ${filter} todos`}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}