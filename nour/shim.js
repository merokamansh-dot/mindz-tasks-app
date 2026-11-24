/* Minimal supabase-style client, used ONLY when window.supabase is absent (the Android/Windows app shell does not load supabase-js from a CDN).
   Covers exactly what home.js and people.js call: from().select().eq().neq().limit().order().maybeSingle(), rpc(), storage.from().createSignedUrls/upload/remove. */
(function () {
  'use strict'
  if (window.supabase) return
  function mk(url, key, opts) {
    var hd = (opts && opts.global && opts.global.headers) || {}
    function H(extra) { var o = { apikey: key }; for (var k in hd) o[k] = hd[k]; for (var j in (extra || {})) o[j] = extra[j]; return o }
    function parse(r) { return r.text().then(function (t) { var b = null; try { b = t ? JSON.parse(t) : null } catch (e) { b = t } return { ok: r.ok, status: r.status, body: b } }) }
    function from(table) {
      var q = { sel: '*', f: [], lim: null, ord: null }
      var o = {
        select: function (c) { q.sel = c || '*'; return o },
        eq: function (c, v) { q.f.push(encodeURIComponent(c) + '=eq.' + encodeURIComponent(v)); return o },
        neq: function (c, v) { q.f.push(encodeURIComponent(c) + '=neq.' + encodeURIComponent(v)); return o },
        limit: function (n) { q.lim = n; return o },
        order: function (c) { q.ord = c; return o },
        maybeSingle: function () { q.lim = 1; return run().then(function (r) { return { data: r.error ? null : ((r.data || [])[0] || null), error: r.error } }) },
        then: function (a, b) { return run().then(a, b) }
      }
      function run() {
        var u = url + '/rest/v1/' + table + '?select=' + encodeURIComponent(q.sel) + (q.f.length ? '&' + q.f.join('&') : '') + (q.lim ? '&limit=' + q.lim : '') + (q.ord ? '&order=' + encodeURIComponent(q.ord) : '')
        return fetch(u, { headers: H() }).then(parse).then(function (r) { return r.ok ? { data: r.body, error: null } : { data: null, error: { message: (r.body && r.body.message) || ('http ' + r.status) } } })
      }
      return o
    }
    function rpc(name, args) {
      return fetch(url + '/rest/v1/rpc/' + name, { method: 'POST', headers: H({ 'Content-Type': 'application/json' }), body: JSON.stringify(args || {}) }).then(parse).then(function (r) {
        return r.ok ? { data: r.body, error: null } : { data: null, error: { message: (r.body && r.body.message) || ('http ' + r.status) } }
      })
    }
    var storage = { from: function (bucket) {
      return {
        createSignedUrls: function (paths, exp) {
          return fetch(url + '/storage/v1/object/sign/' + bucket, { method: 'POST', headers: H({ 'Content-Type': 'application/json' }), body: JSON.stringify({ expiresIn: exp, paths: paths }) }).then(parse).then(function (r) {
            if (!r.ok) return { data: null, error: { message: 'http ' + r.status } }
            return { data: (r.body || []).map(function (x) { return { path: x.path, signedUrl: x.signedURL ? url + '/storage/v1' + x.signedURL : null } }), error: null }
          })
        },
        upload: function (path, blob, o) {
          var ct = (o && o.contentType) || blob.type || 'application/octet-stream'
          return fetch(url + '/storage/v1/object/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/'), { method: 'POST', headers: H({ 'Content-Type': ct, 'x-upsert': o && o.upsert ? 'true' : 'false', 'cache-control': 'max-age=' + ((o && o.cacheControl) || 3600) }), body: blob }).then(parse).then(function (r) { return r.ok ? { data: r.body, error: null } : { data: null, error: { message: (r.body && (r.body.message || r.body.error)) || ('http ' + r.status) } } })
        },
        remove: function (paths) {
          return fetch(url + '/storage/v1/object/' + bucket, { method: 'DELETE', headers: H({ 'Content-Type': 'application/json' }), body: JSON.stringify({ prefixes: paths }) }).then(parse).then(function (r) { return r.ok ? { data: r.body, error: null } : { data: null, error: { message: 'http ' + r.status } } })
        }
      }
    } }
    return { from: from, rpc: rpc, storage: storage }
  }
  window.supabase = { createClient: mk }
})()
