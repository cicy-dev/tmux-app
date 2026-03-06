// DEPRECATED: 将在 Phase 2 中删除，请使用 config.ts + api.ts
import config from '../config';

export const API_BASE = config.apiBase;
export const TTYD_BASE = config.ttydBase;
export const TTYD_WEB_BASE = config.ideBase;

export const getApiUrl = (path: string) => {
  if (path.startsWith('/ttyd/') && !path.startsWith('/ttyd/status')) {
    return TTYD_BASE + path;
  }
  return API_BASE + path;
};
