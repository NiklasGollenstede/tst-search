(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/messages': messages,
	'fetch!./form.html': form_html,
}) => {

const darkPref = global.matchMedia('(prefers-color-scheme: dark)');
document.documentElement.classList.toggle('dark-theme', darkPref.matches);

document.body.insertAdjacentHTML('beforeend', form_html);

const matchIndex = document.getElementById('matchIndex');
const names = [ 'term', 'matchCase', 'wholeWord', 'regExp', ];
const inputs = Object.fromEntries(names.map(name => [ name, document.getElementById(name), ]));
/**@type{(value: string) => string|boolean}*/function value(input) { return input.type === 'checkbox' ? input.checked : input.value; }

async function doSearch(options = { }) {
	const form = { ...Object.fromEntries(names.map(name => [ name, value(inputs[name]), ])), ...options, };
	console.info('TST Search: searching for:', form);
	const result = (await messages.request('doSearch', form));
	matchIndex.textContent = result.failed ? '??' : result.cleared ? '' : result.index >= 0 ? ((result.index + 1) +' / '+ result.matches) : result.matches || 'none';
	document.documentElement.style.setProperty('--count-width', matchIndex.clientWidth +'px');
}

inputs.term.addEventListener('focus', () => doSearch({ cached: false, }));
inputs.term.addEventListener('input', () => doSearch({ cached: true, }));
Object.values(inputs).slice(1).forEach(_=>_.addEventListener('change', () => doSearch({ cached: true, })));
Object.values(inputs).slice(1).forEach(_=>_.labels[0].addEventListener('mousedown', _=>_.preventDefault())); // prevent textbox from loosing focus

document.addEventListener('keydown', event => {
	switch (event.code) {
		case 'Escape': {
			inputs.term.value = ''; doSearch();
		} break;
		case 'Enter': { if (event.ctrlKey) {
			messages.request('focusActiveTab').catch(console.error);
		} else {
			doSearch({ cached: true, seek: !event.shiftKey, });
		} } break;
	}
});
document.getElementById('clearTerm').addEventListener('click', () => {
	inputs.term.value = ''; doSearch();
});


let options = (await messages.request('getOptions')); do {
	names.slice(1).forEach(name => { inputs[name].checked = options[name]; });
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
} while ((options = (await messages.request('awaitOptions'))));

}); })(this);
