# Chrome Web Store listing

Copy these into the Developer Dashboard when submitting.

## Store listing tab

**Category:** Developer Tools
**Language:** English

**Detailed description:**

Unbrace turns raw JSON into a readable, collapsible tree right in the tab.

Open any JSON URL or local .json file and Unbrace formats it automatically:

• Syntax highlighting for keys, strings, numbers, booleans and null
• Collapse and expand any object or array, with a count of what's inside
• Clickable links for URL values
• Raw / Parsed toggle to see the original text
• Exact numbers: large IDs and values like 1.50 show precisely as sent, never rounded
• Light and dark themes that follow your system setting

Unbrace runs entirely in your browser. It makes no network requests, stores nothing and collects no data. Pages that aren't JSON are left untouched.

**Graphic assets:**

- Store icon: `extension/icons/icon-128.png`
- Screenshots: `store/screenshots/*.png` (1280x800)
- Small promo tile: `store/promo-440x280.png`

## Privacy tab

**Single purpose:**

Format JSON documents opened in the browser as a readable, collapsible, syntax-highlighted tree.

**Host permission justification** (content script on `<all_urls>`):

JSON can be served from any URL, including local files, so the content script must be able to run on any page to detect it. On each page it only checks whether the document is a JSON response; if not, it does nothing. The JSON is formatted locally in the page and is never sent anywhere.

**Remote code:** No, I am not using remote code.

**Data usage:** Collects none of the listed data types. Check all three limited-use certifications.

**Privacy policy URL:** https://github.com/k-dang/unbrace/blob/main/PRIVACY.md
