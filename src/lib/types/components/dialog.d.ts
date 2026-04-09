export type DialogType = 'alert' | 'confirm' | 'prompt';

export interface DialogState {
    isOpen: boolean;
    type: DialogType;
    title: string;
    message: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
    value?: string;
    resolve?: (value: any) => void;
}
