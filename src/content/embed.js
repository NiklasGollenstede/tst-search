(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/messages': messages,
	'fetch!./form.html': form_html,
}) => {

document.documentElement.classList.toggle('dark-theme', global.matchMedia('(prefers-color-scheme: dark)').matches);

document.body.insertAdjacentHTML('beforeend', form_html);

const names = [ 'term', 'matchCase', 'wholeWord', 'regExp', ];

const inputs = Object.fromEntries(names.map(name => [ name, document.getElementById(name), ]));
function value(input) { return input.type === 'checkbox' ? input.checked : input.value; }

async function onChange() {
	const form = Object.fromEntries(names.map(name => [ name, value(inputs[name]), ]));
	console.info('TST Search: searching for:', form);
	const matches = (await messages.request('onSubmit', form));
	void matches; // could display this somewhere
}

Object.values(inputs).forEach(_=>_.addEventListener('change', onChange));

document.addEventListener('keydown', event => {
	switch (event.code) {
		case 'Escape': {
			event.target.value = ''; onChange();
		} break;
	}
});

const options = (await messages.request('getOptions'));
names.slice(1).forEach(name => { inputs[name].checked = options[name]; });
inputs.term.placeholder = options.placeholder;
if (options.darkTheme != null) {
	document.documentElement.classList.toggle('dark-theme', options.darkTheme);
} else {
	global.matchMedia('(prefers-color-scheme: dark)').onchange = ({ matches, }) =>
	document.documentElement.classList.toggle('dark-theme', matches);
}

}); })(this);
