const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const SP = process.argv[2] || require('os').tmpdir();
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:8123/index.html');
  await p.click('[data-act=onbNext]');
  await p.fill('#onbKg', '96.5'); await p.fill('#onbGoal', '85');
  await p.screenshot({ path: SP + '/20-setup.png', fullPage: true });
  await p.click('[data-act=onbGo]');
  let st = await p.evaluate(() => window.__FW_DEBUG.state);
  assert.strictEqual(st.gear.barbell.weight, 25); assert.strictEqual(st.settings.knee, true);
  assert.strictEqual(st.body.entries[0].kg, 96.5); assert.strictEqual(st.body.goalKg, 85);
  // knee-friendly plan
  const home = await p.textContent('#screen');
  assert(home.includes('Box Squat'), 'box squat in home');
  assert(!home.includes('Bulgarian'));
  assert(home.includes('INSTALL ON IPHONE'));
  await p.screenshot({ path: SP + '/21-home.png', fullPage: true });
  // lock setup
  await p.click('[data-act=openLock]');
  await p.click('[data-act=lockToggle]');
  await p.fill('[data-bind=partnerName]', 'Sam'); await p.fill('[data-bind=partnerPhone]', '+44 7700 900123');
  await p.dispatchEvent('[data-bind=partnerPhone]', 'change');
  await p.screenshot({ path: SP + '/22-lock.png', fullPage: true });
  await p.click('[data-act=closeLock]');
  st = await p.evaluate(() => window.__FW_DEBUG.state);
  assert.strictEqual(st.commit.on, true); assert.strictEqual(st.commit.partnerName, 'Sam');
  // body tab: weigh-in + goal + photo
  await p.click('[data-act=tab][data-tab=body]');
  await p.fill('#wkg', '95.8');
  await p.fill('#wdate', new Date().toISOString().slice(0, 10));
  await p.click('[data-act=saveWeigh]');
  const png = fs.readFileSync('/home/user/Workout-app/icons/icon-512.png');
  for (const pose of ['front', 'front']) {
    await p.click('[data-act=setPose][data-p=' + pose + ']');
    await p.setInputFiles('#progressInput', { name: 'a.png', mimeType: 'image/png', buffer: png });
    await p.waitForTimeout(500);
  }
  await p.waitForSelector('.photo-grid img');
  await p.screenshot({ path: SP + '/23-body.png', fullPage: true });
  await p.click('[data-act=openCompare]');
  await p.waitForSelector('.cmp img');
  await p.waitForTimeout(400);
  await p.screenshot({ path: SP + '/24-compare.png' });
  await p.click('[data-act=closeCompare]');
  // set photos must NOT appear in LOG>PHOTOS, progress ones neither
  await p.click('[data-act=tab][data-tab=log]');
  await p.click('[data-act=logTab][data-t=photos]');
  assert((await p.textContent('#screen')).includes('No set photos yet'));
  // run a workout and check proof button
  await p.click('[data-act=tab][data-tab=home]');
  await p.click('[data-act=start]');
  await p.click('[data-act=toggleSet][data-ei="0"][data-si="0"]');
  await p.click('.wk-head [data-act=finish]');
  await p.waitForSelector('[data-act=sendProofKo]');
  await p.screenshot({ path: SP + '/25-ko.png' });
  await p.click('[data-act=koClose]');
  const lockTxt = await p.textContent('.lockcard');
  assert(lockTxt.includes('UNLOCKED'), lockTxt);
  console.log('errors', errors);
  await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
