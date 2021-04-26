(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, Runtime, Windows, Tabs, },
	'node_modules/web-ext-utils/browser/messages': messages,
	'node_modules/web-ext-utils/utils/notify': notify,
	'common/options': options,
	require,
}) => {
let debug; options.debug.whenChange(([ value, ]) => { debug = value; });

/// Tree Style Tabs boilerplate
const TST_ID = 'treestyletab@piro.sakura.ne.jp';
const TST = Object.fromEntries([
	'register-self',
	'get-tree',
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
		style: [ 'hit', 'child', 'miss', ].map(
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
	matching: [  'tst-search:matching', ],
	hasChild: [ 'tst-search:child-matching', ],
	hidden: [ ],
	failed: [ 'tst-search:not-matching', ],
};

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
	term, matchCase, wholeWord, regExp, fieldsPrefix = options.search.children.fieldsPrefix.value,
	windowId = this?.windowId, // eslint-disable-line no-invalid-this
}) { try {
	windowId || (windowId = (await Windows.getCurrent()).id);
	console.info('TST Search: onSubmit', windowId, this, ...arguments); // eslint-disable-line no-invalid-this

	// save search flags
	Object.entries({ matchCase, wholeWord, regExp, }).forEach(([ name, value, ]) => {
		options.panel.children[name].value = value;
	});

	// clear previous search on empty term
	if (!term) { TST.removeTabState({ tabs: '*', state: [].concat(Object.values(classes)), }).catch(onError); return -1; }

	// pick tab properties to search
	const fields = [ 'title', 'url', ];
	if (fieldsPrefix) {
		const match = (/^(\w+(?:[|]\w+)*): ?(.*)/).exec(term);
		if (match) { fields.splice(0, Infinity, ...match[1].split('|')); term = match[2]; }
	}

	// decide how to search tab properties
	let matches; if (regExp) {
		if (wholeWord) { term = String.raw`\b(?:${term})\b`; }
		const exp = new RegExp(term, matchCase ? '' : 'i');
		matches = tab => fields.some(key => exp.test(toString(tab[key])));
	} else {
		const _map = matchCase ? _=>_ :_=>_.toLowerCase();
		const map = wholeWord ? _=> ' '+_map(_)+' ' :_=>_map(_);
		term = map(term);
		matches = tab => fields.some(key => map(toString(tab[key])).includes(term));
	}
	function toString(prop) { return prop == null ? '' : typeof prop === 'string' ? prop : JSON.stringify(prop); }

	// get tabs
	const [ nativeTabs, treeItems, ] = await Promise.all([
		Tabs.query({ windowId, }),
		TST.getTree({ window: windowId, }),
	]);
	const mergeTabs = treeItem => {
		treeItem.children = treeItem.children.map(mergeTabs);
		return { ...nativeTabs[treeItem.index], ...treeItem, };
	};
	const tabs = treeItems.map(mergeTabs);

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

	// apply findings
	(await TST.removeTabState({ tabs: '*', state: [].concat(Object.values(classes)), }).catch(error => void onError(error)));
	(await Promise.all(Object.keys(result).map(
		state => classes[state].length && result[state].size
		&& TST.addTabState({ tabs: Array.from(result[state], _=>_.id), state: classes[state], })
	)));

	return result.matching.size;

} catch (error) { notify.error('Search failed!', error); return -2; } }
messages.addHandler(onSubmit);
messages.addHandler(function getOptions() {
	return Object.fromEntries(Object.entries(options.panel.children).map(pair => {
		pair[1] = pair[1].value; return pair;
	}));
});


Object.assign(global, { // for debugging
	options,
	TST, register, unregister,
	onSubmit,
	Browser: require('node_modules/web-ext-utils/browser/'),
});

return { TST, register, unregister, };

}); })(this);
