'use strict';

const native = window.dailyNative;
function readSetting(key) {
  return native ? native[key] || null : localStorage.getItem(key);
}
function writeSetting(key, value) {
  if (native) {
    native[key] = value;
    window.webkit.messageHandlers.dailySave.postMessage({ key, value });
  } else localStorage.setItem(key, value);
}
const storageKey = 'daily-tasks-v1';
const form = document.querySelector('#task-form');
const input = document.querySelector('#task-input');
const list = document.querySelector('#tasks');
const clear = document.querySelector('#clear');
const warning = document.querySelector('#storage-warning');
let tasks = [];
try {
  const saved = JSON.parse(readSetting(storageKey) || '[]');
  if (!Array.isArray(saved)) throw new Error('Invalid saved tasks');
  tasks = saved.filter(task => task && typeof task.id === 'string' && typeof task.text === 'string' && typeof task.done === 'boolean');
} catch {
  warning.hidden = false;
}

function save() {
  try {
    writeSetting(storageKey, JSON.stringify(tasks));
    warning.hidden = true;
  } catch {
    warning.hidden = false;
  }
  render();
}

function render() {
  list.replaceChildren();
  const history = document.querySelector('#history-tasks');
  history.replaceChildren();
  for (const task of tasks) {
    const row = document.createElement('li');
    row.classList.toggle('done', task.done);
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.done;
    checkbox.addEventListener('change', () => {
      task.done = checkbox.checked;
      task.completedAt = task.done ? new Date().toISOString() : null;
      save();
      (task.done ? document.querySelector('#history summary') : input).focus();
    });
    const text = document.createElement('span');
    text.textContent = task.text;
    label.append(checkbox, text);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'delete';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Delete ${task.text}`);
    remove.addEventListener('click', () => {
      const index = tasks.indexOf(task);
      tasks = tasks.filter(item => item !== task);
      save();
      const buttons = list.querySelectorAll('.delete');
      (buttons[Math.min(index, buttons.length - 1)] || input).focus();
    });
    row.append(label, remove);
    if (task.done) {
      const date = document.createElement('small');
      date.className = 'completion-date';
      const timestamp = new Date(task.completedAt);
      date.textContent = task.completedAt && !Number.isNaN(timestamp.getTime()) ? timestamp.toLocaleString() : 'Completed earlier';
      text.append(document.createElement('br'), date);
      // History is retained; uncheck a task to return it to the active list.
      remove.remove();
    }
    (task.done ? history : list).append(row);
  }
  const remaining = tasks.filter(task => !task.done).length;
  document.querySelector('#count').textContent = `${remaining} ${remaining === 1 ? 'task' : 'tasks'} left`;
  document.querySelector('#empty').hidden = remaining > 0;
  document.querySelector('#history-count').textContent = tasks.filter(task => task.done).length;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  tasks.push({ id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(''), text, done: false });
  input.value = '';
  save();
  input.focus();
});
clear.addEventListener('click', () => {
  document.querySelector('#history').open = true;
  document.querySelector('#history summary').focus();
});
render();

// Appearance preferences use their own key so task data stays independent.
const appearanceKey = 'daily-appearance-v1';
const backgroundChoice = document.querySelector('#background-choice');
const fontChoice = document.querySelector('#font-choice');
const appearanceWarning = document.querySelector('#appearance-warning');
const backgrounds = ['linen', 'sage', 'sky', 'lavender', 'peach'];
const fonts = ['sans', 'serif', 'mono'];

function applyAppearance(value) {
  const background = backgrounds.includes(value?.background) ? value.background : 'linen';
  const font = fonts.includes(value?.font) ? value.font : 'sans';
  document.documentElement.dataset.background = background;
  document.documentElement.dataset.font = font;
  backgroundChoice.value = background;
  fontChoice.value = font;
}

try {
  applyAppearance(JSON.parse(readSetting(appearanceKey) || 'null'));
} catch {
  applyAppearance(null);
  appearanceWarning.hidden = false;
}

function updateAppearance() {
  const preferences = { background: backgroundChoice.value, font: fontChoice.value };
  applyAppearance(preferences);
  try {
    writeSetting(appearanceKey, JSON.stringify(preferences));
    appearanceWarning.hidden = true;
  } catch {
    appearanceWarning.hidden = false;
  }
}

backgroundChoice.addEventListener('change', updateAppearance);
fontChoice.addEventListener('change', updateAppearance);
document.querySelector('#reset-appearance').addEventListener('click', () => {
  applyAppearance(null);
  updateAppearance();
});

// Larger, user-selected files are kept in IndexedDB rather than localStorage.
const customStatus = document.querySelector('#custom-status');
const defaults = { background: '#f5f4ef', text: '#28392f', accent: '#355e44' };
let custom = {};
let imageURL;
let uploadedFont;
let database;
let writeQueue = Promise.resolve();
const customControls = document.querySelectorAll('#image-upload, #font-upload, #custom-background, #custom-text, #custom-accent, #remove-image, #remove-font');
customControls.forEach(control => { control.disabled = true; });

function storeCustom() {
  if (native) {
    const snapshot = { ...custom };
    writeQueue = writeQueue.catch(() => {}).then(async () => {
      const encode = blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (snapshot.image instanceof Blob) snapshot.image = await encode(snapshot.image);
      if (snapshot.font instanceof Blob) snapshot.font = await encode(snapshot.font);
      writeSetting('custom', JSON.stringify(snapshot));
      customStatus.textContent = 'Appearance saved on this Mac.';
    }).catch(() => { customStatus.textContent = 'Couldn’t save appearance on this Mac.'; });
    return;
  }
  if (!database) { customStatus.textContent = 'Storage is unavailable. Your appearance applies for this session only.'; return; }
  const snapshot = { ...custom };
  writeQueue = writeQueue.catch(() => {}).then(() => new Promise((resolve, reject) => {
    const transaction = database.transaction('preferences', 'readwrite');
    transaction.objectStore('preferences').put(snapshot, 'custom');
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }));
  writeQueue.then(() => { customStatus.textContent = 'Appearance saved on this device.'; }, () => {
    customStatus.textContent = 'Couldn’t save your appearance. Your changes apply for this session.';
  });
}

function applyCustomColors() {
  const style = document.documentElement.style;
  for (const [name, fallback] of Object.entries(defaults)) {
    const value = /^#[0-9a-f]{6}$/i.test(custom[name]) ? custom[name] : null;
    document.querySelector(`#custom-${name}`).value = value || fallback;
    if (name === 'background') {
      if (value) style.setProperty('--page-background', value);
      else style.removeProperty('--page-background');
    } else {
      if (value) style.setProperty(`--user-${name}`, value);
      else style.removeProperty(`--user-${name}`);
    }
  }
  const rgb = (custom.accent || defaults.accent).slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  const luminance = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  style.setProperty('--accent-text', luminance > .179 ? '#000000' : '#ffffff');
}

