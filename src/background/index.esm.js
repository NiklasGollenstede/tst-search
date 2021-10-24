// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

import tstApi from './tst-api.esm.js';
import { updateCommand, debounce, } from './util.esm.js';
import Browser from 'web-ext-utils/browser/index.esm.js';
const { manifest, Commands, BrowserAction, Runtime, Tabs, Windows, } = Browser;
import notify from 'web-ext-utils/utils/notify.esm.js';
import Port, { web_ext_Port, } from 'multiport/index.esm.js';
import Events, { setEvent, } from 'web-ext-event'; void Events;
import options from '../common/options.esm.js';

if (false) { /* `define`ed dependencies, for static tracking as `import` dependencies */ // eslint-disable-line
	// @ts-ignore
	import('web-ext-utils/loader/views.js');
}
// Can't be proted to ESM yet: https://github.com/mozilla/addons-linter/issues/3741
let Views; globalThis.require.async('node_modules/web-ext-utils/loader/views').then(exp => (Views = exp));

let debug = false; options.debug.whenChange(([ value, ]) => { debug = value; });


/// setup of/with TST

const onTstError = console.error.bind(console, 'TST error');
const TST = tstApi({
	getManifest() { return {
		name: manifest.name,
		icons: manifest.icons,
		style: [ 'miss', 'child', 'hit', 'active', 'custom', ].map(
			name => options.result.children[name].children.styles.children.map(style => { try {
				const values = Array.isArray(style.value) ? style.value : [ style.value, ];
				return typeof style.model.extra.get === 'function' ? style.model.extra.get(...values) : values[0] ? style.model.extra.value : '';
			} catch (error) { console.error(error); return ''; } }).join('\n')
		).join('\n')
		+'\n'+ options.advanced.children.hideHeader.value
		+'\n'+ String.raw`
			:root.right .tab.tst-search\:searching:not(.pinned)::before,
			:root.left  .tab.tst-search\:searching:not(.pinned)::after {
				content: attr(data-tab-id); display: flex;
				background: var(--tab-surface); color: var(--tab-text); border-top: 1px solid var(--tab-border);
				justify-content: center; align-items: center;
			}
			:root.right .tab.tst-search\:searching:not(.pinned)::before { padding: 0 0px 0 5px; }
			:root.left  .tab.tst-search\:searching:not(.pinned)::after  { padding: 0 5px 0 0px; }
			tab-item { flex-direction: row; }
			tab-item-substance { flex-grow: 1; position: static; }
			:root.right .contextual-identity-marker { position: absolute; left:  0px; }
			:root.left  .contextual-identity-marker { position: absolute; right: 0px; }
		`,
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
		'expand-tree',
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
 * @property {boolean} active
 * @property {boolean} hidden
 *
 * @property {Tab[]} children
 * @property {number} parent
 * @property {number} indent
 * @property {number[]} ancestorTabIds
 * @property {('collapsed'|'subtree-collapsed'|'locked-collapsed'|'group-tab')[]} states
 */


/// extension logic

const classes = {
	matching: [ 'tst-search:matching', ],
	hasChild: [ 'tst-search:child-matching', ],
	hidden: /**@type{string[]}*/([ ]),
	failed: [ 'tst-search:not-matching', ],
	active: [ 'tst-search:active', ],
	searching: [ 'tst-search:searching', ],
};
let cache = /**@type{{ tabs: Tab[] & { byId: Map<number, Tab>, all: Tab[], }, windowId: number, } | null}*/(null);
const queueClearCache = debounce(() => { cache = null; }, 30e3);

/** @typedef {{
    tabId: number;
    result: SearchResult;
    onSearched: Events.Event<[SearchResult]>;
    fireSearched: Events.EventTrigger<[SearchResult]>;
}} WindowState */

/** State of the search in each window. */
const States = {
	// note: cleaning up the states is probably not worth it
	data: /**@type{Record<number, WindowState>}*/({ __proto__: null, }),
	new(/**@type{number}*/windowId) {
		const state = /**@type{WindowState}*/({
			tabId: -1, result: { windowId, inputTerm: '', matches: 0, cleared: true, }, onSearched: null, fireSearched: null,
		}); state.fireSearched = setEvent(state, 'onSearched');
		return state;
	},
	get(/**@type{number}*/windowId) { return this.data[windowId] || (this.data[windowId] = this.new(windowId)); },
	set(/**@type{number}*/windowId, /**@type{Partial<Omit<WindowState, 'onSearched'|'fireSearched'>>}*/state) {
		const base = this.get(windowId); Object.assign(base, state);
		state.result && base.fireSearched([ base.result, ]); return base;
	},
};


/** @typedef { { windowId: number, inputTerm: string, matches: number, } & (
 *       { index:  number,    cleared?: undefined, failed?: undefined, }
 *     | { index?: undefined, cleared:  true,      failed?: undefined, }
 *     | { index?: undefined, cleared?: undefined, failed:  true, }
 * ) } SearchResult */

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
 * @returns {Promise<SearchResult>}             The number of search `matches`, plus either:
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
		TST.methods.removeTabState({ tabs: '*', state: [ ].concat(...Object.values(classes).slice(0, -1/*searching*/)), }).catch(onTstError);
		return States.set(windowId, { tabId: -1, result: { windowId, inputTerm: '', matches: 0, cleared: true, }, }).result;
	} term += ''; const inputTerm = term;

	if (term.length > 150) {
		throw new Error(`Search term is ${term.length} letters. This is likely a mistake, please shorten to 150 letters.`);
	}

	// pick tab properties to search
	const fields = fieldsDefault;
	if (options.search.children.searchByTabIds.value[0] && (/^\s*\d+\s*$/).test(term)) { fields.splice(0, Infinity, 'id'); }
	else if (fieldsPrefix) {
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
		if (cached && cache && States.get(windowId).result.inputTerm) { notify.warn('Invalid RegExp', error); return States.get(windowId).result; } throw error;
	} } else {
		const _map = matchCase ? _=>_ :_=>_.toLowerCase();
		const map = wholeWord ? _=> ' '+_map(_)+' ' :_=>_map(_); // TODO: spaces are not the only word boundaries ...
		const terms = options.search.children.matchKeywords.value ? term.trim().split(/[ ]+/).map(map) : [ map(term.trim()), ];
		matches = tab => fields.some(key => { const value = map(toString(tab[key])); return terms.every(term => value.includes(term)); });
	}
	function toString(/**@type{unknown}*/prop) { return prop == null ? '' : typeof prop === 'string' ? prop : JSON.stringify(prop); }

	// get tabs
	const tabs = (await (async () => {
		if (cached && cache && cache.windowId === windowId) {
			return cache.tabs;
		}
		const [ nativeTabs, treeItems, ] = await Promise.all([
			Tabs.query({ windowId, }),
			TST.methods.getTree({ windowId, }),
		]);
		const byId = new Map; const all = /**@type{Tab[]}*/([ ]);
		const mergeTabs = (treeItem, parent) => {
			treeItem.children = treeItem.children.map(tab => mergeTabs(tab, treeItem.id));
			const tab = { ...nativeTabs[treeItem.index], ...treeItem, parent, };
			byId.set(tab.id, tab); all.push(tab); return tab;
		};
		const tabs = /**@type{typeof cache.tabs}*/(treeItems.map(tab => mergeTabs(tab, -1))); tabs.byId = byId; tabs.all = all;
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
		if (tab.hidden) { result.hidden.add(tab); return false; }
		let ret = false; {
			if (matches(tab)) { result.matching.add(tab); ret = true; }
			if (search(tab.children)) { result.hasChild.add(tab); ret = true; }
		} !ret && result.failed.add(tab); return ret;
	}).some(_=>_); })(tabs);

	// determine active tab
	const matching = Array.from(result.matching);
	const state = States.get(windowId);
	if (matching.length === 0) { state.tabId = -1; }
	else if (!tabs.byId.get(state.tabId)) { state.tabId = matching[0].id; } // prev. active tab is gone
	else if (!result.matching.has(tabs.byId.get(state.tabId))) { // prev. active tab is no longer a valid result
		const prev = tabs.byId.get(state.tabId);
		state.tabId = (matching.find(tab => tab.index > prev.index) || matching[0]).id;
	} // keep pre. active tab
	if (typeof seek === 'boolean') { if (matching.length > 1) {
		const current = matching.indexOf(tabs.byId.get(state.tabId));
		if (seek) { state.tabId = matching[current + 1 < matching.length ? current + 1 : 0].id; }
		else      { state.tabId = matching[current - 1 >= 0              ? current - 1 : matching.length - 1].id; }
	} }
	const active = tabs.byId.get(state.tabId);
//	const parents = (/**@return{Tab[]}*/function collect(self) {
//		const parent = tabs.byId.get(self.id); return parent ? [ ...collect(parent), self, ] : [ self, ];
//	})(active);

	const collapsed = !active || !options.search.children.revealOnFocus.value || !active.states.includes('collapsed') ? [ ]
	: active.ancestorTabIds.map(id => tabs.byId.get(id)).filter(tab => tab.states.includes('subtree-collapsed'));

	const scrollTo = !active
	? options.search.children.scrollActiveTab.value ? tabs.all.find(_=>_.active).id : -1
	: typeof seek === 'boolean' || options.search.children.scrollActiveTab.value
	? options.search.children.revealOnFocus.value || !active.states.includes('collapsed') ? active.id
	: active.ancestorTabIds.find(id => !tabs.byId.get(id).states.includes('collapsed'))
	: -1;

	// apply tab states
	(await Promise.all([
		...Object.keys(classes).map(state => !classes[state].length ? [ ] : [
			TST.methods.removeTabState({ tabs: (!result[state]?.size ? tabs.all : tabs.all.filter(tab => !result[state].has(tab))).map(_=>_.id), state: classes[state], }),
			result[state]?.size && TST.methods.addTabState({ tabs: Array.from(result[state], _=>_.id), state: classes[state], }),
		]).flat(1),
		(async () => {
			collapsed.length && (await Promise.all(collapsed.map(tab => TST.methods.expandTree({ tab: tab.id, }))));
			scrollTo >= 0 && (await TST.methods.scroll({ tab: scrollTo, }));
		})().catch(onTstError),
		state.tabId >= 0 && TST.methods.addTabState({ tabs: [ state.tabId, ], state: classes.active, }),
	]));

	const finalResult = { windowId, inputTerm, matches: result.matching.size, index: matching.indexOf(tabs.byId.get(state.tabId)), };
	States.set(windowId, { result: finalResult, }); return finalResult;

} catch (error) { notify.error('Search failed!', error); return { windowId, inputTerm: '', matches: 0, failed: true, }; } }


