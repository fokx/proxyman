<script lang="ts">
 import { onMount, tick } from 'svelte';
 import Typeahead from 'svelte-typeahead';
 import { TestType, ToastType } from '$lib';
 import { browser } from '$app/environment';
 import CodeEditorModal from '$lib/components/CodeEditorModal.svelte';

	let { data } = $props();
	let status_banners = $state([]);
	let all_proxies = $state(data.all_proxies);
	let ipinfo = $state();
	let selected_proxy = $state(data.current_proxy);
	let test_usability_controller = null;
	let filterUsable = $state(true);
	let statusBannerContainer: HTMLDivElement = $state(null);
	let selectedProxyType = $state('all');
	let selectedOperation = $state('restart');

	// Code editor state
	let isEditorOpen = $state(false);
	let editorTool = $state('');
	let editorName = $state('');
	let editorContent = $state('');
	let editorFilePath = $state('');

	let filteredProxies = $derived.by(() => {
		if (filterUsable) {
			return all_proxies.filter(proxy => proxy.usable).sort((a, b) => a.latency_ms - b.latency_ms);
		} else {
			return all_proxies.filter(proxy => !proxy.usable).sort((a, b) => a.latency_ms - b.latency_ms);
		}
	});

	if (browser) {
		const socket = new WebSocket('/ws/push-proxy-info');
		socket.onmessage = (event) => {
			let data = JSON.parse(event.data);
			if (data['type'] == 'current-proxy') {
				let p = all_proxies.find(proxy => proxy.local_port === data['data']['from_port']);
				if (p) {
					selected_proxy = p;
				}
			} else if (data['type'] == 'all-proxies') {
				all_proxies = data['data'];
			} else if (data['type'] == 'ipinfo') {
				ipinfo = data['data'];
			}
		};
	}

	function get_service_name(proxy) {
		return proxy.tool + '@' + proxy.name;
	}

	function msg_toast(msg: string, timeout_ms = 2000, type = ToastType.INFO) {
		let id = Date.now();
		status_banners.push({ id: id, msg: msg, type: type });
		if (timeout_ms != -1) {
			setTimeout(() => {
				status_banners = status_banners.filter((item) => item.id !== id);
			}, timeout_ms);
		}
	}

	async function service_operation(action, name) {
		try {
			let body = JSON.stringify({ action: action, name: name });
			const response = await fetch('/api/service-operation', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: body
			});
			if (!response.ok) {
				const errorText = await response.text();
				msg_toast(errorText, 10000, ToastType.ERROR);
			} else if (response.status === 200) {
				msg_toast('' + action + ' service ' + name + ' successfully', -1, ToastType.SUCCESS);
			}
		} catch (error) {
			alert('Error:' + error);
		}
	}

	async function restart_proxygen(from_port: number) {
		try {
			let body = JSON.stringify({ from_port: from_port });
			const response = await fetch('/api/restart-proxygen', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: body
			});
			if (!response.ok) {
				const errorText = await response.text();
				msg_toast(errorText, 10000, ToastType.ERROR);
			} else if (response.status === 200) {
				msg_toast('restart proxygen with new from port ' + from_port + ' successfully', -1, ToastType.SUCCESS);
			}
		} catch (error) {
			alert('Error:' + error);
		}
	}

	function test_usability(proxy, type: TestType, signal = null) {
		if (type === TestType.IP) {
			test_usability(proxy, TestType.IPV4, signal);
			test_usability(proxy, TestType.IPV6, signal);
			return;
		}
		console.log('sending req');
		fetch('/api/test-usability', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ socks5_port: proxy.local_port, type: type }),
			signal: signal
		})
			.then((response) => {
				if (!response.ok) {
					return response.text().then((errorText) => {
						msg_toast(errorText, 10000, ToastType.ERROR);
					});
				} else if (response.status === 200) {
					msg_toast('test usability for ' + proxy.tool + '@' + proxy.name + ' successfully', 2000, ToastType.SUCCESS);
				}
			})
			.catch((error) => {
				msg_toast('Error: ' + error.message, 10000, ToastType.ERROR);
			});
	}

	async function test_usabilities(type: TestType) {
		const controller = new AbortController();
		const signal = controller.signal;
		const promises = all_proxies.map((proxy) => test_usability(proxy, type, signal));

		test_usability_controller = controller;
		msg_toast('Tests in progress', 5000, ToastType.WARNING);

		try {
			await Promise.all(promises);
			msg_toast('All tests completed successfully', 5000, ToastType.SUCCESS);
		} catch (error) {
			if (error.name === 'AbortError') {
				msg_toast('Tests were cancelled', 5000, ToastType.WARNING);
			} else {
				msg_toast('An error occurred during tests', 5000, ToastType.ERROR);
			}
		}
	}

	async function service_batch_operation(action: string, proxyType: string = 'all') {
		const filteredProxies = proxyType === 'all'
			? all_proxies
			: all_proxies.filter(p => p.tool === proxyType);
		const promises = filteredProxies.map((p) => service_operation(action, get_service_name(p)));
		msg_toast('Operations in progress', 5000, ToastType.WARNING);

		try {
			await Promise.all(promises);
			msg_toast('All operations completed successfully', 5000, ToastType.SUCCESS);
		} catch (error) {
			if (error.name === 'AbortError') {
				msg_toast('Operations were cancelled', 5000, ToastType.WARNING);
			} else {
				msg_toast('An error occurred during operations', 5000, ToastType.ERROR);
			}
		}
	}

	function cancel_test_usabilities() {
		test_usability_controller.abort();
		test_usability_controller = null;
		msg_toast('Cancelled!', 5000, ToastType.WARNING);
	}

	async function openConfigEditor(proxy) {
		try {
			editorTool = proxy.tool;
			editorName = proxy.name;

			// Fetch the configuration file
			const response = await fetch(`/api/config?tool=${proxy.tool}&name=${proxy.name}`);

			if (!response.ok) {
				const errorText = await response.text();
				msg_toast(errorText, 10000, ToastType.ERROR);
				return;
			}

			const data = await response.json();
			editorContent = data.content;
			editorFilePath = data.filePath;
			isEditorOpen = true;
		} catch (error) {
			console.error('Error opening config editor:', error);
			msg_toast(`Error opening config editor: ${error.message}`, 10000, ToastType.ERROR);
		}
	}

	onMount(() => {
		if (statusBannerContainer) {
			statusBannerContainer.scroll(0, 1);
		}
		$effect.pre(() => {
			$state.snapshot(status_banners);
			tick().then(() => {
				statusBannerContainer.scrollTo(0, statusBannerContainer.scrollHeight);
			});
		});
	});
