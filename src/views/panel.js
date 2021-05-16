(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Windows, },
	'node_modules/web-ext-utils/utils/notify': notify,
	'background/': { RPC, },
	'content/embed': render,
}) => /** @param {Window} window */ async window => { const { document, } = window;

Object.assign(document.body.style, { width: '300px', height: '35px', background: 'rgb(50, 50, 52)', overflow: 'hidden', });

const windowId = (await Windows.getCurrent()).id;

render(window, {
	windowId, initialTerm: (await RPC.getTerm(windowId)),
}).catch(notify.error);

document.querySelector('#term').focus();

}); })(this);