async function startSearch() { options.search.children.searchByTabIds.value[1] &&    TST.methods.addTabState({ tabs: '*', state: classes.searching, }).catch(onTstError); }
async function stopSearch()  { options.search.children.searchByTabIds.value[1] && TST.methods.removeTabState({ tabs: '*', state: classes.searching, }).catch(onTstError); }


async function focusActiveTab({
	windowId = this?.windowId || -1, // eslint-disable-line no-invalid-this
} = { }) { try {
	windowId != null && windowId !== -1 || (windowId = (await Windows.getCurrent()).id);
	debug && console.info('TST Search: focusActiveTab', windowId, this, ...arguments); // eslint-disable-line no-invalid-this
	const tabId = States.get(windowId).tabId; if (tabId >= 0) {
		(await Tabs.update(tabId, { active: true, }));
		Views.getViews().find(_=>_.name === 'panel')?.view?.close();
		options.search.children.clearAfterFocus.value && (await doSearch({ windowId, term: '', }));
	} return tabId;
} catch (error) { notify.error('Tab Focus Failed', error); } return null; }


async function getTerm({
	windowId = this?.windowId || -1, // eslint-disable-line no-invalid-this
} = { }) { try {
	windowId != null && windowId !== -1 || (windowId = (await Windows.getCurrent()).id);
	debug && console.info('TST Search: getTerm', windowId, this, ...arguments); // eslint-disable-line no-invalid-this
	return States.get(windowId).result.inputTerm || '';
} catch (error) { notify.error('Tab Focus Failed', error); } return null; }

