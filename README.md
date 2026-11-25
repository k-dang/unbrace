# Unbrace — JSON Viewer

A Chrome extension that pretty-prints JSON documents: syntax highlighting, collapsible objects and arrays, clickable URLs, a Raw/Parsed toggle, and light/dark themes. No build step and no dependencies.

## Layout

- `extension/` – the shipped extension (manifest, content script, stylesheet, icons).
- `store/` – Web Store listing copy, screenshots, promo tile, icon source, and the script that renders them.
- `PRIVACY.md` – privacy policy linked from the store listing.

## Develop

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the `extension/` folder.
3. To format local `.json` files, open the extension's **Details** and enable **Allow access to file URLs**.

After editing a file, click the reload icon on the extension's card and refresh the JSON tab.

## How it works

Chrome displays a JSON response as a single `<pre>` holding the raw text. `content.js` runs on every page. When the page is a JSON or plain-text document whose `<pre>` parses as a JSON object or array, the script replaces the `<pre>` with a rendered tree. Every other page is left untouched.

Numbers are shown exactly as written in the source, so 64-bit IDs and values like `1.50` don't get rounded by `JSON.parse`.

## Store assets

`store/render.mjs` regenerates the icons from `store/icon.svg`, plus the screenshots and promo tile. It needs Chrome for Testing, because branded Chrome won't load extensions from the command line:

```sh
npx @puppeteer/browsers install chrome@stable
node store/render.mjs <path to the installed chrome executable>
```

## Release

1. Bump `version` in `extension/manifest.json` (each upload needs a higher version).
2. Zip the extension with the manifest at the archive root. From PowerShell or macOS:

   ```sh
   mkdir dist
   tar -a -cf dist/unbrace-<version>.zip -C extension manifest.json content.js viewer.css icons
   ```

3. Upload the zip in the Chrome Web Store Developer Dashboard. Listing and privacy answers are in `store/listing.md`.
