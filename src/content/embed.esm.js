/**
 * This script is loaded as the main module in the empty sidebar `subPanel` (see `./embed.html`),
 * where it executes `render` on the current window, and subscribes to changes of the panel options or search term.
 */

import render from './form.esm.js';

import Browser from 'web-ext-utils/browser/index.esm.js';
import Port, { web_ext_Port, } from 'multiport/index.esm.js';

const port = new Port(Browser.Runtime.connect(), web_ext_Port);


/**@type{Await<typeof import('../background/index.esm.js').default>['RPC']}*/ const RPC = globalThis.require?.cache['module!background/index']?.exports.RPC || Object.fromEntries([ 'doSearch', 'startSearch', 'stopSearch', 'focusActiveTab', 'getOptions', 'onOptions', 'getTerm', 'onSearched', ].map(name => [ name, (...args) => /**@type{Promise<any>}*/(port.request(null, name, ...args)), ]));

(async () => {
	const windowId = +(new globalThis.URL(globalThis.location.href).searchParams.get('windowId') ?? -1);

	const initialTerm = windowId === -1 ? '' : (await RPC.onSearched({ windowId, }, result => { !inputs.term.matches(':focus') && setResult(result); })).term;

	const { inputs, setResult, applyOptions, } = (await render(window, { RPC, destructive: true, windowId, initialTerm, }));

	applyOptions((await RPC.onOptions(applyOptions)));

})().catch(error => { console.error(error);	});
