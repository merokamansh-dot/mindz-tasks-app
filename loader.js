// Shell loader: runs the newest published front-end bundle (hash-pinned in Supabase table app_release), else the bundled copy.
// Fast start: the last release that passed its hash check is remembered on this device, and the service worker keeps its files,
// so Z CLOUD opens straight away even on a slow connection. The newest release is still checked every time (up to 1.5 s wait);
// if the check is slow, the remembered release runs now and the new one is fetched in the background for the next open.
(function () {
  var C = window.__MINDZ_CONFIG || {}, done = false, KEY = 'mindz_last_release', WAIT = 1500
  function css(href) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l) }
  function js(src, onerr) { var s = document.createElement('script'); s.src = src; if (onerr) s.onerror = onerr; document.body.appendChild(s) }
  function bundled(why) { if (done) return; done = true; window.__MINDZ_RELEASE = 'bundled'; try { console.info('MINDz: bundled app (' + why + ')') } catch (e) {} css('main.css'); js('main.js') }
  function hex(buf) { var a = new Uint8Array(buf), s = '', i = 0; for (; i < a.length; i++) s += (a[i] < 16 ? '0' : '') + a[i].toString(16); return s }
  function get(url, ms, reload) {
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort() }, ms)
    return fetch(url, { signal: ctl.signal, cache: reload ? 'reload' : 'default' }).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer() })
  }
  function check(buf, want) { return crypto.subtle.digest('SHA-256', buf).then(function (d) { if (hex(d) !== want) throw new Error('hash mismatch'); return new TextDecoder('utf-8').decode(buf) }) }
  function valid(rel) { return !!rel && typeof rel.version === 'string' && /^https:\/\//.test(rel.base_url) && /^[0-9a-f]{64}$/.test(rel.js_sha256) && /^[0-9a-f]{64}$/.test(rel.css_sha256) }
  function readLast() { try { var r = JSON.parse(localStorage.getItem(KEY) || 'null'); return valid(r) ? r : null } catch (e) { return null } }
  function saveLast(rel) { try { localStorage.setItem(KEY, JSON.stringify({ base_url: rel.base_url, version: rel.version, js_sha256: rel.js_sha256, css_sha256: rel.css_sha256 })) } catch (e) {} }
  function files1(rel, reload) {
    var v = '?v=' + encodeURIComponent(rel.version)
    return Promise.all([get(rel.base_url + 'main.css' + v, 20000, reload).then(function (b) { return check(b, rel.css_sha256) }), get(rel.base_url + 'main.js' + v, 30000, reload).then(function (b) { return check(b, rel.js_sha256) })])
  }
  // a copy that fails its hash (damaged cache, or a release still being published) is fetched once more, straight from the network
  function files(rel) { return files1(rel, false).catch(function () { return files1(rel, true) }) }
  // Fetch + verify + start one release. Rejects (without starting anything) if anything is wrong.
  function start(rel) {
    return files(rel).then(function (r) {
      if (done) return; done = true; window.__MINDZ_RELEASE = 'remote:' + rel.version
      var st = document.createElement('style'); st.textContent = r[0]; document.head.appendChild(st)
      var url = URL.createObjectURL(new Blob([r[1]], { type: 'text/javascript' }))
      js(url, function () { done = false; bundled('blob script blocked') })
      saveLast(rel)
    })
  }
  try { if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(function () {}) } catch (e) {}
  function tryAll(list) {
    return list.reduce(function (p, rel) { return p.catch(function () { return start(rel) }) }, Promise.reject(new Error('start'))).catch(function (e) { bundled(String(e && e.message || e)) })
  }
  try {
    if (!C.url || !C.anonKey || !window.crypto || !crypto.subtle || !window.fetch) return bundled('unsupported')
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort() }, 4000)
    var fresh = fetch(C.url + '/rest/v1/app_release?select=base_url,version,js_sha256,css_sha256&id=eq.1', { headers: { apikey: C.anonKey, Authorization: 'Bearer ' + C.anonKey }, signal: ctl.signal, cache: 'no-store' })
      .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('http ' + r.status); return r.json() })
      .then(function (rows) { var rel = rows && rows[0]; if (!valid(rel)) throw new Error('no release'); return rel })
    var last = readLast()
    if (!last) {                       // first open on this device: wait for the release
      fresh.then(function (rel) { return tryAll([rel]) }, function (e) { bundled(String(e && e.message || e)) })
      return
    }
    // returning device: newest release if it answers quickly, otherwise the remembered one right away
    var waited = new Promise(function (res) { setTimeout(function () { res(null) }, WAIT) })
    Promise.race([fresh.catch(function () { return null }), waited]).then(function (rel) {
      if (rel) return tryAll(rel.version === last.version ? [rel] : [rel, last])
      return tryAll([last]).then(function () {
        // slow check: fetch the new release in the background so the next open is current
        fresh.then(function (nrel) { if (nrel.version !== last.version) files(nrel).then(function () { saveLast(nrel) }, function () {}) }, function () {})
      })
    })
  } catch (e) { bundled('error') }
})()
