// Chrome shows a JSON response as a lone <pre> holding the raw text. When the
// page is one of those and the text parses, replace it with a collapsible,
// syntax-highlighted tree and a Raw/Parsed toggle.

const JSON_CONTENT_TYPE = /json|^text\/plain$/;
const URL_PATTERN = /^https?:\/\/\S+$/;

// JSON.parse rounds numbers beyond double precision (e.g. 64-bit IDs). The
// parser keeps each number's source text so it displays exactly as sent.
class JsonNumber {
  constructor(source) {
    this.source = source;
  }
}

main();

function main() {
  const pre = document.body?.querySelector(':scope > pre');
  if (!pre || !JSON_CONTENT_TYPE.test(document.contentType)) return;

  const text = pre.textContent;
  if (!/^\s*[[{]/.test(text)) return;

  let data;
  try {
    data = JSON.parse(text, (_key, value, context) =>
      typeof value === 'number' ? new JsonNumber(context.source) : value,
    );
  } catch {
    return;
  }

  const tree = el('div', 'jv-tree');
  tree.append(renderEntry(data, undefined, true));
  tree.addEventListener('click', (event) => {
    const toggle = event.target.closest('.jv-toggle, .jv-summary');
    if (toggle) toggle.parentElement.classList.toggle('jv-collapsed');
  });

  pre.className = 'jv-raw';
  pre.removeAttribute('style');

  const rawButton = el('button', 'jv-button', 'Raw');
  const parsedButton = el('button', 'jv-button', 'Parsed');
  const show = (raw) => {
    pre.hidden = !raw;
    tree.hidden = raw;
    rawButton.classList.toggle('jv-active', raw);
    parsedButton.classList.toggle('jv-active', !raw);
  };
  rawButton.addEventListener('click', () => show(true));
  parsedButton.addEventListener('click', () => show(false));

  const toolbar = el('div', 'jv-toolbar');
  toolbar.append(rawButton, parsedButton);

  show(false);
  document.body.className = 'jv-body';
  document.body.replaceChildren(toolbar, tree, pre);
}

// One line of the tree: optional key, the value, and a trailing comma unless
// it is the last entry. Non-empty objects and arrays get a collapse toggle.
function renderEntry(value, key, isLast) {
  const line = el('div', 'jv-line');
  if (key !== undefined) line.append(el('span', 'jv-key', JSON.stringify(key)), ': ');

  if (value !== null && typeof value === 'object' && !(value instanceof JsonNumber)) {
    const isArray = Array.isArray(value);
    const entries = isArray ? value.map((item) => [undefined, item]) : Object.entries(value);
    const [open, close] = isArray ? '[]' : '{}';

    if (entries.length === 0) {
      line.append(el('span', 'jv-punct', open + close));
    } else {
      const children = el('div', 'jv-children');
      entries.forEach(([childKey, child], i) =>
        children.append(renderEntry(child, childKey, i === entries.length - 1)),
      );
      const noun = isArray ? 'item' : 'key';
      line.classList.add('jv-node');
      line.dataset.count = `${entries.length} ${entries.length === 1 ? noun : noun + 's'}`;
      line.prepend(el('span', 'jv-toggle'));
      line.append(
        el('span', 'jv-punct', open),
        el('span', 'jv-summary'),
        children,
        el('span', 'jv-punct', close),
      );
    }
  } else {
    line.append(renderPrimitive(value));
  }

  if (!isLast) line.append(el('span', 'jv-punct', ','));
  return line;
}

function renderPrimitive(value) {
  if (value instanceof JsonNumber) return el('span', 'jv-number', value.source);
  if (value === null || typeof value === 'boolean') return el('span', 'jv-literal', String(value));

  const quoted = JSON.stringify(value);
  const span = el('span', 'jv-string');
  if (URL_PATTERN.test(value)) {
    const link = el('a', 'jv-link', quoted.slice(1, -1));
    link.href = value;
    span.append('"', link, '"');
  } else {
    span.textContent = quoted;
  }
  return span;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