</script>
{#snippet display_proxy(p)}
	{#if p}
		<p>
			{#if p.tool === "tuicc"}
				<span class="text-blue-500">{p.tool}</span>
			{:else if p.tool === "hyc"}
				<span class="text-green-500">{p.tool}</span>
			{:else if p.tool === "np"}
				<span class="text-orange-500">{p.tool}</span>
			{:else}
				<span>{p.tool}</span>
			{/if}@{p.name}
			:<span>{p.local_port}</span>
			{#if p.latency_ms}
				latency: <span>{p.latency_ms.toFixed(1)}</span> ms,
			{/if}
			{#if p.usable !== undefined && p.usable !== null}
				usable:
				{#if p.usable}✅{:else}❌{/if}
			{/if}
			{#if p.outgoing_ipv4}
				ipv4: <span>{p.outgoing_ipv4}</span>
			{/if}
			{#if p.outgoing_ipv4_location}
				<span>loc: {p.outgoing_ipv4_location}</span>
			{/if}
			{#if p.outgoing_ipv4_country}
				<span>C: {p.outgoing_ipv4_country}</span>
			{/if}
			{#if p.outgoing_ipv6}
				ipv6: <span>{p.outgoing_ipv6}</span>
			{/if}
			{#if p.outgoing_ipv6_location}
				<span>loc: {p.outgoing_ipv6_location}</span>
			{/if}
			{#if p.outgoing_ipv6_country}
				<span>C: {p.outgoing_ipv6_country}</span>
			{/if}
		</p>

		<p>
			<button onclick={() => service_operation("server-stop", get_service_name(p))}>Stop on server</button>
			<button onclick={() => service_operation("server-restart", get_service_name(p))}>Restart on server</button>
			<button onclick={() => service_operation("server-enable", get_service_name(p))}>Enable on server</button>
			<button onclick={() => service_operation("server-disable", get_service_name(p))}>Disable on server</button>
		</p>
		<p>
			<button onclick={() => service_operation("restart", get_service_name(p))}>Restart</button>
			<button onclick={()=>test_usability(p, TestType.IP)}>Test IP</button>
			<button onclick={()=>test_usability(p, TestType.USABLITY)}>Test Usability</button>
			<button onclick={()=>test_usability(p, TestType.LATENCY)}>Test Latency</button>
			<button onclick={()=>restart_proxygen(p.local_port)}>Use this proxy</button>
   <button onclick={() => openConfigEditor(p)}>Edit proxy config file</button>
		</p>
	{:else}
		<p class="text-red-500">
			<span>proxy is null</span>
		</p>
	{/if}
{/snippet}

<div class="prose-xl lg:prose-2xl max-w-7xl mx-auto button-theme">
	{#if all_proxies}
		<div class="bg-gray-100">
			{#if selected_proxy}
				<p>Current proxy in use:</p>
				{@render display_proxy(selected_proxy)}
			{:else}
				<p class="text-red-500">No proxygen running</p>
			{/if}
			{#if ipinfo}
				<!--				<p>IP info:</p>-->
				<!--				<p>{ipinfo.ip}</p>-->
				<!--				<p>{ipinfo.city}, {ipinfo.region}, {ipinfo.country}</p>-->
				<!--				<p>{ipinfo.org}</p>-->
			{:else}
				<p class="text-gray-500">No info about current IP</p>
			{/if}
		</div>

		<div class="flex gap-4 items-center mb-5">
			<select bind:value={selectedProxyType} class="form-select">
				<option value="all">all</option>
				<option value="tuicc">tuicc</option>
				<option value="hyc">hyc</option>
				<option value="np">np</option>
			</select>
			<select bind:value={selectedOperation} class="form-select">
				<option value="restart">Restart</option>
				<option value="stop">Stop</option>
				<option value="start">Start</option>
				<option value="disable">Disable</option>
				<option value="enable">Enable</option>
			</select>
			<button onclick={() => service_batch_operation(selectedOperation, selectedProxyType)}>Execute</button>
		</div>
		<button onclick={()=>test_usabilities(TestType.IP)}>Test IPs</button>
		<button onclick={()=>test_usabilities(TestType.USABLITY)}>Test usabilities</button>
		<button onclick={()=>test_usabilities(TestType.LATENCY)}>Test latencies</button>
		<button onclick={()=>cancel_test_usabilities()}>Cancel tests</button>
		<div class="bg-green-50 h-48 overflow-y-scroll" bind:this={statusBannerContainer}>
			{#each status_banners as banner}
				{#if banner.type === ToastType.INFO}
					<p class="text-blue-500">
						{banner.msg}
					</p>
				{:else if banner.type === ToastType.ERROR}
					<p class="text-red-500">
						{banner.msg}
					</p>
				{:else if banner.type === ToastType.SUCCESS}
					<p class="text-green-500">
						{banner.msg}
					</p>
				{:else if banner.type === ToastType.WARNING}
					<p class="text-orange-500">
						{banner.msg}
					</p>
				{/if}
			{/each}
		</div>
		<Typeahead
			label="Change proxy"
			showAllResultsOnFocus={true}
			inputAfterSelect="clear"
			placeholder={`Search a proxy (e.g. "lax") and click to switch`}
			data={all_proxies}
			extract={(item) => get_service_name(item)}
			disable={(item) => /mnz/.test(item.name)}
			on:select={({ detail }) => {selected_proxy = detail.original; restart_proxygen(detail.original.local_port);}}
		/>

		{#if filteredProxies.length > 0}
			<div class="flex space-x-4 my-4">
				<label>
					<input type="checkbox" bind:checked={filterUsable} />
					toggle usable
				</label>
			</div>
			{#each filteredProxies as proxy}
				{@render display_proxy(proxy)}
			{/each}
		{:else}
			<p>No usable proxies, here is all:</p>
			{#each all_proxies as proxy}
				{@render display_proxy(proxy)}
			{/each}
		{/if}
	{/if}
</div>

<CodeEditorModal 
	bind:isOpen={isEditorOpen}
	bind:tool={editorTool}
	bind:name={editorName}
	bind:content={editorContent}
	bind:filePath={editorFilePath}
	on:close={() => {
		isEditorOpen = false;
	}}
/>
