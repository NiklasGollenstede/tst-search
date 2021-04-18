(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/options/': Options,
	'node_modules/web-ext-utils/browser/storage': { sync: storage, },
}) => {

const isBeta = manifest.applications.gecko.id.endsWith('-dev');

const model = {
	register: {
		title: `Register with Tree Style Tabs`,
		description: `If, when this extension was first installed/enabled, Tree Style Tabs itself wasn't installed/enabled, the search may not be registered with TST.<br>Click the button below to repeat that.<br>Also, make sure to grant <i>${manifest.name}</i> the <i>Access to browser tabs</i> under <i>Extra Features</i> in TST's preferences (this should open on first registration).`,
		default: true,
		input: { type: 'control', label: `(re-)register with TST`, id: `register`, },
	},
	result: {
		title: 'Highlight Results',
		expanded: true,
		default: true, children: {
			hit: {
				title: 'Matches/Hits',
				description: `Any tabs that themselves match the search.`,
				default: true, children: {
					classes: classes({
						default: '',
					}),
					styles: styles([
						[ 'bold', true, 'Bold Text', String.raw`
							.tab:not(.pinned).tst-search\:matching .label { font-weight: bold; }
						`, ],
					]),
				},
			},
			child: {
				title: 'With Matching Children',
				description: `Any tabs with children that match the search.`,
				default: true, children: {
					classes: classes({
						default: '',
					}),
					styles: styles([
					]),
				},
			},
			miss: {
				title: 'Other/Misses',
				description: `Any tab that neither matches not has matching children.`,
				default: true, children: {
					classes: classes({
						default: '',
					}),
					styles: styles([
						[ 'shrink', true, 'Shrink Height', String.raw`
							.tab:not(.pinned).collapsed:where(.tst-search\:matching, .tst-search\:child-matches, .tst-search\:not-matching) {
								margin-top: 0; display: none;
							}
							.tab:not(.pinned).tst-search\:not-matching {
								padding-top: 0; padding-bottom: 1px;
								margin-bottom: -13.3px;
								transform: scaleY(50%); transform-origin: top;
							}
						`, ],
					]),
				},
			},
		},
	},
	debug: {
		title: 'Debug Level',
		expanded: false,
		default: 0,
		hidden: !isBeta,
		restrict: { type: 'number', from: 0, to: 2, },
		input: { type: 'integer', suffix: 'set to > 0 to enable debugging', },
	},
};

return (await new Options({ model, storage, prefix: 'options', })).children;

function classes(options) { return null && {
	title: 'Additional Tab State',
	description: `For interoperability with other TST extensions. Space separated list of states to assign to these tabs.`,
	restrict: { match: {
		exp: (/^(:?[\w-]+(?:\S+[\w-]+)*)?$/i),
		message: `Must be a space separated list of words (allowing <code>-</code> and <code>_</code>)`,
	}, },
	input: { type: 'string', },
	...options, // default,
}; }

function styles(snippets) { return {
	title: 'Styles',
	default: true, children: Object.fromEntries(snippets.map(([ name, active, description, css, ]) => [ name, {
		default: active ? css : '',
		input: { type: 'boolInt', suffix: description, off: '', on: css, },
	}, ])),
}; }

}); })(this);
