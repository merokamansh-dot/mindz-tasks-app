// Shell loader: runs the newest published front-end bundle (hash-pinned in Supabase table app_release), else the bundled copy.
(function () {
  var C = window.__MINDZ_CONFIG || {}, done = false
  function css(href) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l) }
  function js(src, onerr) { var s = document.createElement('script'); s.src = src; if (onerr) s.onerror = onerr; document.body.appendChild(s) }
  function bundled(why) { if (done) return; done = true; window.__MINDZ_RELEASE = 'bundled'; try { console.info('MINDz: bundled app (' + why + ')') } catch (e) {} css('main.css'); js('main.js') }
  function hex(buf) { var a = new Uint8Array(buf), s = '', i = 0; for (; i < a.length; i++) s += (a[i] < 16 ? '0' : '') + a[i].toString(16); return s }
  function get(url, ms) {
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort() }, ms)
    return fetch(url, { signal: ctl.signal, cache: 'default' }).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer() })
  }
  function check(buf, want) { return crypto.subtle.digest('SHA-256', buf).then(function (d) { if (hex(d) !== want) throw new Error('hash mismatch'); return new TextDecoder('utf-8').decode(buf) }) }
  try {
    if (!C.url || !C.anonKey || !window.crypto || !crypto.subtle || !window.fetch) return bundled('unsupported')
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort() }, 4000)
    fetch(C.url + '/rest/v1/app_release?select=base_url,version,js_sha256,css_sha256&id=eq.1', { headers: { apikey: C.anonKey, Authorization: 'Bearer ' + C.anonKey }, signal: ctl.signal, cache: 'no-store' })
      .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('http ' + r.status); return r.json() })
      .then(function (rows) {
        var rel = rows && rows[0]
        if (!rel || !/^https:\/\//.test(rel.base_url) || !/^[0-9a-f]{64}$/.test(rel.js_sha256) || !/^[0-9a-f]{64}$/.test(rel.css_sha256)) throw new Error('no release')
        var v = '?v=' + encodeURIComponent(rel.version)
        return Promise.all([get(rel.base_url + 'main.css' + v, 12000).then(function (b) { return check(b, rel.css_sha256) }), get(rel.base_url + 'main.js' + v, 20000).then(function (b) { return check(b, rel.js_sha256) })]).then(function (r) {
          if (done) return; done = true; window.__MINDZ_RELEASE = 'remote:' + rel.version
          var st = document.createElement('style'); st.textContent = r[0]; document.head.appendChild(st)
          var url = URL.createObjectURL(new Blob([r[1]], { type: 'text/javascript' }))
          js(url, function () { done = false; bundled('blob script blocked') })
        })
      })
      .catch(function (e) { bundled(String(e && e.message || e)) })
  } catch (e) { bundled('error') }
})()
