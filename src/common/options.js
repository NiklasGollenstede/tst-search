(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/options/': Options,
	'node_modules/web-ext-utils/browser/storage': { sync: storage, },
}) => {

const isBeta = manifest.applications.gecko.id.endsWith('-dev');

const model = {
	register: {
		title: `Register with Tree Style Tabs`,
		description: `If, when this extension was first installed/enabled, Tree Style Tabs itself wasn't installed/enabled, the search may not be registered with TST.<br>Click the button below to repeat that.`,
		default: true,
		input: { type: 'control', label: `(re-)register with TST`, id: `register`, },
	},
	panel: {
		title: 'Search Box Options',
		expanded: true,
		default: true, children: {
			matchCase: {
				default: false,
				input: { type: 'boolean', suffix: `<details><summary>Case Sensitive:</summary>Match the case (capital/small / upper-/lowercase) of the search term to the tabs. Otherwise ignore the case.</details>`, },
			},
			wholeWord: {
				default: false,
				input: { type: 'boolean', suffix: String.raw`<details><summary>Whole Word:</summary>Let the entered term match only whole words. If "Regular Expression" is also active, the expression will be wrapped in <code>\b(?:</code> <code>)\b</code>.</details>`, },
			},
			regExp: {
				default: false,
				input: { type: 'boolean', suffix: `<details><summary>Regular Expression:</summary>Search by (JavaScript) regular expression instead of plain string. If you don't know what this is, then you probably don't want it.</details>`, },
			},
			hideFlags: {
				default: false,
				input: { type: 'boolean', suffix: `<details><summary>Hide Search Option Buttons:</summary>Don't show the buttons for the three search options above in the search box. Note that what is selected on this page will still apply to the search.`, },
			},
			hideClear: {
				default: false,
				input: { type: 'boolean', suffix: `Hide "Clear Search" Button`, },
			},
			hideCount: {
				default: false,
				input: { type: 'boolean', suffix: `Hide Result Counter/Status`, },
			},
			darkTheme: {
				default: null,
				input: { type: 'menulist', options: [
					{ value: null,   label: `auto`, },
					{ value: false,  label: `light`, },
					{ value: true,   label: `dark`, },
				], prefix: `Color Theme:`, },
			},
			placeholder: {
				default: 'Search ...',
				input: { type: 'string', prefix: 'Search Box Placeholder:', },
			},
		},
	},
	result: {
		title: 'Result Highlighting',
		description: `Choose which styles to apply to tabs of the different search result classes.<br>No styles leaves that class unchanged.`,
		expanded: true,
		default: true, children: {
			hit: {
				title: 'Matches/Hits',
				description: `Any tabs that themselves match the search.`,
				default: true, children: {
					styles: styles([
						[ 'bold', true, 'Bold Text', String.raw`
							.tab:not(.pinned).tst-search\:matching .label { font-weight: bold; }
						`, ],
						[ 'red', false, 'Red Text', String.raw`
							.tab:not(.pinned).tst-search\:matching .label { color: red; }
						`, ],
					]),
				},
			},
			active: {
				title: 'Active Result',
				description: `The active search result, which can be scrolled through with <code>Enter</code> and <code>Shift</code>+<code>Enter</code>.`,
				default: true, children: {
					styles: styles([
						[ 'red', true, 'Red Text', String.raw`
							.tab:not(.pinned).tst-search\:active .label { color: red; }
						`, ],
						[ 'bold', false, 'Bold Text', String.raw`
							.tab:not(.pinned).tst-search\:active .label { font-weight: bold; }
						`, ],
					]),
				},
			},
			child: {
				title: 'With Matching Children',
				description: `Any tabs with children that match the search.`,
				default: true, children: {
					styles: styles([
						[ 'red', false, 'Red Text', String.raw`
							.tab:not(.pinned).tst-search\:child-matching .label { color: red; }
						`, ],
						[ 'hide', false, 'Hide Completely', String.raw`
							.tab.tst-search\:child-matching:not(.tst-search\:matching) { display: none; }
						`, ],
					]),
				},
			},
			miss: {
				title: 'Other/Misses',
				description: `Any tab that neither matches not has matching children.`,
				default: true, children: {
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
						[ 'hide', false, 'Hide Completely', String.raw`
							.tab.tst-search\:not-matching { display: none; }
						`, ],
					]),
				},
			},
			custom: {
				title: 'Custom Styles',
				description: String.raw`Custom CSS to apply to the TST sidebar.<br>
				${manifest.name} sets the CSS classes <code>tst-search:matching</code>, <code>tst-search:active</code>, <code>tst-search:child-matching</code>, and <code>tst-search:not-matching</code> on tabs in the four result categories above, respectively.<br>
				For example: <code>.tab:not(.pinned).tst-search\:active .label { color: red; }</code>				`,
				expanded: false,
				default: true, children: { styles: { default: true, children: { raw: {
					default: '', input: { type: 'code', },
				}, }, }, },
			},
		},
	},
	search: {
		title: 'Search Options',
		expanded: true,
		description: ``,
		default: true, children: {
			fieldsPrefix: {
				title: 'Tab Property Prefixes',
				description: String.raw`By default ${manifest.name} will look for the search term, according to the flags set, in the tab's title (the text displayed in the tooltip when holding the mouse cursor the tab) and the URL (the web address displayed at the center top of the window when the tab is active). This should do for most users most of the time.<br>
				<details><summary>Most users? Go on ...</summary>
					With this option active, the search term can be prefixed with a pipe separated list of tab property names, followed by a colon and an optional space (i.e. matching <code>/^\w+([|]\w+)*: ?/</code>). If such a prefix is found, it is removed from the search term, and the listed properties (converted to strings: empty if <code>null</code>ish, otherwise as JSON (w/o spaces) if not a <code>string</code>) are searched, instead of the default <code>title</code> and <code>url</code>.<br>
					This is probably mostly useful for developers. But if one knows what to search for, there is some interesting stuff to be found:<ul>
						<li>tabs playing audio: <code>audible: true</code></li>
						<li>muted tabs: <code>mutedInfo: "muted":true</code></li>
						<li>tabs with SVG favicons: <code>favIconUrl: [./]svg\b</code> (<code>.*</code>)</li>
						<li>tabs by container (ID): <code>cookieStoreId: firefox-container-1</code></li>
						<li>loaded tabs: <code>discarded: false</code></li>
						<li>tabs by ID: <code>id: 42</code> (<code>wrd</code>)</li>
						<li>a tab and its direct children: <code>id|parent: 42</code> (<code>wrd</code>)</li>
					</ul>
				</details>`,
				default: [ [ false, 'title url', ], ],
				input: [
					{ type: 'boolean', suffix: `Enable Field Prefixes<br>`, },
					{ type: 'string', prefix: `Default Properties:`, },
				],
				restrict: [
					{ type: 'boolean', },
					{ type: 'string', match: { exp: /^\w+(?:[ ]\w+)*$/, }, },
				],
			},
		},
	},
	advanced: {
		title: 'Experimental/Advanced Options',
		expanded: false,
		description: `Advanced and/or experimental options, that may break and/or disappear at any time.<br>These may also require a reload of TST, this extension or the sidebars to apply.`,
		default: true, children: {
			hideHeader: {
				title: 'Hide Header',
				description: `Hides the header above the search, that says something like "${manifest.name}". Requires re-registering above. On older versions of TST (before v3.7.5), also make sure to correctly size the panel before.<br>NOTE: That header is not part of this extension, but of TST itself, and from a UX perspective, should absolutely be there (by default). It may (in the future?) also be used to switch sub panels or do any number of other things. Please DO NOT raise issues about anything like that with TST while this option is active!`,
				default: '',
				input: { type: 'boolInt', suffix: `I vow to have read the above and not to annoy TST's authors about it.`, off: '', on: `
					#subpanel-container { height: 35px !important; }
					#subpanel-header { display: none !important; }
				`, },
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


function styles(snippets) { return {
	default: true, children: Object.fromEntries(snippets.map(([ name, active, description, css, ]) => [ name, {
		default: active ? css : '',
		input: { type: 'boolInt', suffix: description, off: '', on: css, },
	}, ])),
}; }

}); })(this);
