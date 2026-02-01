<script lang="ts">
  let { currentPage = $bindable(1), totalPages = $bindable(1), onPageChange = $bindable() } = $props();

  let jumpPage = $state('');
  let showJumpInput = $state(false);

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      currentPage = page;
      if (onPageChange) {
        onPageChange(page);
      }
    }
  }

  function handleJump() {
    const page = parseInt(jumpPage, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      goToPage(page);
      jumpPage = '';
      showJumpInput = false;
    }
  }

  function getVisiblePages(): number[] {
    const pages: number[] = [];
    const maxVisible = 5; // 减少可见页码数以适应小屏幕

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const half = Math.floor(maxVisible / 2);
      let start = Math.max(1, currentPage - half);
      let end = Math.min(totalPages, start + maxVisible - 1);

      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }

    return pages;
  }
</script>

<div class="w-full px-2 sm:px-4 py-4 sm:py-6">
  <div class="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
    <!-- 分页控制 -->
    <div class="flex items-center gap-1 sm:gap-2">
      <!-- 第一页 -->
      <button
        onclick={() => goToPage(1)}
        disabled={currentPage <= 1}
        class="hidden sm:flex p-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="第一页"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>

      <!-- 上一页 -->
      <button
        onclick={() => goToPage(currentPage - 1)}
        disabled={currentPage <= 1}
        class="p-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="上一页"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <!-- 页码 -->
      <div class="flex items-center gap-1">
        {#each getVisiblePages() as page, i}
          {#if i === 0 && page > 1}
            <button
              onclick={() => goToPage(1)}
              class="min-w-[32px] sm:min-w-[36px] px-2 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              1
            </button>
            {#if page > 2}
              <span class="px-1 text-gray-400">...</span>
            {/if}
          {/if}

          <button
            onclick={() => goToPage(page)}
            class="min-w-[32px] sm:min-w-[36px] px-2 py-2 text-sm border rounded-lg transition-colors"
            class:bg-blue-500={page === currentPage}
            class:text-white={page === currentPage}
            class:border-blue-500={page === currentPage}
            class:border-gray-300={page !== currentPage}
            class:hover:bg-gray-50={page !== currentPage}
          >
            {page}
          </button>

          {#if i === getVisiblePages().length - 1 && page < totalPages}
            {#if page < totalPages - 1}
              <span class="px-1 text-gray-400">...</span>
            {/if}
            <button
              onclick={() => goToPage(totalPages)}
              class="min-w-[32px] sm:min-w-[36px] px-2 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {totalPages}
            </button>
          {/if}
        {/each}
      </div>

      <!-- 下一页 -->
      <button
        onclick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        class="p-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="下一页"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <!-- 最后一页 -->
      <button
        onclick={() => goToPage(totalPages)}
        disabled={currentPage >= totalPages}
        class="hidden sm:flex p-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="最后一页"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- 页码信息 -->
    <div class="text-sm text-gray-500">
      {currentPage} / {totalPages}
    </div>

    <!-- 跳转输入 -->
    <div class="flex items-center gap-2">
      {#if showJumpInput}
        <div class="flex items-center gap-1">
          <input
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            bind:value={jumpPage}
            placeholder="页码"
            class="w-16 px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] focus:border-blue-400 text-center"
            onkeydown={(e) => e.key === 'Enter' && handleJump()}
          />
          <button
            onclick={handleJump}
            class="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            跳转
          </button>
          <button
            onclick={() => { showJumpInput = false; jumpPage = ''; }}
            class="p-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      {:else}
        <button
          onclick={() => showJumpInput = true}
          class="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          跳转
        </button>
      {/if}
    </div>
  </div>
</div>
