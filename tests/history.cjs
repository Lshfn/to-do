const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function boot(native, disk = {}) {
  const w = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'http://localhost:8000', runScripts: 'outside-only'
  }).window;
  if (native) {
    w.dailyNative = { ...disk };
    w.webkit = { messageHandlers: { dailySave: { postMessage({ key, value }) { disk[key] = value; } } } };
  } else {
    for (const [key, value] of Object.entries(disk)) w.localStorage.setItem(key, value);
  }
  w.eval(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
  return w;
}
for (const native of [false, true]) {
  const disk = {};
  let w = boot(native, disk), d = w.document;
  const today = d.querySelector('#task-date').value;
  d.querySelector('#task-input').value = 'Today only';
  d.querySelector('form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  d.querySelector('#previous-day').click();
  assert.equal(d.querySelectorAll('#tasks li').length, 0);
  d.querySelector('#task-input').value = 'Yesterday';
  d.querySelector('form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  d.querySelector('#today').click();
  assert.equal(d.querySelectorAll('#tasks li').length, 1);
  assert.equal(d.querySelector('#tasks li span').textContent, 'Today only');
  let cb = d.querySelector('#tasks input'); cb.checked = true; cb.dispatchEvent(new w.Event('change'));
  assert.equal(d.querySelectorAll('#tasks li').length, 0);
  assert.equal(d.querySelectorAll('#history-tasks li').length, 1);
  assert.equal(d.querySelector('#history-tasks .delete'), null);
  const saved = native ? disk['daily-tasks-v1'] : w.localStorage.getItem('daily-tasks-v1');
  assert.ok(JSON.parse(saved)[0].completedAt);
  assert.equal(JSON.parse(saved)[0].date, today);
  w.close();
  w = boot(native, { 'daily-tasks-v1': saved }); d = w.document;
  assert.equal(d.querySelectorAll('#history-tasks li').length, 1);
  cb = d.querySelector('#history-tasks input'); cb.checked = false; cb.dispatchEvent(new w.Event('change'));
  assert.equal(d.querySelectorAll('#tasks li').length, 1);
  assert.equal(d.querySelectorAll('#history-tasks li').length, 0);
  d.querySelector('#open-settings').click(); assert.equal(d.querySelector('#settings').open, true);
  d.querySelector('#reset-appearance').click(); assert.equal(d.querySelectorAll('#tasks li').length, 1);
  d.querySelector('#close-settings').click(); assert.equal(d.querySelector('#settings').open, false);
  d.querySelector('#previous-day').click(); assert.equal(d.querySelector('#tasks li span').textContent, 'Yesterday');
  w.close();
  const old = [{ id: 'old', text: 'Legacy task', done: false }, { id: 'done', text: 'Old completion', done: true, completedAt: '2025-04-03T12:00:00' }];
  w = boot(native, { 'daily-tasks-v1': JSON.stringify(old) }); d = w.document;
  assert.equal(d.querySelector('#tasks li span').textContent, 'Legacy task');
  d.querySelector('#task-date').value = '2025-04-03';
  d.querySelector('#task-date').dispatchEvent(new w.Event('change'));
  assert.equal(d.querySelector('#history-tasks li span').firstChild.textContent, 'Old completion');
  w.close();
}
console.log('PASS: browser/native daily separation, date navigation, completion history, relaunch persistence, restoration, settings, safe legacy migration');
