// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

import tstApi from './tst-api.esm.js';
import { updateCommand, } from './util.esm.js';
import Browser from 'web-ext-utils/browser/index.esm.js';
const { manifest, Commands, BrowserAction, Runtime, Tabs, Windows, } = Browser;
import messages from 'web-ext-utils/browser/messages.esm.js';
import notify from 'web-ext-utils/utils/notify.esm.js';
import options from '../common/options.esm.js';

if (false) { /* `define`ed dependencies, for static tracking as `import` dependencies */ // eslint-disable-line
	// @ts-ignore
	import('web-ext-utils/loader/views.js');
	// @ts-ignore
	import('es6lib/functional.js');
}


export default (/* await would break module deps tracking */ (function(global) { 'use strict'; return /*!break pbq deps tracking!*/(define)(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/loader/views': { getViews, },
	'node_modules/es6lib/functional': { debounce, },
}) => {
let debug = false; options.debug.whenChange(([ value, ]) => { debug = value; });


/// setup of/with TST

const onTstError = console.error.bind(console, 'TST error');
const TST = tstApi({
	getManifest() { return {
		name: manifest.name,
		icons: manifest.icons,
		style: [ 'hit', 'active', 'child', 'miss', 'custom', ].map(
			name => Object.values(options.result.children[name].children.styles.children).map(_=>_.value).join('\n')
		).join('\n') +'\n'+ options.advanced.children.hideHeader.value,
		subPanel: {
			title: manifest.name,
			url: Runtime.getURL('src/content/embed.html'),
			initialHeight: '35px', fixedHeight: '35px',
		},
	}; },
	methods: [
		'get-tree',
		'scroll',
		'remove-tab-state', 'add-tab-state',
	],
	onError: onTstError, debug,
});
Object.defineProperty(TST, 'debug', { get() { return debug; }, });

TST.register().catch(() => null) // may very well not be ready yet
.then(() => TST.isRegistered && TST.methods.removeTabState({ tabs: '*', state: [ ].concat(...Object.values(classes)), }).catch(onTstError));
options.result.onAnyChange(() => TST.register().catch(notify.error));

/**
 * @typedef {object} Tab - Browser Tab (dummy) interface.
 * @property {number} id
 * @property {number} index
 * @property {boolean} hidden
 * @property {boolean} collapsed
 * @property {Tab[]} children
 */


/// extension logic

const classes = {
	matching: [ 'tst-search:matching', ],
	hasChild: [ 'tst-search:child-matching', ],
	hidden: /**@type{string[]}*/([ ]),
	failed: [ 'tst-search:not-matching', ],
	active: [ 'tst-search:active', ],
};
let cache = /**@type{{ tabs: Tab[] & { byId: Map<number, Tab>, }, windowId: number, result?: Await<ReturnType<doSearch>>, } | null}*/(null);
const queueClearCache = /**@type{() => undefined}*/(debounce(() => { cache = null; }, 30e3));
const windowStates = /**@type{Record<number, { tabId: number, term: string, }>}*/({ __proto__: null, });

/**
 * Does the actual search on the tabs in a window. Called from the panel via messaging.
 * @param {object}      options                 Search options. All optional, see below.
 * @param {number=}     options.windowId        Optional. The ID of the window to search.
 *                                              Defaults to `this?.windowId` (which may be set to the message `sender`) or `Windows.getCurrent().id`.
 * @param {string=}     options.term            The term to search for. Empty/falsy clears the search.
 * @param {boolean=}    options.matchCase       See `../common.options.js#model.panel.children.matchCase.input.suffix`.
 * @param {boolean=}    options.wholeWord       See `../common.options.js#model.panel.children.wholeWord.input.suffix`.
 * @param {boolean=}    options.regExp          See `../common.options.js#model.panel.children.regExp.input.suffix`.
 * @param {boolean=}    options.fieldsPrefix    See `../common.options.js#model.search.children.fieldsPrefix.description`.
 * @param {string[]=}   options.fieldsDefault   See `../common.options.js#model.search.children.fieldsPrefix.description`.
 * @param {boolean=}    options.cached          On any search, the fetched tab information and the `.windowId` is stored for a while.
 *                                              If another search with the same `.windowId` and `.cached: true` is made in the meantime,
 *                                              the tab information is reused (to improve performance).
 * @param {boolean=}    options.seek            None empty search results mark one of their tabs as active, applying `classes.active` to it,
 *                                              and making it the target of `focusActiveTab`. The active tab's ID is saved per window,
 *                                              and maintained if it still matches the search, otherwise the next matching tab is selected.
 *                                              Then iff `.seek` is `true` the next next, iff `false` the previous matching tab is activated.
 * @returns { Promise<{ matches: number, } & (
 *       { index:  number,    cleared?: undefined, failed?: undefined, }
 *     | { index?: undefined, cleared:  true,      failed?: undefined, }
 *     | { index?: undefined, cleared?: undefined, failed:  true, }
 * )> } The number of search `matches`, plus either:
 *                                              * if `term` was empty: `cleared: true`;
 *                                              * on search success: the active tab's index (or `-1`);
 *                                              * or on any failure: `failed: true`.
 */
async function doSearch({
	windowId = this?.windowId || -1, // eslint-disable-line no-invalid-this
	term = '', matchCase = false, wholeWord = false, regExp = false,
	fieldsPrefix = !!options.search.children.fieldsPrefix.value?.[0],
	fieldsDefault = options.search.children.fieldsPrefix.value?.[1]?.split?.(' ') || [ 'title', 'url', ],
	cached = false, seek = undefined,
} = { }) { try {
	(windowId != null && windowId !== -1) || (windowId = (await Windows.getCurrent()).id);
	debug && console.info('TST Search: doSearch', windowId, this, ...arguments); // eslint-disable-line no-invalid-this

	// save search flags
	Object.entries({ matchCase, wholeWord, regExp, }).forEach(([ name, value, ]) => {
		options.panel.children[name].value = !!value;
	});

	if (!TST.isRegistered) { try {
		(await TST.register());
	} catch (error) {
		throw new Error('TST is unavailable or does not allow registration');
	} }

	// clear previous search on empty term
	if (!term) {
		TST.methods.removeTabState({ tabs: '*', state: [ ].concat(...Object.values(classes)), }).catch(onTstError);
		cache = null; delete windowStates[windowId];
		return { matches: 0, cleared: true, };
	} term += '';

	// pick tab properties to search
	const fields = fieldsDefault; if (fieldsPrefix) {
		const match = (/^(\w+(?:[|]\w+)*): ?(.*)/).exec(term);
		if (match) { fields.splice(0, Infinity, ...match[1].split('|')); term = match[2]; }
	}

	// decide how to search tab properties
	/**@type{(tab: Tab) => boolean}*/ let matches; if (regExp) { try {
		if (wholeWord) { term = String.raw`\b(?:${term})\b`; }
		const exp = new RegExp(term, matchCase ? '' : 'i');
		matches = tab => fields.some(key => exp.test(toString(tab[key])));
	} catch (error) {
		// on failing regexp while typing, return previous result
		if (cached && cache && cache.result) { notify.warn('Invalid RegExp', error); return cache.result; } throw error;
	} } else {
		const _map = matchCase ? _=>_ :_=>_.toLowerCase();
		const map = wholeWord ? _=> ' '+_map(_)+' ' :_=>_map(_);
		term = map(term);
		matches = tab => fields.some(key => map(toString(tab[key])).includes(term));
	}
	function toString(prop) { return prop == null ? '' : typeof prop === 'string' ? prop : JSON.stringify(prop); }

	// get tabs
	const tabs = (await (async () => {
		if (cached && cache && cache.windowId === windowId) {
			return cache.tabs;
		}
		const [ nativeTabs, treeItems, ] = await Promise.all([
			Tabs.query({ windowId, }),
			TST.methods.getTree({ windowId, }),
		]);
		const byId = new Map;
		const mergeTabs = (treeItem, parent) => {
			treeItem.children = treeItem.children.map(tab => mergeTabs(tab, treeItem.id));
			const tab = { ...nativeTabs[treeItem.index], ...treeItem, parent, };
			byId.set(tab.id, tab); return tab;
		};
		const tabs = /**@type{typeof cache.tabs}*/(treeItems.map(tab => mergeTabs(tab, -1))); tabs.byId = byId;
		cache = { windowId, tabs, }; queueClearCache();
		return tabs;
	})());

	// find search results
	const result = {
		matching: /**@type{Set<Tab>}*/(new Set),
		hasChild: /**@type{Set<Tab>}*/(new Set),
		hidden: /**@type{Set<Tab>}*/(new Set),
		failed: /**@type{Set<Tab>}*/(new Set),
	};
	(function search(/**@type{Tab[]}*/tabs) { return tabs.map(tab => {
		if (tab.collapsed || tab.hidden) { result.hidden.add(tab); return false; }
		let ret = false; {
			if (matches(tab)) { result.matching.add(tab); ret = true; }
			if (search(tab.children)) { result.hasChild.add(tab); ret = true; }
		} !ret && result.failed.add(tab); return ret;
	}).some(_=>_); })(tabs);

	// determine active tab
	const matching = Array.from(result.matching);
	const state = windowStates[windowId] || (windowStates[windowId] = { tabId: -1, term: '', }); state.term = term;
	if (matching.length === 0) { state.tabId = -1; }
	else if (!tabs.byId.get(state.tabId)) { state.tabId = matching[0].id; }
	else if (!result.matching.has(tabs.byId.get(state.tabId))) {
		const prev = tabs.byId.get(state.tabId);
		state.tabId = (matching.find(tab => tab.index > prev.index) || matching[0]).id;
	}
	if (typeof seek === 'boolean') { if (matching.length > 1) {
		const current = matching.indexOf(tabs.byId.get(state.tabId));
		if (seek) { state.tabId = matching[current + 1 < matching.length ? current + 1 : 0].id; }
		else      { state.tabId = matching[current - 1 >= 0              ? current - 1 : matching.length - 1].id; }
	} }

	// apply tab states
	(await Promise.all([
		TST.methods.removeTabState({
			tabs: Array.from(tabs.byId.keys()), // Explicitly pass the IDs, to ensure consistent runtime with the other calls. The IDs have either just been queried, or wrer the ones that the classes were applied to.
			state: [ ].concat(...Object.values(classes)),
		}).catch(onTstError),
		...Object.keys(result).map(
			state => classes[state].length && result[state].size
			&& TST.methods.addTabState({ tabs: Array.from(result[state], _=>_.id), state: classes[state], })
		),
		typeof seek === 'boolean' && state.tabId >= 0 && TST.methods.scroll({ tab: state.tabId, }).catch(onTstError), // This throws (if the target tab is collapsed?). Also, collapsed tabs aren't scrolled to (the parent).
		state.tabId >= 0 && TST.methods.addTabState({ tabs: [ state.tabId, ], state: classes.active, }),
	]));

	return ((cache || /**@type{any}*/({ })).result = { matches: result.matching.size, index: matching.indexOf(tabs.byId.get(state.tabId)), });

} catch (error) { notify.error('Search failed!', error); return { matches: 0, failed: true, }; } }


async function getTerm({
	windowId = this?.windowId || -1, // eslint-disable-line no-invalid-this
} = { }) { try {
	windowId != null && windowId !== -1 || (windowId = (await Windows.getCurrent()).id);
	debug && console.info('TST Search: getTerm', windowId, this, ...arguments); // eslint-disable-line no-invalid-this
	return windowStates[windowId]?.term;
} catch (error) { notify.error('Tab Focus Failed', error); } return null; }


async function focusActiveTab({
	windowId = this?.windowId || -1, // eslint-disable-line no-invalid-this
} = { }) { try {
	windowId != null && windowId !== -1 || (windowId = (await Windows.getCurrent()).id);
	debug && console.info('TST Search: focusActiveTab', windowId, this, ...arguments); // eslint-disable-line no-invalid-this
	const tabId = windowStates[windowId]?.tabId;
	tabId >= 0 && (await Tabs.update(tabId, { active: true, }));
	return tabId;
} catch (error) { notify.error('Tab Focus Failed', error); } return null; }


const { getOptions, awaitOptions, } = (() => { // let panel instances know about `options.panel.children.*.value`
	function getOptions() {
		return Object.fromEntries(Object.entries(options.panel.children).map(pair => {
			pair[1] = pair[1].value; return pair;
		}));
	}
	const callbacks = new Set;
	options.panel.onAnyChange(() => {
		const opts = getOptions();
		callbacks.forEach(_=>_(opts));
		callbacks.clear();
	});
	return { async getOptions() {
		return getOptions();
	}, awaitOptions() {
		return new Promise(resolve => callbacks.add(resolve));
	}, };
})();


const RPC = { doSearch, getTerm, focusActiveTab, getOptions, awaitOptions, };
messages.addHandlers('', RPC);


Commands.onCommand.addListener(async function onCommand(command) { try { {
	debug && console.info('TST: onCommand', command);
} switch (command.replace(/_\d$/, '')) {
	case 'globalFocusKey': {
		// can't focus sidebar, so open/focus the browserAction popup
		const panel = /**@type{Window}*/(getViews().find(_=>_.name === 'panel')?.view);
		const input = /**@type{HTMLInputElement}*/(panel?.document.querySelector('#term'));
		if (input) {
			if (input.matches(':focus')) {
				// can't listen to ESC press, so clear on redundant focus command
				input.value = ''; input.dispatchEvent(new /**@type{any}*/(panel).Event('input'));
			} else {
				panel.close(); (await BrowserAction.openPopup()); // focus
			}
		} else {
			(await BrowserAction.openPopup());
		}
	} break;
} } catch (error) { notify.error('Command Failed', error); } });
options.search.children.globalFocusKey.whenChange(values => updateCommand('globalFocusKey', 1, values));


Object.assign(global, { // for debugging
	options,
	TST, RPC,
	doSearch, focusActiveTab,
	Browser,
});

return { TST, RPC, };

}); })(this || /* global globalThis */ globalThis).ready);
