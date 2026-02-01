import { writable } from 'svelte/store';

export interface Message {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  content: string;
  duration?: number;
}

export interface AdminState {
  isAdmin: boolean;
  messages: Message[];
}

const ADMIN_STORAGE_KEY = 'emotion-emoji-admin-mode';

// 从 localStorage 读取管理员状态
function getStoredAdminState(): boolean {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
    return stored === 'true';
  }
  return false;
}

// 保存管理员状态到 localStorage
function saveAdminState(isAdmin: boolean) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ADMIN_STORAGE_KEY, isAdmin.toString());
  }
}

function createAdminStore() {
  const initialState: AdminState = {
    isAdmin: getStoredAdminState(),
    messages: []
  };

  const { subscribe, set, update } = writable<AdminState>(initialState);

  return {
    subscribe,
    enableAdminMode: () => {
      update(state => ({ ...state, isAdmin: true }));
      saveAdminState(true);
    },
    disableAdminMode: () => {
      update(state => ({ ...state, isAdmin: false }));
      saveAdminState(false);
    },
    addMessage: (message: Omit<Message, 'id'>) => {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      update(state => ({
        ...state,
        messages: [...state.messages, { ...message, id }]
      }));
      
      // 自动移除消息（如果设置了持续时间）
      if (message.duration && message.duration > 0) {
        setTimeout(() => {
          update(state => ({
            ...state,
            messages: state.messages.filter(m => m.id !== id)
          }));
        }, message.duration);
      }
    },
    removeMessage: (id: string) => {
      update(state => ({
        ...state,
        messages: state.messages.filter(m => m.id !== id)
      }));
    },
    clearMessages: () => {
      update(state => ({ ...state, messages: [] }));
    }
  };
}

export const adminStore = createAdminStore();