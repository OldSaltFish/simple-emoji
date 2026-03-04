<script lang="ts">
  import Select from '$lib/components/Select.svelte';

  // 示例选项
  const frameworkOptions = [
    { value: 'vue', label: 'Vue' },
    { value: 'react', label: 'React' },
    { value: 'svelte', label: 'Svelte' },
    { value: 'angular', label: 'Angular' },
    { value: 'preact', label: 'Preact' },
    { value: 'solid', label: 'Solid' },
    { value: 'lit', label: 'Lit' },
    { value: 'alpine', label: 'Alpine' }
  ];

  const languageOptions = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'csharp', label: 'C#' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' },
    { value: 'php', label: 'PHP' }
  ];

  // 状态管理
  let singleValue = '';
  let multipleValues: string[] = [];
  let searchableValues: string[] = [];

  // 事件处理
  function handleSingleChange(value: string) {
    console.log('单选值变化:', value);
  }

  function handleMultipleChange(values: string[]) {
    console.log('多值变化:', values);
  }

  function handleSearchableChange(values: string[]) {
    console.log('搜索值变化:', values);
  }
</script>

<div class="max-w-4xl mx-auto p-8 space-y-8">
  <h1 class="text-3xl font-bold text-center text-gray-900">Select 组件演示</h1>

  <!-- 单选模式 -->
  <div class="bg-white rounded-lg shadow-md p-6">
    <h2 class="text-xl font-semibold mb-4 text-gray-800">1. 单选模式</h2>
    <p class="mb-4 text-gray-600">选择一个框架：</p>
    <div class="w-64">
      <Select
        options={frameworkOptions}
        bind:value={singleValue}
        placeholder="请选择框架"
        onChange={handleSingleChange}
      />
    </div>
    <p class="mt-4 text-sm text-gray-500">当前选择: {singleValue || '未选择'}</p>
  </div>

  <!-- 多选模式 -->
  <div class="bg-white rounded-lg shadow-md p-6">
    <h2 class="text-xl font-semibold mb-4 text-gray-800">2. 多选模式</h2>
    <p class="mb-4 text-gray-600">选择多个编程语言：</p>
    <div class="w-64">
      <Select
        options={languageOptions}
        bind:values={multipleValues}
        placeholder="请选择语言"
        multiple={true}
        onChanges={handleMultipleChange}
      />
    </div>
    <p class="mt-4 text-sm text-gray-500">当前选择: {multipleValues.length > 0 ? multipleValues.join(', ') : '未选择'}</p>
  </div>

  <!-- 搜索模式 -->
  <div class="bg-white rounded-lg shadow-md p-6">
    <h2 class="text-xl font-semibold mb-4 text-gray-800">3. 搜索模式</h2>
    <p class="mb-4 text-gray-600">搜索并选择多个框架：</p>
    <div class="w-64">
      <Select
        options={frameworkOptions}
        bind:values={searchableValues}
        placeholder="搜索框架"
        multiple={true}
        searchable={true}
        onChanges={handleSearchableChange}
      />
    </div>
    <p class="mt-4 text-sm text-gray-500">当前选择: {searchableValues.length > 0 ? searchableValues.join(', ') : '未选择'}</p>
  </div>

  <!-- 禁用状态 -->
  <div class="bg-white rounded-lg shadow-md p-6">
    <h2 class="text-xl font-semibold mb-4 text-gray-800">4. 禁用状态</h2>
    <p class="mb-4 text-gray-600">禁用的选择器：</p>
    <div class="w-64">
      <Select
        options={frameworkOptions}
        placeholder="禁用状态"
        class="opacity-50 cursor-not-allowed"
      />
    </div>
  </div>

  <!-- 不同尺寸 -->
  <div class="bg-white rounded-lg shadow-md p-6">
    <h2 class="text-xl font-semibold mb-4 text-gray-800">5. 不同尺寸</h2>
    <div class="space-y-4">
      <div>
        <p class="mb-2 text-sm text-gray-600">小尺寸：</p>
        <div class="w-48">
          <Select
            options={frameworkOptions}
            placeholder="小尺寸"
          />
        </div>
      </div>
      <div>
        <p class="mb-2 text-sm text-gray-600">中尺寸（默认）：</p>
        <div class="w-64">
          <Select
            options={frameworkOptions}
            placeholder="中尺寸"
          />
        </div>
      </div>
      <div>
        <p class="mb-2 text-sm text-gray-600">大尺寸：</p>
        <div class="w-80">
          <Select
            options={frameworkOptions}
            placeholder="大尺寸"
          />
        </div>
      </div>
    </div>
  </div>
</div>