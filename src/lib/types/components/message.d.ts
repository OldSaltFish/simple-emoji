export type MessageType = 'success' | 'info' | 'warning' | 'error';

export interface MessageItem {
    id: string;
    type: MessageType;
    text: string;
    duration?: number;
}