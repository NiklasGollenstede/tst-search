(function(global) { 'use strict'; const factory = function util(exports) { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.


async function updateCommand(name, count, values) {
	const commands = (await global.browser.commands.getAll());
	for (let i = 0; i < count; ++i) { // `value.length` may be smaller than `count`
		const id = name + (i ? '_'+ i : ''), command = commands.find(_=>_.name === id);
		command.shortcut = values[i] || null;
		if (command.shortcut) { try {
			(await global.browser.commands.update(command));
		} catch (error) {
			global.browser.commands.reset(id); throw error;
		} } else {
			global.browser.commands.reset(id); // can't remove, so reset instead, which removes if default is unset
		}
	}
}

return { updateCommand, };

}; if (typeof define === 'function' /* global define */ && define.amd) { define([ 'exports', ], factory); } else { const exp = { }, result = factory(exp) || exp; global[factory.name] = result; } })(this);
