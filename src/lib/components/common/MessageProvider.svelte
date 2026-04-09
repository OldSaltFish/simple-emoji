<script lang="ts">
    import { messages, removeMessage } from '$lib/stores/messageStore';
    import { fly } from 'svelte/transition';
    import { flip } from 'svelte/animate';
    // types.ts
    import type { MessageType } from '$lib/types/components/message';
    // import type { MessageItem } from '$lib/types/components/message';
    // 样式映射
    const styles: Record<MessageType, string> = {
        success: 'bg-green-50 text-green-700 border-green-200',
        info: 'bg-blue-50 text-blue-700 border-blue-200',
        warning: 'bg-amber-50 text-amber-700 border-amber-200',
        error: 'bg-red-50 text-red-700 border-red-200'
    };

    // 图标路径映射
    const icons: Record<MessageType, string> = {
        success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
        error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
    };
</script>

<div class="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-3 pointer-events-none w-full max-w-[400px]">
    {#each $messages as msg (msg.id)}
        <div
            animate:flip={{ duration: 200 }}
            in:fly={{ y: -20, duration: 300 }}
            out:fly={{ y: -20, opacity: 0, duration: 200 }}
            class="{styles[msg.type]} flex items-center w-[90%] md:w-full px-4 py-3 rounded border shadow-sm pointer-events-auto transition-all"
        >
            <svg class="w-5 h-5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={icons[msg.type]}></path>
            </svg>
            
            <span class="text-sm font-medium">{msg.text}</span>

            <button 
                onclick={() => removeMessage(msg.id)}
                class="ml-auto pl-4 transition-opacity hover:opacity-60"
                aria-label="Close"
            >
                <svg class="w-4 h-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    {/each}
</div>