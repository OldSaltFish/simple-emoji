<script lang="ts">
  import { onMount } from 'svelte';

  onMount(() => {
    window.location.href = '/recent';
  });
</script>

<svelte:head>
  <title>魂祈梦</title>
</svelte:head>

<div class="flex items-center justify-center min-h-[calc(100vh-4rem)]">
  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
</div>
