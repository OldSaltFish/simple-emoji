<script lang="ts">
  import { onMount } from "svelte";
  import { imageHostsApi } from "$lib/api/index";
  import type { ImageHost } from "$lib/types";
  let imageHosts = $state<ImageHost[]>([]);
  let loading = $state(false);
  let showAddModal = $state(false);
  let editingHost = $state<ImageHost | null>(null);
  let formData = $state<Partial<ImageHost>>({});
  // 默认的 header 参数选项
  const headerOptions = [
    { key: "Authorization", description: "认证令牌" },
    { key: "X-API-Key", description: "API密钥" },
    { key: "Content-Type", description: "内容类型" },
  ];

  // 默认的 form 参数选项
  const formOptions = [
    { key: "image", description: "图片文件" },
    { key: "file", description: "文件" },
    { key: "type", description: "上传类型" },
    { key: "upload_preset", description: "上传预设" },
  ];

  onMount(async () => {
    await loadImageHosts();
  });

  async function loadImageHosts() {
    loading = true;
    try {
      imageHosts = (await imageHostsApi.getAll()).map((host) => ({
        ...host,
        header_params: JSON.parse(host.header_params),
        form_params: JSON.parse(host.form_params),
      }));
    } catch (error) {
      console.error("加载接口列表失败:", error);
      // 显示后端返回的具体错误信息
    }
    loading = false;
  }

  function openAddModal() {
    formData = {
      name: "",
      upload_url: "",
      header_params: {},
      form_params: {},
      is_enabled: true,
      max_limit: 1000,
    };
    editingHost = null;
    showAddModal = true;
  }

  function openEditModal(host: ImageHost) {
    formData = {
      ...host,
    };
    editingHost = host;
    showAddModal = true;
    console.log("dev edit:", formData);
  }

  function closeModal() {
    showAddModal = false;
    editingHost = null;
    formData = {};
  }

  async function saveHost() {
    try {
      // 验证必填字段
      if (!formData.name || !formData.upload_url) {
        alert("请填写接口名称和上传地址");
        return;
      }

      // 根据API文档要求，header_params必须包含Authorization，form_params必须包含type
      const headerParams = formData.header_params || {};
      const formParams = formData.form_params || {};

      const payload = {
        name: formData.name,
        upload_url: formData.upload_url,
        file_field: formData.file_field || "file",
        header_params: headerParams,
        form_params: formParams,
        is_enabled: formData.is_enabled ?? true,
        no_head : formData.no_head ?? false,
        url_path : formData.url_path || "",
        max_limit: formData.max_limit || 1000,
      };
      if (editingHost && editingHost.name) {
        // 更新现有接口
        await imageHostsApi.update(editingHost.name, payload);
      } else {
        // 添加新接口
        await imageHostsApi.create(payload);
      }

      await loadImageHosts();
      closeModal();
    } catch (error) {
      console.error("保存接口失败:", error);
      // 显示后端返回的具体错误信息
      alert(`保存失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  async function deleteHost(host: ImageHost) {
    if (confirm(`确定要删除接口 "${host.name}" 吗？`)) {
      try {
        if (!host.name) {
          throw new Error("接口名称不存在");
        }

        await imageHostsApi.delete(host.name);
        await loadImageHosts();
      } catch (error) {
        console.error("删除接口失败:", error);
        // 显示后端返回的具体错误信息
        alert(
          `删除失败: ${error instanceof Error ? error.message : "未知错误"}`,
        );
      }
    }
  }

  async function toggleHostStatus(host: ImageHost) {
    try {
      if (!host.name) {
        throw new Error("接口名称不存在");
      }

      const newStatus = !host.is_enabled;
      await imageHostsApi.toggleStatus(host.name, newStatus);

      host.is_enabled = newStatus;
    } catch (error) {
      console.error("切换接口状态失败:", error);
      // 显示后端返回的具体错误信息
      alert(
        `状态更新失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  function addHeaderParam() {
    if (!formData.header_params) {
      formData.header_params = {};
    }

    // 创建选择对话框
    const customKey = prompt(
      "请输入参数名称，或选择常用参数:\n常用参数: Authorization, X-API-Key, Content-Type",
    );
    if (customKey && !formData.header_params[customKey]) {
      formData.header_params[customKey] = "";

      // 如果是常用参数，设置默认值
      if (customKey === "Content-Type") {
        formData.header_params[customKey] = "application/json";
      } else if (customKey === "Authorization") {
        formData.header_params[customKey] = "Bearer YOUR_TOKEN";
      } else if (customKey === "X-API-Key") {
        formData.header_params[customKey] = "YOUR_API_KEY";
      }
    }
  }

  function removeHeaderParam(key: string) {
    if (formData.header_params) {
      delete formData.header_params[key];
    }
  }

  function addFormParam() {
    if (!formData.form_params) {
      formData.form_params = {};
    }

    // 创建选择对话框
    const customKey = prompt(
      "请输入参数名称，或选择常用参数:\n常用参数: image, file, type, upload_preset",
    );
    if (customKey && !formData.form_params[customKey]) {
      formData.form_params[customKey] = "";

      // 如果是常用参数，设置默认值
      if (
        customKey === "type" ||
        customKey === "image" ||
        customKey === "file"
      ) {
        formData.form_params[customKey] = "file";
      } else if (customKey === "upload_preset") {
        formData.form_params[customKey] = "your_preset";
      }
    }
  }

  function removeFormParam(key: string) {
    if (formData.form_params) {
      delete formData.form_params[key];
    }
  }
</script>

<div class="bg-white rounded-lg shadow">
  <div class="p-6 border-b border-gray-200">
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold text-gray-900">接口管理</h2>
      <button
        onclick={openAddModal}
        class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        添加接口
      </button>
    </div>
  </div>

  <div class="p-6">
    {#if loading}
      <div class="text-center py-8">
        <div
          class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
        ></div>
        <p class="mt-2 text-gray-600">加载中...</p>
      </div>
    {:else if imageHosts.length === 0}
      <div class="text-center py-8">
        <p class="text-gray-500">暂无接口配置</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >名称</th
              >
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >上传地址</th
              >
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >状态</th
              >
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >限制</th
              >
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >操作</th
              >
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each imageHosts as host}
              <tr>
                <td
                  class="px-6 py-4 whitespace-nowrap font-medium text-gray-900"
                  >{host.name}</td
                >
                <td
                  class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs"
                  >{host.upload_url}</td
                >
                <td class="px-6 py-4 whitespace-nowrap">
                  <button
                    onclick={() => toggleHostStatus(host)}
                    class="px-2 py-1 text-xs font-medium rounded-full
                           {host.is_enabled
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'}"
                  >
                    {host.is_enabled ? "启用" : "禁用"}
                  </button>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {host.current_load || 0}/{host.max_limit}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onclick={() => openEditModal(host)}
                    class="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    编辑
                  </button>
                  <button
                    onclick={() => deleteHost(host)}
                    class="text-red-600 hover:text-red-900"
                  >
                    删除
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<!-- 添加/编辑模态框 -->
{#if showAddModal}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div
      class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
    >
      <div class="p-6 border-b border-gray-200">
        <h3 class="text-xl font-bold text-gray-900">
          {editingHost ? "编辑接口" : "添加接口"}
        </h3>
      </div>

      <div class="p-6 space-y-6">
        <!-- 基本信息 -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >接口名称</label
            >
            <input
              bind:value={formData.name}
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="例如: Imgur"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >上传地址</label
            >
            <input
              bind:value={formData.upload_url}
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://api.example.com/upload"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >图片文件字段</label
            >
            <input
              bind:value={formData.file_field}
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://api.example.com/upload"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >响应url路径</label
            >
            <input
              bind:value={formData.url_path}
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="如data.url"
            />
          </div>
        </div>

        <!-- Header 参数 -->
        <div>
          <div class="flex justify-between items-center mb-2">
            <label class="block text-sm font-medium text-gray-700"
              >Header 参数</label
            >
            <button
              onclick={addHeaderParam}
              class="text-sm text-blue-600 hover:text-blue-800"
            >
              + 添加参数
            </button>
          </div>
          <div class="space-y-2">
            {#each Object.entries(formData.header_params || {}).map( ([name, value]) => ({ name, value }), ) as item}
              <div class="flex gap-2">
                <input
                  value={item.name}
                  type="text"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  readonly
                />
                <input
                  value={item.value || ""}
                  oninput={(e) => {
                    if (formData.header_params) {
                      formData.header_params[item.name] = (
                        e.target as HTMLInputElement
                      ).value;
                    }
                  }}
                  type="text"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="参数值"
                />
                <button
                  onclick={() => removeHeaderParam(item.name)}
                  class="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  删除
                </button>
              </div>
            {/each}
          </div>
          {#if Object.keys(formData.header_params || {}).length === 0}
            <div class="text-sm text-gray-500">
              常用参数: {headerOptions.map((opt) => opt.key).join(", ")}
            </div>
          {/if}
        </div>

        <!-- Form 参数 -->
        <div>
          <div class="flex justify-between items-center mb-2">
            <label class="block text-sm font-medium text-gray-700"
              >Form 参数</label
            >
            <button
              onclick={addFormParam}
              class="text-sm text-blue-600 hover:text-blue-800"
            >
              + 添加参数
            </button>
          </div>
          <div class="space-y-2">
            {#each Object.entries(formData.form_params || {}) as [key, value]}
              <div class="flex gap-2">
                <input
                  value={key}
                  type="text"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  readonly
                />
                <input
                  value={formData.form_params?.[key] || ""}
                  oninput={(e) => {
                    if (formData.form_params) {
                      formData.form_params[key] = (
                        e.target as HTMLInputElement
                      ).value;
                    }
                  }}
                  type="text"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="参数值"
                />
                <button
                  onclick={() => removeFormParam(key)}
                  class="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  删除
                </button>
              </div>
            {/each}
          </div>
          {#if Object.keys(formData.form_params || {}).length === 0}
            <div class="text-sm text-gray-500">
              常用参数: {formOptions.map((opt) => opt.key).join(", ")}
            </div>
          {/if}
        </div>

        <!-- 其他设置 -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex items-center">
            <input
              bind:checked={formData.no_head}
              type="checkbox"
              id="no_head"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label for="no_head" class="ml-2 block text-sm text-gray-700">
              不带头部
            </label>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >最大限制</label
            >
            <input
              bind:value={formData.max_limit}
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="1000"
            />
          </div>
          <div class="flex items-center">
            <input
              bind:checked={formData.is_enabled}
              type="checkbox"
              id="is_enabled"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label for="is_enabled" class="ml-2 block text-sm text-gray-700">
              启用此接口
            </label>
          </div>
        </div>
      </div>

      <div class="p-6 border-t border-gray-200 flex justify-end gap-3">
        <button
          onclick={closeModal}
          class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          取消
        </button>
        <button
          onclick={saveHost}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {editingHost ? "更新" : "添加"}
        </button>
      </div>
    </div>
  </div>
{/if}
