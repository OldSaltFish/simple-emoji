import { writable } from 'svelte/store';
import type { DialogState, DialogType } from '$lib/types/components/dialog';

const initialState: DialogState = {
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
    confirmText: '确定',
    cancelText: '取消',
    value: '',
};

export const dialogStore = writable<DialogState>(initialState);

export const showDialog = (options: Partial<Omit<DialogState, 'isOpen' | 'resolve'>> & { type: DialogType }): Promise<any> => {
    return new Promise((resolve) => {
        dialogStore.set({
            isOpen: true,
            type: options.type,
            title: options.title || (options.type === 'alert' ? '提示' : options.type === 'confirm' ? '确认' : '输入'),
            message: options.message || '',
            placeholder: options.placeholder || '',
            confirmText: options.confirmText || '确定',
            cancelText: options.cancelText || '取消',
            value: options.value || '',
            resolve
        });
    });
};

export const closeDialog = (result: any = null) => {
    dialogStore.update(state => {
        if (state.resolve) {
            state.resolve(result);
        }
        return { ...state, isOpen: false, resolve: undefined };
    });
};

export const customAlert = (message: string, title?: string) => showDialog({ type: 'alert', message, title });
export const customConfirm = (message: string, title?: string) => showDialog({ type: 'confirm', message, title });
export const customPrompt = (message: string, value?: string, title?: string) => showDialog({ type: 'prompt', message, value, title });
