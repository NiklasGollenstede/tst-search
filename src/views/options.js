(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/options/editor/inline': Inline,
	'node_modules/web-ext-utils/utils/notify': notify,
	'background/': { register, },
}) => async (window, location) => { const { document, } = window;


async function onCommand({ name, }, _buttonId) { try { switch (name) {
	case 'register': {
		(await register()); notify.info('Registered', `Please make sure to grant ${manifest.name} "Access to browser tabs" in TST's preferences!`);
	} break;
} } catch (error) { notify.error(error); } }


(await Inline({ document, onCommand, }, location));

}); })(this);
