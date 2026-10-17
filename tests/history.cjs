const {JSDOM}=require('jsdom');const fs=require('node:fs');const assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname, '..') + '/';const disk={};
function boot(native=false,saved){
const w=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{url:'http://localhost:8000',runScripts:'outside-only'}).window;
if(native){w.dailyNative={...disk};w.webkit={messageHandlers:{dailySave:{postMessage({key,value}){disk[key]=value;}}}};}
else if(saved)w.localStorage.setItem('daily-tasks-v1',saved);
w.eval(fs.readFileSync(root+'app.js','utf8'));return w;
}
for(const native of [false,true]){
let w=boot(native),d=w.document;d.querySelector('#task-input').value='Keep history';d.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));
let cb=d.querySelector('#tasks input');cb.checked=true;cb.dispatchEvent(new w.Event('change'));
assert.equal(d.querySelectorAll('#tasks li').length,0);assert.equal(d.querySelectorAll('#history-tasks li').length,1);assert.equal(d.querySelector('#history-tasks .delete'),null);
const saved=native?disk['daily-tasks-v1']:w.localStorage.getItem('daily-tasks-v1');assert.ok(JSON.parse(saved)[0].completedAt);
w=boot(native,saved);d=w.document;assert.equal(d.querySelectorAll('#history-tasks li').length,1);
d.querySelector('#clear').click();assert.equal(d.querySelector('#history').open,true);
cb=d.querySelector('#history-tasks input');cb.checked=false;cb.dispatchEvent(new w.Event('change'));assert.equal(d.querySelectorAll('#tasks li').length,1);assert.equal(d.querySelectorAll('#history-tasks li').length,0);
d.querySelector('#reset-appearance').click();assert.equal(d.querySelectorAll('#tasks li').length,1);
}
console.log('PASS: browser and native bridge completion history, dates, persistence across relaunch, history navigation, restoration, appearance reset preserves tasks');