function applyImage() {
  if (imageURL) URL.revokeObjectURL(imageURL);
  imageURL = custom.image instanceof Blob ? URL.createObjectURL(custom.image) : null;
  document.body.style.setProperty('--user-image', imageURL ? `url("${imageURL}")` : 'none');
  document.body.classList.toggle('has-image', Boolean(imageURL));
}

async function loadFont(blob) {
  const face = new FontFace('DailyCustom', await blob.arrayBuffer());
  await face.load();
  return face;
}
function applyFont(face) {
  if (uploadedFont) document.fonts.delete(uploadedFont);
  uploadedFont = face;
  if (face) {
    document.fonts.add(face);
    document.documentElement.style.setProperty('--app-font', 'DailyCustom, system-ui, sans-serif');
  } else document.documentElement.style.removeProperty('--app-font');
}

(async () => {
  try {
    if (native) {
      custom = JSON.parse(readSetting('custom') || '{}');
      if (custom.image) custom.image = await (await fetch(custom.image)).blob();
      if (custom.font) custom.font = await (await fetch(custom.font)).blob();
    } else {
    database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('daily-personalization', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('preferences');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Storage blocked'));
    });
    custom = await new Promise((resolve, reject) => {
      const request = database.transaction('preferences').objectStore('preferences').get('custom');
      request.onsuccess = () => resolve(request.result || {});
      request.onerror = () => reject(request.error);
    });
    }
    applyCustomColors();
    applyImage();
    if (custom.font instanceof Blob) applyFont(await loadFont(custom.font));
  } catch {
    customStatus.textContent = 'Saved appearance could not be loaded. New changes can still apply for this session.';
  } finally {
    customControls.forEach(control => { control.disabled = false; });
  }
})();

for (const name of Object.keys(defaults)) {
  document.querySelector(`#custom-${name}`).addEventListener('input', event => {
    custom[name] = event.target.value;
    applyCustomColors();
    storeCustom();
  });
}
document.querySelector('#image-upload').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Choose a PNG, JPEG or WebP image under 10 MB.');
    const bitmap = await createImageBitmap(file);
    bitmap.close();
    custom.image = file;
    applyImage();
    storeCustom();
  } catch (error) { customStatus.textContent = error.message || 'This image could not be opened.'; }
  event.target.value = '';
});
document.querySelector('#font-upload').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (!/\.(woff2?|ttf|otf)$/i.test(file.name) || file.size > 5 * 1024 * 1024) throw new Error('Choose a WOFF, WOFF2, TTF or OTF font under 5 MB.');
    const face = await loadFont(file);
    custom.font = file;
    applyFont(face);
    storeCustom();
  } catch { customStatus.textContent = 'Couldn’t open this font. Choose a valid WOFF, WOFF2, TTF or OTF file under 5 MB.'; }
  event.target.value = '';
});
document.querySelector('#remove-image').addEventListener('click', () => { delete custom.image; applyImage(); storeCustom(); });
document.querySelector('#remove-font').addEventListener('click', () => { delete custom.font; applyFont(null); storeCustom(); });
backgroundChoice.addEventListener('change', () => { delete custom.background; delete custom.image; applyCustomColors(); applyImage(); storeCustom(); });
fontChoice.addEventListener('change', () => { delete custom.font; applyFont(null); storeCustom(); });
document.querySelector('#reset-appearance').addEventListener('click', () => {
  custom = {};
  applyCustomColors();
  applyImage();
  applyFont(null);
  storeCustom();
});
if (!native && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    customStatus.textContent = 'Offline support is unavailable. Use HTTPS or localhost to enable installation.';
  });
}
