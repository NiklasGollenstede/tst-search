(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'module!node_modules/web-ext-utils/browser/messages': messages,
	'fetch!./form.html': form_html,
	module,
}) => {

/**
 * This script is loaded as the main module in the empty sidebar `subPanel` (see `./embed.html`),
 * where it executes `render` on the current window, and subscribes to changes of the panel options.
 * Additionally, it is loaded once in the in the background, where `render` is called (repetitively) from `../views/panel`.
 */

const darkPref = global.matchMedia('(prefers-color-scheme: dark)');
const inputNames = [ 'term', 'matchCase', 'wholeWord', 'regExp', ];
function value(/**@type{HTMLInputElement}*/input) { return input.type === 'checkbox' ? input.checked : input.value; }

/**@type{Await<typeof import('../background/index.esm.js').default>['RPC']}*/ const RPC = global.require.cache['module!background/index']?.exports.RPC || Object.fromEntries([ 'doSearch', 'focusActiveTab', 'getOptions', 'awaitOptions', 'getTerm', ].map(name => [ name, (...args) => /**@type{Promise<any>}*/(messages.request(name, ...args)), ]));

const dom = global.document.createElement('div');
dom.insertAdjacentHTML('beforeend', form_html);

/** @param {Window} window */
async function render(window, {
	windowId = -1, destructive = false, initialTerm = '',
} = { }) { const { document, } = window;

	document.documentElement.classList.toggle('dark-theme', darkPref.matches);
	document.body.append(...(destructive ? dom : dom.cloneNode(true)).childNodes);

	const matchIndex = document.getElementById('matchIndex');
	const inputs = Object.fromEntries(inputNames.map(name => [ name, /**@type{HTMLInputElement}*/(document.getElementById(name)), ]));
	initialTerm && (inputs.term.value = initialTerm);

	async function doSearch(options = { }) {
		const form = { ...Object.fromEntries(inputNames.map(name => [ name, value(inputs[name]), ])), windowId, ...options, };
		console.info('TST Search: searching for:', form);
		const result = (await RPC.doSearch(form));
		matchIndex.textContent = result.failed ? '??' : result.cleared ? '' : result.index >= 0 ? ((result.index + 1) +' / '+ result.matches) : (result.matches || 'none') +'';
		document.documentElement.style.setProperty('--count-width', matchIndex.clientWidth +'px');
	}

	inputs.term.addEventListener('focus', () => doSearch({ cached: false, }));
	inputs.term.addEventListener('input', () => doSearch({ cached: true, }));
	Object.values(inputs).slice(1).forEach(_=>_.addEventListener('change', () => doSearch({ cached: true, })));
	Object.values(inputs).slice(1).forEach(_=>_.labels[0].addEventListener('mousedown', _=>_.preventDefault())); // prevent textbox from loosing focus
	document.getElementById('clearTerm').addEventListener('click', () => {
		inputs.term.value = ''; doSearch();
	});

	document.addEventListener('keydown', event => {
		switch (event.code) {
			case 'Escape': {
				inputs.term.value = ''; doSearch();
			} break;
			case 'Enter': { if (event.ctrlKey) {
				RPC.focusActiveTab().catch(console.error);
			} else {
				doSearch({ cached: true, seek: !event.shiftKey, });
			} } break;
		}
	});

	function applyOptions(options) {
		inputNames.slice(1).forEach(name => { inputs[name].checked = options[name]; });
		inputs.term.placeholder = options.placeholder;
		document.documentElement.classList.toggle('hide-clear', options.hideClear);
		document.documentElement.classList.toggle('hide-count', options.hideCount);
		document.documentElement.classList.toggle('hide-flags', options.hideFlags);
		if (options.darkTheme != null) {
			document.documentElement.classList.toggle('dark-theme', options.darkTheme);
			darkPref.onchange = null;
		} else {
			document.documentElement.classList.toggle('dark-theme', darkPref.matches);
			darkPref.onchange = ({ matches, }) =>
			document.documentElement.classList.toggle('dark-theme', matches);
		}
		document.documentElement.style.setProperty('--count-width', matchIndex.clientWidth +'px');
	}
	applyOptions((await RPC.getOptions()));

	return { doSearch, applyOptions, };
}

if (module === global.require.main) { try {
	const windowId = +(new global.URL(global.location.href).searchParams.get('tst-windowId') ?? -1); // this requires piroor/treestyletab#2899
	const initialTerm = windowId === -1 ? '' : (await RPC.getTerm({ windowId, }));
	const { applyOptions, } = (await render(global.window, { destructive: true, windowId, initialTerm, }));
	while (true) { applyOptions((await RPC.awaitOptions())); } // this is a bit racy
} catch (error) { console.error(error);	 } }
return render;

}); })(this);
