
# TST Tab Search -- filter Tree Style Tab's sidebar

This is an extension for the browser extension [Tree Style Tabs](https://github.com/piroor/treestyletab#readme) (TST). It adds a search box at the bottom of TST's sidebar, allowing to search the titles and URLs (or whatever) of the tabs in the current window/sidebar, optionally case sensitive, as whole word, or by regular expression.
Matching tabs will be highlighted in the tree, and/or non-matches will be suppressed (see extension preferences).
Should the search bar not show up after installing this extension, then have a look at `about:addons` > "Extensions" > "TST Tab Search" > "Preferences".

![Searching for Cats](./resources/screenshot.png)

Thats pretty much all there is to say.
Many thanks to TST's author [piroor](https://github.com/piroor), who has not only developed TST as a great standalone extension, but also designed a very good API for other extensions to interact and integrate with TST. With that, writing the initial version of this extension from scratch took only about two long afternoons.

<b>Permissions Used</b>:

- "Access to browser tabs": Get titles and URLs of tabs to be searched.
- "Display notifications to you": Notify when something went wrong, or right.

<b>Currently Impossible Features</b>:

* set focus to search bar via hotkey (e.g. on Ctrl+Shift+F)
	* blocked by https://bugzilla.mozilla.org/show_bug.cgi?id=1502713

<!-- NOTE: AMO keeps line breaks within paragraphs ... -->


## Additional Features

I am happy to receive feedback or contributions on this. This is a (currently short) list of stuff that should be addressed:

* more/better highlight styles, esp. for pinned tabs (can be tried via "Custom Styles")
* update the screenshot with active tab and counter (and/or add more screenshots)


## Development builds -- [![](https://ci.appveyor.com/api/projects/status/github/NiklasGollenstede/tst-search?svg=true)](https://ci.appveyor.com/project/NiklasGollenstede/tst-search)

Development builds are automatically created on every commit with [appveyor](https://ci.appveyor.com/project/NiklasGollenstede/tst-search/history) and [released](https://github.com/NiklasGollenstede/tst-search/releases) on GitHub.\
These builds use a different id (`-dev` suffix), so they are installed as an additional extension and do not replace the release version. This means that:
 * you probably want to disable the release version while the development version is active
 * any options set are managed individually (so pre-release versions can't mess with your settings)
 * they never update to release versions, but
    * they update themselves to the latest development version (once a day, or when clicking `about:addons` > ⚙ > "Check for Updates")
    * every release version has a corresponding development version (the one with the same prefix and highest build number)


##  AMO code review notes

Each [development build](#development-builds) also builds a release ZIP/XPI. For any given SemVer, the one from the tag with the highest build number will be manually uploaded to AMO as the release of that version.
The instructions for and logs of that tag show exactly how the release version was built.
Input to the build are source files from this repository, and files installed in `node_modules/` by `npm` as specified in `package.json` and `package-lock.json`.
Currently, the build process only builds some non-source files, and ZIPs the required files.
