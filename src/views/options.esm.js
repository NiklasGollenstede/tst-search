// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

import Browser from 'web-ext-utils/browser/index.esm.js'; const { manifest, } = Browser;
import notify from 'web-ext-utils/utils/notify.esm.js';
import Storage from 'web-ext-utils/browser/storage.esm.js'; const { sync: storage, } = Storage;
import OptionsPage from 'web-ext-utils/options/editor/inline.esm.js';
import options from '../common/options.esm.js';
import Background from '../background/index.esm.js'; const { TST, } = Background;

export default async function(/**@type{Window}*/window, location) { const { document, } = window;

document.head.insertAdjacentHTML('beforeend', String.raw`<style>

	#\.panel\.placeholder input { max-width: 150px; }
	#\.search\.fieldsPrefix input { max-width: 250px; }

	/* remove one level of indention */
	.pref-name-result .pref-name-styles .pref-children {
		border: none; padding: 0; margin: 0;
	}

	#\.advanced\.hideHeader .value-suffix { color: darkred; }

	#\.export { margin-top: 10px; }
</style>`);

async function onCommand({ name, }, buttonId) { try { switch (name) {
	case 'register': { try {
		(await TST.register()); notify.info('Registered', `${manifest.name} should now work!`);
	} catch (error) {
		notify.error('TST Registration Failed', `Are you sure Tree Style Tabs is installed and enabled?\nThis extension won't do anything without that.`);
	} } break;
	case 'export': {
		if (false) { import('es6lib/dom.js'); } // eslint-disable-line
		const { loadFile, saveAs, readBlob, } = (await globalThis.require.async('node_modules/es6lib/dom'));
		if (buttonId === 'export') {
			const data = Object.assign({ }, storage.proxy);
			saveAs.call(window, new globalThis.Blob([ JSON.stringify(data, null, '\t'), ], { type: 'application/json', }), manifest.applications.gecko.id +'-settings.json');
		} else if (buttonId === 'reset') {
			options.forEach(_=>_.resetAll());
		} else {
			const file = (await loadFile.call(window, { accept: 'application/json, text/json, .json', }))[0];
			const data = JSON.parse((await readBlob(file)));
			Object.assign(storage.proxy, data);
		}
	} break;
} } catch (error) { notify.error(error); } }

OptionsPage({ document, onCommand, }, location);

}
