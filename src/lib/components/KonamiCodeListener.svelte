<script lang="ts">
  import { onMount } from 'svelte';
  import { adminStore } from '$lib/stores/admin';

  // Konami Code: ↑↑↓↓←→←→BA
  const konamiCode = [
    'ArrowUp', 'ArrowUp',
    'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight',
    'ArrowLeft', 'ArrowRight',
    'b', 'a'
  ];

  let keySequence = $state<string[]>([]);
  let isAdmin = $state(false);

  onMount(() => {
    // 监听管理员状态变化
    const unsubscribe = adminStore.subscribe(state => {
      isAdmin = state.isAdmin;
    });

    // 键盘事件监听
    function handleKeyPress(event: KeyboardEvent) {
      // 如果已经是管理员模式，就不需要再监听
      if (isAdmin) return;

      const key = event.key.toLowerCase();
      keySequence.push(key);

      // 保持序列长度不超过Konami Code的长度
      if (keySequence.length > konamiCode.length) {
        keySequence.shift();
      }

      // 检查是否匹配Konami Code
      if (keySequence.length === konamiCode.length) {
        const isMatch = keySequence.every((key, index) => 
          key === konamiCode[index].toLowerCase()
        );

        if (isMatch) {
          adminStore.enableAdminMode();
          adminStore.addMessage({
            type: 'success',
            content: '🎮 管理员模式已激活！',
            duration: 3000
          });
          keySequence = [];
        }
      }
    }

    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      unsubscribe();
    };
  });
</script>