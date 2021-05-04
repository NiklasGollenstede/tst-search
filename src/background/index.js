(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, Runtime, Windows, Tabs, },
	'node_modules/web-ext-utils/browser/messages': messages,
	'node_modules/web-ext-utils/utils/notify': notify,
	'node_modules/es6lib/functional': { debounce, },
	'common/options': options,
	require,
}) => {
let debug; options.debug.whenChange(([ value, ]) => { debug = value; });

/// Tree Style Tabs boilerplate
const TST_ID = 'treestyletab@piro.sakura.ne.jp';
const TST = Object.fromEntries([
	'register-self',
	'get-tree',
	'scroll',
	'remove-tab-state', 'add-tab-state',
].map(name => [
	name.replace(/-([a-z])/g, (_, l) => l.toUpperCase()),
	(options) => {
		debug && console.info('TST Search: sendMessageExternal', TST_ID, { ...options, type: name, });
		return Runtime.sendMessage(TST_ID, { ...options, type: name, });
	},
]));
const onError = console.error.bind(console, 'TST error');
async function register() {
	debug && console.info('TST Search: registering with TST ...');
	(await TST.registerSelf({
		name: manifest.name,
		icons: manifest.icons,
		listeningTypes: [ 'wait-for-shutdown', ],
		style: [ 'hit', 'active', 'child', 'miss', 'custom', ].map(
			name => Object.values(options.result.children[name].children.styles.children).map(_=>_.value).join('\n')
		).join('\n') +'\n'+ options.advanced.children.hideHeader.value,
		subPanel: {
			title: manifest.name,
			url: Runtime.getURL('src/content/embed.html'),
			initialHeight: '35px', fixedHeight: '35px',
		},
	}));
}
function unregister() { Runtime.sendMessage(TST_ID, { type: 'unregister-self', }).catch(onError); }
async function onMessageExternal(message, sender) { {
	debug && console.info('TST Search: onMessageExternal', ...arguments);
	if (sender.id !== TST_ID) { return false; }
} try { switch (message.type) {
	case 'ready': register().catch(onError); break;
	case 'wait-for-shutdown': await new Promise(resolve => {
		global.addEventListener('beforeunload', resolve);
	}); break;
} } catch (error) { console.error('TST error', error); } {
	return true; // indicate to TST that the event was handled
} }

// the very first register() has to happen while TST is already running for the initial registration to work
Runtime.onMessageExternal.addListener(onMessageExternal);
register().catch(() => null); // may very well not be ready yet
options.result.onAnyChange(() => register().catch(notify.error));


/// extension logic

const classes = {
	matching: [ 'tst-search:matching', ],
	hasChild: [ 'tst-search:child-matching', ],
	hidden: [ ],
	failed: [ 'tst-search:not-matching', ],
	active: [ 'tst-search:active', ],
};
let cache = null; const queueClearCache = debounce(() => { cache = null; }, 30e3);
const actives = { /* [windowId]: { term: '', tabId: 0, }, */ };

/**
 * Does the actual search on the tabs in a window. Called from the panel via messaging.
 * @param {string}   options.term          The term to search for.
 * @param {boolean}  options.matchCase     See `../common.options.js#model.panel.children.matchCase.input.suffix`.
 * @param {boolean}  options.wholeWord     See `../common.options.js#model.panel.children.wholeWord.input.suffix`.
 * @param {boolean}  options.regExp        See `../common.options.js#model.panel.children.regExp.input.suffix`.
 * @param {boolean}  options.fieldsPrefix  See `../common.options.js#model.search.children.fieldsPrefix.description`.
 * @param {number?}  options.windowId      Optional. The ID of the window to search.
 *                                         Defaults to `this?.windowId` (which may be set to the message `sender`) or `Windows.getCurrent().id`.
 * @returns
 */
async function onSubmit({
	term, matchCase, wholeWord, regExp,
	cached, seek,
	fieldsPrefix = options.search.children.fieldsPrefix.value[0],
	windowId = this?.windowId, // eslint-disable-line no-invalid-this
} = { }) { try {
	windowId || (windowId = (await Windows.getCurrent()).id);
	debug && console.info('TST Search: onSubmit', windowId, this, ...arguments); // eslint-disable-line no-invalid-this

	// save search flags
	Object.entries({ matchCase, wholeWord, regExp, }).forEach(([ name, value, ]) => {
		options.panel.children[name].value = !!value;
	});

	// clear previous search on empty term
	if (!term) {
		TST.removeTabState({ tabs: '*', state: [ ].concat(...Object.values(classes)), }).catch(onError);
		cache = null; delete actives[windowId];
		return { matches: 0, cleared: true, };
	}

	// pick tab properties to search
	const fields = options.search.children.fieldsPrefix.value[1].split(' ');
	if (fieldsPrefix) {
		const match = (/^(\w+(?:[|]\w+)*): ?(.*)/).exec(term);
		if (match) { fields.splice(0, Infinity, ...match[1].split('|')); term = match[2]; }
	}

	// decide how to search tab properties
	let matches; if (regExp) { try {
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
			TST.getTree({ windowId, }),
		]);
		const byId = new Map;
		const mergeTabs = (treeItem, parent) => {
			treeItem.children = treeItem.children.map(tab => mergeTabs(tab, treeItem.id));
			const tab = { ...nativeTabs[treeItem.index], ...treeItem, parent, };
			byId.set(tab.id, tab); return tab;
		};
		const tabs = treeItems.map(tab => mergeTabs(tab, -1)); tabs.byId = byId;
		cache = { windowId, tabs, }; queueClearCache();
		return tabs;
	})());

	// find search results
	const result = {
		matching: new Set,
		hasChild: new Set,
		hidden: new Set,
		failed: new Set,
	};
	(function search(tabs) { return tabs.map(tab => {
		if (tab.collapsed || tab.hidden) { result.hidden.add(tab); return false; }
		let ret = false; {
			if (matches(tab)) { result.matching.add(tab); ret = true; }
			if (search(tab.children)) { result.hasChild.add(tab); ret = true; }
		} !ret && result.failed.add(tab); return ret;
	}).some(_=>_); })(tabs);

	const matching = Array.from(result.matching);
	const active = actives[windowId] || (actives[windowId] = { });
	if (matching.length === 0) { active.tabId = -1; active.term = term; }
	else if (!tabs.byId.has(active.tabId)) { active.tabId = matching[0].id; active.term = term; }
	else if (result.matching.has(tabs.byId.get(active.tabId))) { void 0; }
	else {
		if (matching.length === 1) { active.tabId = matching[0]; } const prev = tabs.byId.get(active.tabId);
		active.tabId = (matching.find(tab => tab.index > prev.index) || matching[0]).id;
	}
	if (typeof seek === 'boolean') { if (matching.length > 1) {
		const current = matching.indexOf(tabs.byId.get(active.tabId));
		if (seek) { active.tabId = matching[current + 1 < matching.length ? current + 1 : 0].id; }
		else      { active.tabId = matching[current - 1 >= 0              ? current - 1 : matching.length - 1].id; }
	} }

	// apply findings
	(await Promise.all([
		TST.removeTabState({
			tabs: Array.from(tabs.byId.keys()), // Explicitly pass the IDs, to ensure consistent runtime with the other calls. The IDs have either just been queried, or wrer the ones that the classes were applied to.
			state: [ ].concat(...Object.values(classes)),
		}).catch(error => void onError(error)),
		...Object.keys(result).map(
			state => classes[state].length && result[state].size
			&& TST.addTabState({ tabs: Array.from(result[state], _=>_.id), state: classes[state], })
		),
		typeof seek === 'boolean' && active.tabId >= 0 && TST.scroll({ tab: active.tabId, }),
		active.tabId >= 0 && TST.addTabState({ tabs: [ active.tabId, ], state: classes.active, }),
	]));

	return ((cache || { }).result = { matches: result.matching.size, index: matching.indexOf(tabs.byId.get(active.tabId)), });

} catch (error) { notify.error('Search failed!', error); return { matches: 0, failed: true, }; } }
messages.addHandler(onSubmit);


messages.addHandler(async function focusActiveTab({
	windowId = this?.windowId, // eslint-disable-line no-invalid-this
} = { }) { try {
	windowId || (windowId = (await Windows.getCurrent()).id);
	debug && console.info('TST Search: focusActiveTab', windowId, this, ...arguments); // eslint-disable-line no-invalid-this
	const tabId = actives[windowId] && actives[windowId].tabId;
	(await Tabs.update(tabId, { active: true, }));
} catch (error) { notify.error('Tab Focus Failed', error); } });


{ // let panel instances know about `options.panel.children.*.value`
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
	messages.addHandlers({ getOptions, awaitOptions() {
		return new Promise(resolve => callbacks.add(resolve));
	}, });
}


Object.assign(global, { // for debugging
	options,
	TST, register, unregister,
	onSubmit,
	Browser: require('node_modules/web-ext-utils/browser/'),
});

return { TST, register, unregister, };

}); })(this);
