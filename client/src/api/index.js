import api from './axios'
export { api }

// Auth for the authentication of the user
export const login = (data) => api.post('/auth/login', data)
export const logout = () => api.post('/auth/logout')
export const getMe = () => api.get('/auth/me')
export const refreshToken = () => api.post('/auth/refresh')
export const updateProfile = (data) => api.put('/auth/profile', data)
export const changePassword = (data) => api.post('/auth/change-password', data)
export const getManagedTeams = () => api.get('/auth/managed-teams')
export const switchTeam = (teamId) => api.post('/auth/switch-team', { teamId })

// Tasks
export const closeTask = (id, data) => api.patch(`/tasks/${id}/close`, data)

// Users
export const getUsers = (params) => api.get('/users', { params })
export const getUser = (id) => api.get(`/users/${id}`)
export const createUser = (data) => api.post('/users', data)
export const updateUser = (id, data) => api.put(`/users/${id}`, data)
export const deleteUser = (id) => api.delete(`/users/${id}`)             // soft: deactivate
export const hardDeleteUser = (id) => api.delete(`/users/${id}?hard=true`)  // hard: permanent delete
export const bulkUpdateUsersStatus = (data) => api.post('/users/bulk-status', data)
export const importMembersExcel = (formData) =>
  api.post('/admin/users/import-members', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const importTeamMembersExcel = (teamId, formData) =>
  api.post(`/users/team/${teamId}/import-members`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })

// Team Users (for TL)
export const getTeamUsers = (teamId) => api.get(`/users/team/${teamId}`)
export const createTeamUser = (teamId, data) => api.post(`/users/team/${teamId}`, data)
export const updateTeamUser = (teamId, userId, data) => api.patch(`/users/team/${teamId}/${userId}`, data)
export const deleteTeamUser = (teamId, userId) => api.delete(`/users/team/${teamId}/${userId}`)             // soft
export const hardDeleteTeamUser = (teamId, userId) => api.delete(`/users/team/${teamId}/${userId}?hard=true`) // hard

// Teams
export const getTeams = () => api.get('/teams')
export const getTeam = (id) => api.get(`/teams/${id}`)
export const createTeam = (data) => api.post('/teams', data)
export const updateTeam = (id, data) => api.put(`/teams/${id}`, data)
export const deleteTeam = (id) => api.delete(`/teams/${id}`)
export const getTeamCAs = (teamId) => api.get(`/teams/${teamId}/cas`)

// Tasks
export const getTasks = (params) => api.get('/tasks', { params })
export const getTask = (id) => api.get(`/tasks/${id}`)
export const createTask = (data) => api.post('/tasks', data)
export const updateTask = (id, data) => api.put(`/tasks/${id}`, data)
export const deleteTask = (id) => api.delete(`/tasks/${id}`)

// Submissions
export const getSubmissions = (params) => api.get('/submissions', { params })
export const getSubmission = (id) => api.get(`/submissions/${id}`)
export const submitProof = (taskId, data) => api.post(`/submissions/${taskId}`, data)
export const submitFileProof = (taskId, formData) => api.post(`/submissions/${taskId}/file`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const verifySubmission = (id, data) => api.put(`/submissions/${id}/verify`, data)

// Points
export const getLeaderboard = (params) => api.get('/points/leaderboard', { params })
export const getMyPoints = () => api.get('/points/my')
export const getLedger = (params) => api.get('/points/ledger', { params })
export const overridePoints = (data) => api.post('/points/override', data)

// Campus Ambassador
export const getCAProfile = () => api.get('/ca/me')
export const getCAReferrals = (params) => api.get('/ca/referrals', { params })
export const getCAAnalytics = () => api.get('/ca/analytics')
export const getCALeaderboard = (params) => api.get('/ca/leaderboard', { params })
export const getCAPoints = (params) => api.get('/ca/points', { params })               // CA's own event-referral ledger
export const getCAPointsLeaderboard = (params) => api.get('/ca/points-leaderboard', { params }) // Admin view

// Referrals
export const applyReferralCode = (data) => api.post('/referrals/apply', data)
export const getMyReferral = () => api.get('/referrals/my-referral')
export const confirmReferral = (data) => api.post('/referrals/confirm', data)
export const rejectReferral = (data) => api.post('/referrals/reject', data)

// Announcements
export const getAnnouncements = (params) => api.get('/announcements', { params })
export const getAnnouncement = (id) => api.get(`/announcements/${id}`)
export const createAnnouncement = (data) => api.post('/announcements', data)
export const updateAnnouncement = (id, data) => api.put(`/announcements/${id}`, data)
export const deleteAnnouncement = (id) => api.delete(`/announcements/${id}`)
export const markAnnouncementRead = (id) => api.post(`/announcements/${id}/read`)

// Resources
export const getResources = (params) => api.get('/resources', { params })
export const getResource = (id) => api.get(`/resources/${id}`)
export const createResource = (data) => api.post('/resources', data)
export const uploadResource = (formData) => api.post('/resources/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const deleteResource = (id) => api.delete(`/resources/${id}`)

// Events
export const getEvents = (params) => api.get('/events', { params })
export const getEvent = (id) => api.get(`/events/${id}`)
export const createEvent = (data) => api.post('/events', data)
export const updateEvent = (id, data) => api.put(`/events/${id}`, data)
export const uploadEventDocument = (formData) => api.post('/events/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const deleteEvent = (id) => api.delete(`/events/${id}`)

// Dashboard
export const getAdminDashboard = () => api.get('/dashboard/admin')
export const getTLDashboard = (teamId) => api.get('/dashboard/teamleader', { params: teamId ? { teamId } : {} })
export const getFacultyDashboard = () => api.get('/dashboard/faculty')

// Todos
export const getTodos = () => api.get('/todos')
export const createTodo = (data) => api.post('/todos', data)
export const updateTodo = (id, data) => api.put(`/todos/${id}`, data)
export const deleteTodo = (id) => api.delete(`/todos/${id}`)

// Contacts
export const getContacts = () => api.get('/contacts')

// Attendance
export const getAttendance = (params) => api.get('/attendance', { params })
export const getAttendanceSummary = (params) => api.get('/attendance/summary', { params })
export const getStudentAttendance = (userId, params) => api.get(`/attendance/student/${userId}`, { params })
export const getTeamMembers = (teamId) => api.get(`/attendance/members/${teamId}`)
export const markAttendance = (data) => api.post('/attendance', data)
export const updateAttendance = (id, data) => api.patch(`/attendance/${id}`, data)
export const deleteAttendance = (id) => api.delete(`/attendance/${id}`)
export const sendBulkEmail = (data) => api.post('/emails/send-bulk', data)
export const previewTargets = (params) => api.get('/emails/preview-targets', { params })