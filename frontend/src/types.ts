export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface AppSettings {
  panelPosition: Position;
  panelSize: Size;
  forwardEvents: boolean;
  lastDraft?: string;
  showPrompt: boolean;
  showVoiceControl: boolean;
  voiceButtonPosition: Position;
  commandHistory: string[];
}

export interface SystemEvent {
  type: 'keydown' | 'keyup';
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

// Group management types
export interface TtydGroup {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  pane_ids: string[];
  pane_count: number;
}

export interface GroupPaneLayout {
  id: number;
  pane_id: string;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  z_index: number;
}

export interface TtydGroupDetail {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  panes: GroupPaneLayout[];
}

export type SidebarMode = 'session' | 'group' | 'component';
export type MainMode = 'terminal' | 'group' | 'component';

export interface CustomComponent {
  id: number;
  name: string;
  url: string;
  description: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
