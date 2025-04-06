<script lang="ts">
	import '../app.css';
	import Typeahead from "svelte-typeahead";
	import { invalidate, invalidateAll } from '$app/navigation';
	let { data } = $props();
	let status_banner = $state('');
	let proxies = data.proxies;
	let current_proxy = data.current_proxy;
	let selected_proxy = $state(current_proxy);

	function get_service_name(proxy) {
		return proxy.tool + '@' + proxy.name;
	}

	function msg_toast(msg: string, timeout_ms = 2000) {
		if (status_banner && status_banner !== '') {
			status_banner += '\n';
		}
		status_banner += msg;
		setTimeout(() => {
			status_banner = '';
		}, timeout_ms);
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
				msg_toast(errorText, 10000);
			} else if (response.status === 200) {
				msg_toast('' + action + ' service ' + name + ' successfully', 2000);
			}
		} catch (error) {
			alert('Error:' + error);
		}
	}
	async function restart_proxygen(from_port:number) {
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
				msg_toast(errorText, 10000);
			} else if (response.status === 200) {
				msg_toast('restart proxygen with new from port ' + from_port + ' successfully', 2000);
			}
		} catch (error) {
			alert('Error:' + error);
		}
	}
	// $effect(() => {
	// });
</script>

{#snippet display_proxy(p)}
	{#if p}
		<p>
			<span>{p.tool}@{p.name}</span>
			<span>{p.local_port}</span>
			<button class="bg-amber-200" onclick={()=>service_operation("restart", get_service_name(p))}>Restart</button>
		</p>
	{:else}
		<p class="text-red-500">
			<span>proxy is null</span>
		</p>
	{/if}
{/snippet}

<div class="prose lg:prose-xl"  style="max-width: 600px; margin: auto;">
{#if proxies}
	<div class="prose bg-gray-100">
		{#if selected_proxy}
			<p>Current proxy in use:</p>
			{@render display_proxy(selected_proxy)}
		{:else}
			<p class="text-red-500">
				No proxygen running</p>
		{/if}
	</div>
	{#if status_banner && status_banner !== ""}
		<div class="bg-green-50">
			{status_banner}
		</div>
	{/if}
		<Typeahead
			label="Proxy list"
			showAllResultsOnFocus
			placeholder={`Search a proxy (e.g. "lax")`}
			data={proxies}
			extract={(item) => get_service_name(item)}
			disable={(item) => /Carolina/.test(item.name)}
			on:select={({ detail }) => {selected_proxy = detail.original; restart_proxygen(detail.original.local_port);}}
		/>

		{#if proxies.length > 0}
			{#each proxies as proxy}
				{@render display_proxy(proxy)}
			{/each}
		{:else}
			<p>No proxies found</p>
		{/if}
{/if}
</div>
