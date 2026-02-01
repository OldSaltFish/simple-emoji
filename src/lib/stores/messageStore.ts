// messageStore.ts
import { writable } from 'svelte/store';
import type { MessageItem, MessageType } from '$lib/types/components/message';

// 导出 store 供组件订阅
export const messages = writable<MessageItem[]>([]);

/**
 * 显示消息函数
 * @param text 提示内容
 * @param type 类型
 * @param duration 显示时间 (ms)，传 0 则不自动关闭
 */
export const showMessage = (
    text: string, 
    type: MessageType = 'info', 
    duration: number = 3000
): void => {
    const id = Math.random().toString(36).substring(2, 9);
    const newMessage: MessageItem = { id, type, text, duration };

    messages.update((prev) => [...prev, newMessage]);

    if (duration > 0) {
        setTimeout(() => {
            removeMessage(id);
        }, duration);
    }
};

export const removeMessage = (id: string): void => {
    messages.update((prev) => prev.filter(m => m.id !== id));
};