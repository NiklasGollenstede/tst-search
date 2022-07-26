// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

import Browser from 'web-ext-utils/browser/index.esm.js'; const { Windows, } = Browser;
import Background from '../background/index.esm.js'; const { RPC, } = Background;
import renderForm from '../content/form.esm.js';

export default async function(/**@type{Window}*/window) { const { document, } = window;

Object.assign(document.body.style, { width: '300px', height: '35px', background: 'rgb(50, 50, 52)', overflow: 'hidden', });

const windowId = (await Windows.getCurrent()).id;
const initialTerm = (await RPC.getTerm({ windowId, }));

const { applyOptions, } = (await renderForm(window, { RPC, windowId, initialTerm, }));

const term = /**@type{HTMLInputElement}*/(document.querySelector('#term')); term.focus();

applyOptions((await RPC.getOptions()));

}
