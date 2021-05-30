// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.


/**
 * Helper to set the values of a (list of alternative) commands.
 * For a single command, pass its name and `count = 1`, for a list of commands, pass the name of the first command, and the applicable count. The commands past the first are expected to be named `name +'_'+ i`, with `i = 1` for the second command and incrementing thereafter.
 * @param {string}             name    Command name (prefix), as set as key in the manifest's `commands` (for the first item).
 * @param {number}             count   Number of commands with that `name` prefix.
 * @param {readonly string[]}  values  Shortcut values. `null` or missing values will `.reset()` the command.
 */
export async function updateCommand(name, count, values) {
	const commands = (await browser.commands.getAll());
	for (let i = 0; i < count; ++i) { // `value.length` may be smaller than `count`
		const id = name + (i ? '_'+ i : ''), command = commands.find(_=>_.name === id);
		command.shortcut = values[i] || null;
		if (command.shortcut) { try {
			(await browser.commands.update(command));
		} catch (error) {
			browser.commands.reset(id); throw error;
		} } else {
			browser.commands.reset(id); // can't remove, so reset instead, which removes if default is unset
		}
	}
}
