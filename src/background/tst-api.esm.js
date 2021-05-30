// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Boilerplate code to interact with the *Tree Style Tabs* extension.
 * @param {object}           options                 Options, see below:
 * @param {() => object}     options.getManifest     Function returning the (updated) registration manifest. Called whenever `.register()` is called (automatically or explicitly).
 * @param {string[]=}        options.methods         Optional. TST functions to make available in `.methods`, as the message `.type`s to send to TST.
 *                                                   Names `.methods` will see the same transformation as the `dataset` properties in HTML.
 * @param {Record<string, (params: object) => any|Promise>=}
 *                           options.events          Optional. Handlers for events to subscribe to, where the keys are the `.type`s
 *                                                   of the inbound messages, and the `params` argument is the received message.
 * @param {(reason: any) => void=}
 *                           options.onError         Optional. Handler for non-critical errors.
 * @param {boolean=}         options.debug           Optional. Whether to print on messages to and from TST. This is copied to the return object and can be modified there.
 * @returns {{
 *     register: () => Promise<void>,
 *     unregister: () => Promise<void>,
 *     isRegistered: boolean,
 *     methods: Record<string, (params: object) => Promise<any>>,
 *     debug: boolean,
 * }}                        Object of:
 *                            * `register`: Must be called to initially (usually once after the installation) to register the current extension with TST, for which TST must already be loaded (which should usually be the case when a user installs an extension to TST, but there should probably be an UI option to repeat the initial registration).
 *                              Depending on the manifest options, the initial registration may trigger user interaction from TST.
 *                              Calling this again while `.getManifest()` returns the same JSON is a noop, sending a different manifest updates the registration (i.e. `.register()` is idempotent).
 *                              Once initially registered, the registration will be automatic whenever TST (re)starts after this extension, but `register()` must be called explicitly if this extension (re)starts after TST. Usually it is best to just call this when the current extension loads, and ignore the return status.
 *                           * `unregister`: Persistently unregister this extension from TST.
 *                           * `methods`: For every method name passed in, a function that sends a message calling that method. Parameters are those expected my TST, minus the `.type`.
 *                           * `debug`: Updatable copy of the `.debug` parameter.
 */
export default function tstAPI({ getManifest, methods = [ ], events = { __proto__: null, }, onError = console.error, debug = false, }) {
	const TST_ID = 'treestyletab@piro.sakura.ne.jp';
	const ownName = browser.runtime.getManifest().name;

	async function register() {
		const tstManifest = { listeningTypes: [ ...Object.keys(events), 'wait-for-shutdown', ], ...getManifest(), };
		API.debug && console.info(ownName +': registering with TST ...', tstManifest);
		(await TST.registerSelf(tstManifest));
		API.isRegistered = true;
	}
	async function unregister() {
		(await TST.unregisterSelf());
		API.isRegistered = false;
	}

	const TST = Object.fromEntries([
		'register-self', 'unregister-self', ...methods,
	].map(name => [
		name.replace(/-([a-z])/g, (_, l) => l.toUpperCase()),
		(options) => {
			API.debug && console.info(ownName +': sendMessageExternal', TST_ID, { ...options, type: name, });
			return browser.runtime.sendMessage(TST_ID, { ...options, type: name, }); // It would be nice if connection errors were distinguishable from errors on TST's side ...
		},
	]));

	async function onMessageExternal(message, sender) { {
		if (sender.id !== TST_ID) { return false; }
		API.debug && console.info(ownName +': onMessageExternal', ...arguments);
	} try { switch (message.type) {
		case 'ready': register().catch(onError); events.ready && (await events.ready(message)); break;
		case 'wait-for-shutdown': await new Promise(resolve => {
			window.addEventListener('beforeunload', () => resolve());
		}); break;
		default: (await events[message.type](message));
	} } catch (error) { onError(error); } {
		return true; // indicate to TST that the event was handled
	} }
	browser.runtime.onMessageExternal.addListener(onMessageExternal);

	const API = { register, unregister, isRegistered: false, methods: TST, debug, }; return API;
}
