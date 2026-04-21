<script lang="ts">
	import { adminStore } from '$lib/stores/admin';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { config } from '$lib/config/env';

	interface TestResult {
		requestId: number;
		status: 'pending' | 'success' | 'error' | 'timeout';
		startTime: number;
		endTime?: number;
		duration?: number;
		data?: any;
		error?: string;
	}

	let results = $state<TestResult[]>([]);
	let isRunning = $state(false);
	let concurrentCount = $state(10);
	let delaySeconds = $state(5);
	let timeoutSeconds = $state(10);
	let useAbortController = $state(true);

	// 检查管理员权限（仅在浏览器端执行）
	adminStore.subscribe(state => {
		if (browser && !state.isAdmin) {
			goto('/');
		}
	});

	async function runTest() {
		isRunning = true;
		results = [];

		// 初始化所有请求为pending状态
		const startTime = Date.now();
		for (let i = 1; i <= concurrentCount; i++) {
			results.push({
				requestId: i,
				status: 'pending',
				startTime: startTime
			});
		}

		// 同时发起所有请求
		const promises = results.map(async (result, index) => {
			let controller: AbortController | null = null;
			let timeoutId: ReturnType<typeof setTimeout> | null = null;

			if (useAbortController) {
				controller = new AbortController();
				timeoutId = setTimeout(() => {
					controller?.abort();
				}, timeoutSeconds * 1000);
			}

			try {
				const fetchOptions: RequestInit = {
					mode: 'cors',
					credentials: 'omit'
				};
				if (controller) {
					fetchOptions.signal = controller.signal;
				}

				const response = await fetch(
					`${config.apiBaseUrl}/bing/concurrent-test/${result.requestId}?delay=${delaySeconds}`,
					fetchOptions
				);
				if (timeoutId) clearTimeout(timeoutId);

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}

				const data = await response.json();
				const endTime = Date.now();

				results[index] = {
					...result,
					status: 'success',
					endTime,
					duration: endTime - result.startTime,
					data
				};
			} catch (err: any) {
				if (timeoutId) clearTimeout(timeoutId);
				const endTime = Date.now();

				results[index] = {
					...result,
					status: err.name === 'AbortError' ? 'timeout' : 'error',
					endTime,
					duration: endTime - result.startTime,
					error: err.name === 'AbortError' ? '请求超时' : err.message
				};
			}
		});

		await Promise.all(promises);
		isRunning = false;
	}

	function getStatusColor(status: TestResult['status']) {
		switch (status) {
			case 'pending': return 'bg-yellow-100 text-yellow-800';
			case 'success': return 'bg-green-100 text-green-800';
			case 'error': return 'bg-red-100 text-red-800';
			case 'timeout': return 'bg-orange-100 text-orange-800';
		}
	}

	function getStatusText(status: TestResult['status']) {
		switch (status) {
			case 'pending': return '等待中';
			case 'success': return '成功';
			case 'error': return '错误';
			case 'timeout': return '超时';
		}
	}

	$effect(() => {
		// 自动排序：pending在前，然后按requestId排序
		results = results.sort((a, b) => {
			if (a.status === 'pending' && b.status !== 'pending') return -1;
			if (b.status === 'pending' && a.status !== 'pending') return 1;
			return a.requestId - b.requestId;
		});
	});
</script>

<div class="bg-gray-50 min-h-screen p-8">
	<div class="max-w-4xl mx-auto">
		<div class="mb-6">
			<h1 class="text-2xl font-bold text-gray-900">HTTP并发限制测试</h1>
		</div>

		<div class="bg-white rounded-lg shadow p-6 mb-6">
			<p class="text-gray-600 mb-4">
				测试说明：HTTP/1.1浏览器通常限制同时只能有6个并发请求到同一域名。
				此测试会同时发起多个请求，观察哪些请求会被阻塞或超时。
			</p>

			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">并发请求数</label>
					<input
						type="number"
						bind:value={concurrentCount}
						min="1"
						max="20"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
						disabled={isRunning}
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">服务端延迟(秒)</label>
					<input
						type="number"
						bind:value={delaySeconds}
						min="1"
						max="300"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
						disabled={isRunning}
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">超时时间(秒)</label>
					<input
						type="number"
						bind:value={timeoutSeconds}
						min="1"
						max="300"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
						disabled={isRunning}
					/>
				</div>
			</div>

			<div class="flex items-center gap-4 mb-4">
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={useAbortController}
						disabled={isRunning}
						class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
					/>
					<span class="text-sm text-gray-700">使用 AbortController 设置超时</span>
				</label>
				{#if !useAbortController}
					<span class="text-sm text-orange-600">测试 fetch 默认超时（可能等待几分钟）</span>
				{/if}
			</div>

			<button
				onclick={runTest}
				disabled={isRunning}
				class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
			>
				{isRunning ? '测试中...' : '开始测试'}
			</button>
		</div>

		{#if results.length > 0}
			<div class="bg-white rounded-lg shadow overflow-hidden">
				<table class="w-full">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-700">请求ID</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-700">状态</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-700">耗时(ms)</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-700">详情</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200">
						{#each results as result}
							<tr class="hover:bg-gray-50">
								<td class="px-4 py-3 text-sm text-gray-900">#{result.requestId}</td>
								<td class="px-4 py-3">
									<span class="inline-flex px-2 py-1 text-xs font-medium rounded-full {getStatusColor(result.status)}">
										{getStatusText(result.status)}
									</span>
								</td>
								<td class="px-4 py-3 text-sm text-gray-900">
									{#if result.duration !== undefined}
										{result.duration}ms
									{:else}
										-
									{/if}
								</td>
								<td class="px-4 py-3 text-sm text-gray-600">
									{#if result.error}
										<span class="text-red-600">{result.error}</span>
									{:else if result.data}
										服务端延迟: {result.data.delay}s
									{:else}
										-
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if !isRunning}
				<div class="mt-4 bg-white rounded-lg shadow p-4">
					<h3 class="font-medium text-gray-900 mb-2">测试结果统计</h3>
					<div class="grid grid-cols-4 gap-4 text-center">
						<div>
							<div class="text-2xl font-bold text-green-600">
								{results.filter(r => r.status === 'success').length}
							</div>
							<div class="text-sm text-gray-600">成功</div>
						</div>
						<div>
							<div class="text-2xl font-bold text-orange-600">
								{results.filter(r => r.status === 'timeout').length}
							</div>
							<div class="text-sm text-gray-600">超时</div>
						</div>
						<div>
							<div class="text-2xl font-bold text-red-600">
								{results.filter(r => r.status === 'error').length}
							</div>
							<div class="text-sm text-gray-600">错误</div>
						</div>
						<div>
							<div class="text-2xl font-bold text-gray-600">
								{Math.max(...results.map(r => r.duration || 0))}ms
							</div>
							<div class="text-sm text-gray-600">最大耗时</div>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
