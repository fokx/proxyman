import { type Socket } from '@sveltejs/kit';
// https://github.com/sveltejs/kit/pull/12973
export const socket: Socket = {
	open(peer) {
		peer.subscribe('all-proxies');
		peer.subscribe('current-proxy');
	},

	message(peer, message) {
		//... handle socket message
	},

	close(peer, event) {
		//... handle socket close
	},

	error(peer, error) {
		//... handle socket error
	}
};
