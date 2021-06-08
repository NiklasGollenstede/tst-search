// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

import Browser from 'web-ext-utils/browser/index.esm.js'; const { manifest, } = Browser;
import Options from 'web-ext-utils/options/index.esm.js';
import Storage from 'web-ext-utils/browser/storage.esm.js'; const { sync: storage, } = Storage;

const isBeta = manifest.applications.gecko.id.endsWith('-dev');

/**@type{Record<string, import('web-ext-utils/options/index.esm.js').ModelNode>} */const model = {
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
						[ 'fgColor', [ false, '#ff4300', ], [ { type: 'boolean', }, { prefix: 'Text Color', type: 'color', }, ], (active, color = '#ff4300') => active ? String.raw`
							.tab:not(.pinned).tst-search\:matching .label { color: ${globalThis.CSS.escape(color).replace('\\#', '#')}; }
						` : '', ],
					]),
				},
			},
			active: {
				title: 'Active Result',
				description: `The active search result, which can be scrolled through with <code>Enter</code> and <code>Shift</code>+<code>Enter</code>.`,
				default: true, children: {
					styles: styles([
						[ 'fgColor', [ true, '#0085ff', ], [ { type: 'boolean', }, { prefix: 'Text Color', type: 'color', }, ], (active, color = '#0085ff') => active ? String.raw`
							.tab:not(.pinned).tst-search\:active .label { color: ${globalThis.CSS.escape(color).replace('\\#', '#')}; }
						` : '', ],
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
						[ 'fgColor', [ false, '#0aff00', ], [ { type: 'boolean', }, { prefix: 'Text Color', type: 'color', }, ], (active, color = '#0aff00') => active ? String.raw`
							.tab:not(.pinned).tst-search\:child-matching .label { color: ${globalThis.CSS.escape(color).replace('\\#', '#')}; }
						` : '', ],
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
						[ 'shrink', [ true, 50, ], [ { type: 'boolean', }, { prefix: 'Shrink Height to', type: 'integer', suffix: '%', }, ], (active, shrink = 50) => active ? String.raw`
							.tab:not(.pinned).collapsed:where(.tst-search\:matching, .tst-search\:child-matches, .tst-search\:not-matching) {
								margin-top: 0; display: none;
							}
							.tab:not(.pinned).tst-search\:not-matching {
								padding-top: 0; padding-bottom: 1px;
								margin-bottom: calc(-26.6px * ${((100-shrink)/100).toFixed(6)});
								transform: scaleY(${shrink.toFixed(6)}%); transform-origin: top;
							}
						` : '', [ { }, { from: 25, to: 80, }, ], ],
						[ 'opacity', [ false, 60, ], [ { type: 'boolean', }, { prefix: 'Reduce Opacity to', type: 'integer', suffix: '%', }, ], (active, opacity = 60) => active ? String.raw`
							.tab:not(.pinned).tst-search\:not-matching { opacity: ${(opacity/100).toFixed(6)}; }
						` : '', [ { }, { from: 0, to: 100, }, ], ],
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
					default: '', input: { type: 'code', }, extra: { get(/**@type{string}*/code) { return code; }, },
				}, }, }, },
			},
		},
	},
	search: {
		title: 'Search Options',
		expanded: true,
		description: ``,
		default: true, children: {
			globalFocusKey: {
				title: 'Focus Search Bar Hotkey',
				description: `Browser-wide hotkey to focus the the search bar.<br>
				NOTE: Firefox currently does not allow extensions to focus (elements in) their sidebars (see <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1502713">Firefox bug 1502713</a>). So for now, this extension instead opens a small panel at the top of the window with a copy of the search bar. Since <code>Esc</code> keypresses are also unavailable while a panel is open, pressing this hotkey, while the panel has focus, clears the search. Quickly double pressing the hotkey also clears the search, and leaves the panel closed.`,
				default: 'Ctrl + Shift + F',
				minLength: 0, maxLength: 1,
				input: { type: 'command', default: 'Ctrl + Shift + F', },
			},
			clearAfterFocus: {
				title: 'Clear Search after Switching to Tab',
				description: `Pressing <code>Ctrl + Enter</code> while the search bar has focus will switch tho the active result (if any).`,
				default: false,
				input: { type: 'boolean', suffix: `clear search after switching`, },
			},
			searchByTabIds: {
				title: 'Search by Tab ID',
				default: [ [ false, false, ], ],
				input: [
					{ type: 'boolean', suffix: `searching by tab ID (only), when entering a number (same as searching for <code>id: &lt;number&gt;</code> with "Tab Property Prefixes" active)`, },
					{ type: 'boolean', prefix: '<br>', suffix: `show tab IDs while searching`, },
				],
			},
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

export default new Options({ model, storage, prefix: 'options', }).children;


function styles(/**@type{[ title: string, initial: boolean | any[], description: string | import('web-ext-utils/options/index.esm.js').InputModel[], css: string | ((...value: any[]) => string), restrict?: import('web-ext-utils/options/index.esm.js').RestrictModel[], ][]}*/snippets) { return {
	default: true, children: Object.fromEntries(snippets.map(([ name, initial, description, css, restrict, ]) => [ name, {
		default: Array.isArray(initial) ? [ initial, ] : initial,
		input: Array.isArray(description) ? description : { type: /**@type{'boolean'}*/('boolean'), suffix: description, },
		extra: typeof css === 'string' ? { value: css, } : { get: css, },
		restrict,
	}, ])),
}; }