async function onSearched({
	windowId = this?.windowId || -1, // eslint-disable-line no-invalid-this
} = { },/**@type{Events.Listener<[ SearchResult, ]>}*/listener) {
	windowId != null && windowId !== -1 || (windowId = (await Windows.getCurrent()).id);
	const state = States.get(windowId);
	state.onSearched(listener, { owner: 'onDisconnect' in this ? this : null, }); // eslint-disable-line no-invalid-this
	return state.result;
}


const { getOptions, onOptions, } = (() => { // let panel instances know about `options.panel.children.*.value`
	function getOptions() { return Object.fromEntries(
		Object.entries(options.panel.children).map(pair => [ pair[0], (/**@type{any}*/(pair[1]).value), ])
	); }
	async function onOptions(/**@type{Events.Listener<[ Record<string, any>, ]>}*/listener) {
		on.options(listener, { owner: 'onDisconnect' in this ? this : null, }); // eslint-disable-line no-invalid-this
		return getOptions();
	}
	const on = { options: /**@type{Events.Event<[ Record<string, any>, ]>}*/(null), };
	const fireOptions = setEvent(on, 'options');
	options.panel.onAnyChange(() => fireOptions([ getOptions(), ]));
	return { async getOptions() { return getOptions(); }, onOptions, };
})();


async function getSingleWindowId() { const windows = (await Windows.getAll()); return windows.length === 1 ? windows[0].id : -1; }


const RPC = { doSearch, startSearch, stopSearch, focusActiveTab, getTerm, onSearched, getOptions, onOptions, getSingleWindowId, };
Runtime.onConnect.addListener(port => { new Port(port, web_ext_Port).addHandlers('', RPC); });

let lastGlobalFocus = 0;
Commands.onCommand.addListener(async function onCommand(command) { try { {
	debug && console.info('TST: onCommand', command);
} switch (command.replace(/_\d$/, '')) {
	case 'globalFocusKey': {
		// can't focus sidebar, so open/focus the browserAction popup
		const panel = /**@type{Window}*/(Views.getViews().find(_=>_.name === 'panel')?.view);
		const input = /**@type{HTMLInputElement}*/(panel?.document.querySelector('#term'));
		const prev = lastGlobalFocus; lastGlobalFocus = Date.now();
		if (lastGlobalFocus - prev < 300) { // double tap
			panel?.close(); (await doSearch({ term: '', }));
		} else if (input) {
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


Object.assign(globalThis, { // for debugging
	options,
	classes, cache, States,
	TST, RPC,
	doSearch, focusActiveTab,
	Browser,
});

export default { TST, RPC, };
