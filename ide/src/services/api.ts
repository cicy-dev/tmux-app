import axios from 'axios';
import config from '../config';
import { TokenManager } from './tokenManager';

const http = axios.create({ baseURL: config.apiBase });

http.interceptors.request.use((cfg) => {
  const token = TokenManager.getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

const api = {
  // Auth
  verifyToken:      ()                                     => http.post('/api/auth/verify-token'),
  verifyAuth:       (token: string)                        => http.get('/api/auth/verify', { headers: { Authorization: `Bearer ${token}` } }),

  // Panes
  getPanes:         ()                                     => http.get('/api/tmux/panes'),
  getAllStatus:      ()                                     => http.get('/api/tmux/status/all'),
  getPane:          (id: string)                           => http.get(`/api/tmux/panes/${encodeURIComponent(id)}`),
  updatePane:       (id: string, data: any)                => http.patch(`/api/tmux/panes/${encodeURIComponent(id)}`, data),
  deletePane:       (id: string)                           => http.delete(`/api/tmux/panes/${encodeURIComponent(id)}`),
  createPane:       (data: any)                            => http.post('/api/tmux/create', data),
  restartPane:      (id: string)                           => http.post(`/api/tmux/panes/${encodeURIComponent(id)}/restart`),
  capturePane:      (id: string, lines?: number)            => http.post('/api/tmux/capture_pane', { pane_id: id, lines: lines || 100 }),

  // Tmux operations
  sendCommand:      (winId: string, text: string)          => http.post('/api/tmux/send', { win_id: winId, text }),
  sendKeys:         (winId: string, keys: string)          => http.post('/api/tmux/send-keys', { win_id: winId, keys }),
  toggleMouse:      (mode: string, paneId: string)         => http.post(`/api/tmux/mouse/${mode}`, null, { params: { pane_id: paneId } }),
  chooseSession:    (id: string)                           => http.post(`/api/tmux/panes/${encodeURIComponent(id)}/choose-session`),
  splitPane:        (id: string, dir: string)              => http.post(`/api/tmux/panes/${encodeURIComponent(id)}/split`, null, { params: { direction: dir } }),
  unsplitPane:      (id: string)                           => http.post(`/api/tmux/panes/${encodeURIComponent(id)}/unsplit`),

  // Agents
  deleteAgent:      (id: string)                           => http.delete(`/api/agents/${encodeURIComponent(id)}`),
  getAgentsByPane:  (id: string)                           => http.get(`/api/agents/pane/${encodeURIComponent(id)}`),
  bindAgent:        (data: any)                            => http.post('/api/agents/bind', data),
  unbindAgent:      (agentId: number)                      => http.delete(`/api/agents/unbind/${agentId}`),

  // TTYD
  getTtydConfig:    (id: string)                           => http.get(`/api/ttyd/config/${encodeURIComponent(id)}`),
  updateTtydConfig: (id: string, data: any)                => http.put(`/api/ttyd/config/${encodeURIComponent(id)}`, data),
  getTtydStatus:    (id: string)                           => http.get(`/api/ttyd/status/${encodeURIComponent(id)}`),

  // Utils
  correctEnglish:   (text: string)                         => http.post('/api/correctEnglish', { text }),
  fileExists:       (path: string)                         => http.get('/api/utils/file/exists', { params: { path } }),
  stt:              (formData: FormData)                   => http.post('/stt', formData, { baseURL: config.sttBase, headers: { 'Content-Type': 'multipart/form-data' } }),

  // Global settings
  getGlobalSettings:    ()                                 => http.get('/api/settings/global'),
  updateGlobalSettings: (data: any)                        => http.post('/api/settings/global', data),

  // Tokens
  listTokens:       ()                                     => http.get('/api/auth/tokens'),
  createToken:      (data: any)                            => http.post('/api/auth/tokens', data),
  deleteToken:      (id: number)                           => http.delete(`/api/auth/tokens/${id}`),

  // Groups
  listGroups:       ()                                     => http.get('/api/groups'),

  // Pane list (legacy)
  getPaneList:      ()                                     => http.get('/api/tmux/panes'),
  listPanes:        ()                                     => http.get('/api/tmux/list'),
};

export default api;
