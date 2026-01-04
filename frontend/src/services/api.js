import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (username, email, password) =>
    api.post('/api/auth/register', { username, email, password }),
  login: (email, password) =>
    api.post('/api/auth/login', { email, password })
};

export const usersAPI = {
  getAll: () => api.get('/api/users')
};

export const messagesAPI = {
  getChatHistory: (userId) => api.get(`/api/messages/${userId}`),
  deleteForMe: (userId, messageId) => api.delete(`/api/messages/${userId}/${messageId}/me`),
  deleteForEveryone: (userId, messageId) => api.delete(`/api/messages/${userId}/${messageId}/everyone`)
};

export const profileAPI = {
  getProfile: () => api.get('/api/profile/me'),
  updateProfile: (data) => {
    const formData = new FormData();
    if (data.username) formData.append('username', data.username);
    if (data.bio !== undefined) formData.append('bio', data.bio);
    if (data.avatar) formData.append('avatar', data.avatar);
    return api.put('/api/profile/me', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export const uploadAPI = {
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/upload/message', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export const reactionsAPI = {
  toggleReaction: (userId, messageId, reaction) =>
    api.post(`/api/reactions/${userId}/${messageId}`, { reaction }),
  getReactions: (userId, messageId) =>
    api.get(`/api/reactions/${userId}/${messageId}`)
};

export default api;

