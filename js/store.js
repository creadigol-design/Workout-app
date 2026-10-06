/* ROUND ONE — persistence. Text state lives in localStorage, photos in IndexedDB
 * (compressed JPEG blobs). Everything degrades to in-memory if storage is blocked. */
(function (root) {
  'use strict';
  const FW = (root.FW = root.FW || {});
  const KEY = 'roundone.state.v1';

  function freshState() {
    return {
      v: 1,
      onboarded: false,
      profile: { name: 'PLAYER 1', goalDays: 3, createdAt: Date.now() },
      settings: { sound: true, autoRest: true, ramp: true, knee: true },
      gear: FW.defaultGear(),
      slotPins: {},       // slotKey -> exId the user picked on purpose
      prog: {},           // exId -> progression state
      sessions: [],       // finished workouts
      active: null,       // workout in progress
      xp: 0,
      body: { entries: [], goalKg: null }, // weigh-ins: {id, ts, kg, waist?}
      commit: { on: false, days: [1, 3, 5], deadline: '20:00', partnerName: '', partnerPhone: '' },
      dismissInstall: false,
      food: {},           // reserved for v2 food tracking
    };
  }

  function load() {
    let raw = null;
    try { raw = root.localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
    const base = freshState();
    if (!raw) return base;
    try {
      const s = JSON.parse(raw);
      return Object.assign(base, s, {
        profile: Object.assign(base.profile, s.profile),
        settings: Object.assign(base.settings, s.settings),
        gear: Object.assign(base.gear, s.gear),
        body: Object.assign(base.body, s.body),
        commit: Object.assign(base.commit, s.commit),
      });
    } catch (e) {
      return base;
    }
  }

  let saveTimer = null;
  function save(state) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow(state), 150);
  }
  function saveNow(state) {
    try { root.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  // ---------- photos ----------
  const mem = new Map();
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve) => {
      try {
        const req = root.indexedDB.open('roundone', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('photos', { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then((d) => new Promise((resolve) => {
      if (!d) return fn(null, resolve);
      try {
        const store = d.transaction('photos', mode).objectStore('photos');
        fn(store, resolve);
      } catch (e) { resolve(null); }
    }));
  }

  const photos = {
    async put(rec) {
      mem.set(rec.id, rec);
      await tx('readwrite', (store, resolve) => {
        if (!store) return resolve();
        const r = store.put(rec);
        r.onsuccess = () => resolve();
        r.onerror = () => resolve();
      });
      return rec.id;
    },
    async get(id) {
      if (mem.has(id)) return mem.get(id);
      const rec = await tx('readonly', (store, resolve) => {
        if (!store) return resolve(null);
        const r = store.get(id);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => resolve(null);
      });
      if (rec) mem.set(id, rec);
      return rec;
    },
    async all() {
      const list = await tx('readonly', (store, resolve) => {
        if (!store) return resolve([...mem.values()]);
        const r = store.getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => resolve([]);
      });
      (list || []).forEach((p) => mem.set(p.id, p));
      return list || [];
    },
    async del(id) {
      mem.delete(id);
      await tx('readwrite', (store, resolve) => {
        if (!store) return resolve();
        const r = store.delete(id);
        r.onsuccess = () => resolve();
        r.onerror = () => resolve();
      });
    },
    async clear() {
      mem.clear();
      await tx('readwrite', (store, resolve) => {
        if (!store) return resolve();
        const r = store.clear();
        r.onsuccess = () => resolve();
        r.onerror = () => resolve();
      });
    },
  };

  const urlCache = new Map();
  function urlFor(rec) {
    if (!rec || !rec.blob) return '';
    if (!urlCache.has(rec.id)) urlCache.set(rec.id, URL.createObjectURL(rec.blob));
    return urlCache.get(rec.id);
  }

  /** Shrink a camera photo to something small enough to keep hundreds of. */
  async function compress(file, max, quality) {
    max = max || 1280; quality = quality || 0.72;
    let bmp = null;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* fall through */ }
    if (!bmp) {
      bmp = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    }
    const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight;
    const k = Math.min(1, max / Math.max(w0, h0));
    const c = document.createElement('canvas');
    c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((resolve) => c.toBlob((b) => resolve(b || file), 'image/jpeg', quality));
  }

  const blobToDataUrl = (blob) => new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(blob);
  });
  const dataUrlToBlob = (url) => fetch(url).then((r) => r.blob());

  FW.store = { freshState, load, save, saveNow, photos, urlFor, compress, blobToDataUrl, dataUrlToBlob, KEY };
})(window);
