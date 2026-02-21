export const config = {
  fastApiBaseUrl: process.env.FASTAPI_URL || 'http://127.0.0.1:14444',
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 6901,
  hostIp: process.env.HOST_IP || 'host.docker.internal',
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

export const API_PATHS = {
  TMUX_LIST: '/api/tmux',
  TMUX_CREATE: '/api/tmux/create',
  TMUX_SEND: '/api/tmux/send',
  TMUX_CAPTURE: '/api/tmux/capture_pane',
  TMUX_PANE: (paneId: string) => `/api/tmux/panes/${encodeURIComponent(paneId)}`,
  TMUX_PANE_RESTART: (paneId: string) => `/api/tmux/panes/${encodeURIComponent(paneId)}/restart`,
  
  TTYD_LIST: '/api/ttyd/list',
  TTYD_START: (paneId: string) => `/api/ttyd/start/${encodeURIComponent(paneId)}`,
  TTYD_CONFIG: (paneId: string) => `/api/ttyd/config/${encodeURIComponent(paneId)}`,
  TTYD_BY_NAME: (name: string) => `/api/ttyd/by-name/${encodeURIComponent(name)}`,
  
  GROUPS: '/api/groups',
  GROUP: (groupId: number) => `/api/groups/${groupId}`,
  GROUP_LAYOUT: (groupId: number) => `/api/groups/${groupId}/layout`,
  GROUP_STATE: (groupId: number) => `/api/groups/${groupId}/state`,
  GROUP_PANES: (groupId: number) => `/api/groups/${groupId}/panes`,
  GROUP_PANE_LAYOUT: (groupId: number, paneId: string) => `/api/groups/${groupId}/panes/${encodeURIComponent(paneId)}/layout`,
  
  AUTH_VERIFY: '/api/auth/verify',
  HEALTH: '/api/health',
  REFRESH_CACHE: '/api/refresh-cache',
  KEY: '/api/key',
  CORRECT_ENGLISH: '/api/correctEnglish',
};
