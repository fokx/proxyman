// export const URL_USABILITY_TEST = "https://www.oracle.com";
export const URL_USABILITY_TEST = 'https://1.1.1.1';
export const URL_LATENCY_TEST = 'https://1.1.1.1';
export const URL_IP_TEST = 'https://one.one.one.one/cdn-cgi/trace';
export const URL_IPV4_TEST = 'https://1.1.1.1/cdn-cgi/trace';
export const URL_IPV6_TEST = 'https://[2606:4700:4700::1111]:443/cdn-cgi/trace';

export enum ToastType {
	INFO = 'info',
	SUCCESS = 'success',
	ERROR = 'error',
	WARNING = 'warning'
}

export enum TestType {
	USABLITY = 'usability',
	LATENCY = 'latency',
	IP = 'ip',
	IPV4 = 'ipv4',
	IPV6 = 'ipv6'
}
