// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

import Browser from 'web-ext-utils/browser/index.esm.js';


/**
 * Helper to set the values of a (list of alternative) commands.
 * For a single command, pass its name and `count = 1`, for a list of commands, pass the name of the first command, and the applicable count. The commands past the first are expected to be named `name +'_'+ i`, with `i = 1` for the second command and incrementing thereafter.
 * @param {string}             name    Command name (prefix), as set as key in the manifest's `commands` (for the first item).
 * @param {number}             count   Number of commands with that `name` prefix.
 * @param {readonly string[]}  values  Shortcut values. `null` or missing values will `.reset()` the command.
 */
export async function updateCommand(name, count, values) {
	for (let i = 0; i < count; ++i) { // `value.length` may be smaller than `count`
		const id = name + (i ? '_'+ i : '');
		if (values[i]) { try {
			(await Browser.commands.update({ name: id, shortcut: values[i].replace(/^Ctrl *[+]/, 'MacCtrl +'), }));
		} catch (error) {
			Browser.commands.reset(id); throw error;
		} } else {
			Browser.commands.reset(id); // can't remove, so reset instead, which removes if default is unset
		}
	}
}

/**
 * Returns a function which executes its callback a certain time after it itself has been called for the last time (so far).
 * The arguments and this reference passed to the callback will be those of the most recent call to the wrapper.
 * @template {any[]} ArgsT
 * @param  {(...args: ArgsT) => void}  callback  The function to call.
 * @param  {number}   time      The no-more-calls timeout duration in ms.
 * @return                      Asynchronous, debounced version of callback, which returns the `setTimeout` reference.
 */
export function debounce(callback, time) {
	let timer = null;
	return /**@type{(...args: ArgsT) => ReturnType<typeof setTimeout>}*/(function() {
		clearTimeout(timer);
		return (timer = setTimeout(() => callback.apply(this, arguments), time)); // eslint-disable-line no-invalid-this
	});
}
