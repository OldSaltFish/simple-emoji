<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  interface MenuItem {
    label: string;
    icon?: string;
    action: () => void;
    danger?: boolean;
    divider?: boolean;
  }

  let {
    items = $bindable([]),
    visible = $bindable(false),
    x = $bindable(0),
    y = $bindable(0)
  } = $props();

  let menuElement = $state<HTMLDivElement>();

  // 处理点击外部关闭菜单
  function handleClickOutside(event: MouseEvent) {
    if (menuElement && !menuElement.contains(event.target as Node)) {
      visible = false;
    }
  }

  // 处理滚动关闭菜单
  function handleScroll() {
    visible = false;
  }

  // 长按计时器
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  const LONG_PRESS_DURATION = 500;

  export function showMenu(clientX: number, clientY: number) {
    if (!browser) return;
    x = clientX;
    y = clientY;
    visible = true;

    // 调整菜单位置避免超出视口
    setTimeout(() => {
      if (menuElement) {
        const rect = menuElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (x + rect.width > viewportWidth) {
          x = viewportWidth - rect.width - 8;
        }
        if (y + rect.height > viewportHeight) {
          y = viewportHeight - rect.height - 8;
        }
      }
    }, 0);
  }

  export function hideMenu() {
    visible = false;
  }

  export function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    showMenu(event.clientX, event.clientY);
  }

  export function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    longPressTimer = setTimeout(() => {
      showMenu(touch.clientX, touch.clientY);
    }, LONG_PRESS_DURATION);
  }

  export function handleTouchEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  export function handleTouchMove() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  onMount(() => {
    if (browser) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('scroll', handleScroll, true);
    }
  });

  onDestroy(() => {
    if (browser) {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
    }
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
  });
</script>

{#if visible}
  <div
    bind:this={menuElement}
    class="fixed z-50 min-w-[160px] bg-white rounded-lg shadow-xl border border-gray-200 py-1"
    style="left: {x}px; top: {y}px;"
  >
    {#each items as item, i}
      {#if item.divider}
        {#if i > 0}
          <div class="my-1 border-t border-gray-200"></div>
        {/if}
      {:else}
        <button
          class="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 transition-colors"
          class:text-red-600={item.danger}
          class:text-gray-700={!item.danger}
          onclick={() => {
            item.action();
            visible = false;
          }}
        >
          {#if item.icon}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {@html item.icon}
            </svg>
          {/if}
          {item.label}
        </button>
      {/if}
    {/each}
  </div>
{/if}
