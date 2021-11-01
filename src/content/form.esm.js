
const darkPref = globalThis.matchMedia('(prefers-color-scheme: dark)');
const inputNames = [ 'term', 'matchCase', 'wholeWord', 'regExp', ];
function value(/**@type{HTMLInputElement}*/input) { return input.type === 'checkbox' ? input.checked : input.value; }

const dom = (async () => { // avoid global await, until it is supported by AMO (mozilla/addons-linter#3741)
	const form_html = (await (await globalThis.fetch(new globalThis.URL('./form.html', import.meta.url).href)).text());
	const dom = globalThis.document.createElement('div');
	dom.insertAdjacentHTML('beforeend', form_html);
return dom; })();

/** Renders the interactive search panel into an empty `Window`. */
export default async function render(/**@type{Window}*/window, {
	windowId = -1, destructive = false, initialTerm = '', RPC, onWindowId = null,
} = {
	windowId: -1, destructive: !!false, initialTerm: '',
	RPC: /**@type{Await<typeof import('../background/index.esm.js').default>['RPC']}*/(null),
	onWindowId: /**@type{(windowId: number) => void}*/(null),
}) { const { document, } = window;

	document.documentElement.classList.toggle('dark-theme', darkPref.matches);
	document.body.append(...(destructive ? (await dom) : (await dom).cloneNode(true)).childNodes);

	const matchIndex = document.getElementById('matchIndex');
	const inputs = Object.fromEntries(inputNames.map(name => [ name, /**@type{HTMLInputElement}*/(document.getElementById(name)), ]));
	initialTerm && (inputs.term.value = initialTerm);

	async function doSearch(options = { }) {
		if (globalThis.closing) { return; }
		const form = { ...Object.fromEntries(inputNames.map(name => [ name, value(inputs[name]), ])), windowId, ...options, };
		console.info('TST Search: searching for:', form);
		setResult((await RPC.doSearch(form)));
	}
	function setResult(/**@type{import('../background/index.esm.js').SearchResult}*/result) {
		if (result.windowId != null && result.windowId !== -1) {
			windowId = result.windowId;
			if (onWindowId) { onWindowId(result.windowId); onWindowId = null; }
		}
		!inputs.term.matches(':focus') && (inputs.term.value = result.inputTerm);
		matchIndex.textContent = result.failed ? '??' : result.cleared ? '' : result.index >= 0 ? ((result.index + 1) +' / '+ result.matches) : (result.matches || 'none') +'';
		document.documentElement.style.setProperty('--count-width', matchIndex.clientWidth +'px');
	}

	window.addEventListener('blur', () => RPC.stopSearch());
	inputs.term.addEventListener('focus', () => { RPC.startSearch(); doSearch({ cached: false, }); });
	inputs.term.addEventListener('input', () => doSearch({ cached: true, }));
	Object.values(inputs).slice(1).forEach(_=>_.addEventListener('change', () => doSearch({ cached: true, })));
	Object.values(inputs).slice(1).forEach(_=>_.labels[0].addEventListener('mousedown', _=>_.preventDefault())); // prevent textbox from loosing focus
	document.getElementById('clearTerm').addEventListener('click', () => {
		inputs.term.value = ''; doSearch();
	});

	document.addEventListener('keydown', event => {
		switch (event.code) {
			case 'Escape': {
				inputs.term.value = ''; doSearch();
			} break;
			case 'Enter': case 'NumpadEnter': { if (event.ctrlKey) {
				RPC.focusActiveTab().catch(console.error);
			} else {
				doSearch({ cached: true, seek: !event.shiftKey, });
			} } break;
		}
	});

	function applyOptions(/**@type{Record<string, any>}*/options) {
		inputNames.slice(1).forEach(name => { inputs[name].checked = options[name]; });
		inputs.term.placeholder = options.placeholder;
		document.documentElement.classList.toggle('hide-clear', options.hideClear);
		document.documentElement.classList.toggle('hide-count', options.hideCount);
		document.documentElement.classList.toggle('hide-flags', options.hideFlags);
		if (options.darkTheme != null) {
			document.documentElement.classList.toggle('dark-theme', options.darkTheme);
			darkPref.onchange = null;
		} else {
			document.documentElement.classList.toggle('dark-theme', darkPref.matches);
			darkPref.onchange = ({ matches, }) =>
			document.documentElement.classList.toggle('dark-theme', matches);
		}
		document.documentElement.style.setProperty('--count-width', matchIndex.clientWidth +'px');
	}

	return { inputs, doSearch, setResult, applyOptions, };
}
