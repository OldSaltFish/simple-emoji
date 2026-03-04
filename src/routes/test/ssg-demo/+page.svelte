<script lang="ts">
  import Select from '$lib/components/Select.svelte';
  import { browser } from '$app/environment';

  // 示例选项
  const frameworkOptions = [
    { value: 'vue', label: 'Vue' },
    { value: 'react', label: 'React' },
    { value: 'svelte', label: 'Svelte' },
    { value: 'angular', label: 'Angular' }
  ];

  // 状态管理
  let selectedValue = '';
  let isBrowser = browser;

  // 事件处理
  function handleChange(value: string) {
    console.log('选择变化:', value);
  }
</script>

<div class="max-w-4xl mx-auto p-8 space-y-8">
  <h1 class="text-3xl font-bold text-center text-gray-900">Select 组件 SSG 模式测试</h1>

  <!-- 环境信息 -->
  <div class="bg-white rounded-lg shadow-md p-6">
    <h2 class="text-xl font-semibold mb-4 text-gray-800">环境信息</h2>
    <p class="text-gray-600">当前环境: {isBrowser ? '浏览器' : '服务器'}</p>
    <p class="text-gray-600 mt-2">Select 组件应该只在浏览器环境中添加事件监听器</p>
  </div>

  <!-- Select 组件测试 -->
  <div class="bg-white rounded-lg shadow-md p-6">
    <h2 class="text-xl font-semibold mb-4 text-gray-800">Select 组件测试</h2>
    <p class="mb-4 text-gray-600">选择一个框架：</p>
    <div class="w-64">
      <Select
        options={frameworkOptions}
        bind:value={selectedValue}
        placeholder="请选择框架"
        onChange={handleChange}
      />
    </div>
    <p class="mt-4 text-sm text-gray-500">当前选择: {selectedValue || '未选择'}</p>
  </div>

  <!-- 测试说明 -->
  <div class="bg-white rounded-lg shadow-md p-6">
    <h2 class="text-xl font-semibold mb-4 text-gray-800">测试说明</h2>
    <ul class="list-disc pl-5 space-y-2 text-gray-600">
      <li>在开发环境中，组件会正常工作</li>
      <li>在 SSG 构建时，组件不会在服务器端执行 onMount</li>
      <li>在生产环境中，组件只会在客户端挂载时执行 onMount</li>
      <li>事件监听器只会在浏览器环境中添加，不会在服务器端执行</li>
    </ul>
  </div>

  <!-- 判断标准 -->
  <div class="bg-white rounded-lg shadow-md p-6">
    <h2 class="text-xl font-semibold mb-4 text-gray-800">判断标准</h2>
    <h3 class="font-medium text-gray-700 mb-2">如何判断代码在 SSG 模式下是否安全：</h3>
    <ul class="list-disc pl-5 space-y-2 text-gray-600">
      <li><strong>使用生命周期函数</strong>：只在 onMount 中添加事件监听器，因为 onMount 只在客户端执行</li>
      <li><strong>检查浏览器环境</strong>：使用 `browser` 变量确保只在浏览器环境中执行 DOM 操作</li>
      <li><strong>避免服务器端 DOM 操作</strong>：不要在组件初始化时直接操作 DOM</li>
      <li><strong>使用条件渲染</strong>：对于依赖浏览器 API 的组件，使用 {`{#if browser}`} 条件渲染</li>
      <li><strong>测试构建过程</strong>：运行 `npm run build` 检查是否有服务器端错误</li>
    </ul>
  </div>
</div>