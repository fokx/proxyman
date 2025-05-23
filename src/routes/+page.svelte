<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Typeahead from 'svelte-typeahead';
	import { TestType, ToastType } from '$lib';
	import { browser } from '$app/environment';

	let { data } = $props();
	let status_banners = $state([]);
	let all_proxies = $state(data.all_proxies);
	let ipinfo = $state();
	let selected_proxy = $state(data.current_proxy);
	let test_usability_controller = null;
	let filterUsable = $state(true);
	let statusBannerContainer: HTMLDivElement = $state(null);

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

	function cancel_test_usabilities() {
		test_usability_controller.abort();
		test_usability_controller = null;
		msg_toast('Cancelled!', 5000, ToastType.WARNING);
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
			<button onclick={() => service_operation("restart", get_service_name(p))}>Restart</button>
			<button onclick={()=>test_usability(p, TestType.IP)}>Test IP</button>
			<button onclick={()=>test_usability(p, TestType.USABLITY)}>Test Usability</button>
			<button onclick={()=>test_usability(p, TestType.LATENCY)}>Test Latency</button>
			<button onclick={()=>restart_proxygen(p.local_port)}>Use this proxy</button>
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
