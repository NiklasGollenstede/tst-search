/**
 * This script is loaded as the main module in the empty sidebar `subPanel` (see `./embed.html`),
 * where it executes `renderForm` on the current window, and subscribes to changes of the panel options or search term.
 */

import renderForm from './form.esm.js';

import Browser from 'web-ext-utils/browser/index.esm.js';
import Port, { web_ext_Port, } from 'multiport/index.esm.js';

const port = new Port(Browser.Runtime.connect(), web_ext_Port);


/**@type{Await<typeof import('../background/index.esm.js').default>['RPC']}*/ const RPC = globalThis.require?.cache['module!background/index']?.exports.RPC || Object.fromEntries([ 'doSearch', 'startSearch', 'stopSearch', 'focusActiveTab', 'getOptions', 'onOptions', 'getTerm', 'onSearched', 'getSingleWindowId', ].map(name => [ name, (...args) => port.request(null, name, ...args), ]));

(async () => {
	const windowId = +(new globalThis.URL(globalThis.location.href).searchParams.get('windowId') ?? (await RPC.getSingleWindowId()));

	async function onWindowId(/**@type{number}*/windowId) { return (await RPC.onSearched({ windowId, }, result => { !inputs.term.matches(':focus') && setResult(result); })).inputTerm; }

	const initialTerm = windowId === -1 ? '' /* `onWindowId` gets called by the form after the first search */ : (await onWindowId(windowId));

	const { inputs, setResult, applyOptions, } = (await renderForm(window, { RPC, destructive: true, windowId, initialTerm, onWindowId: windowId === -1 ? onWindowId : null, }));

	applyOptions((await RPC.onOptions(applyOptions)));

})().catch(error => { console.error(error);	});
