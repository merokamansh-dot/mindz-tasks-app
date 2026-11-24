/* Z Cloud team profile cards.
   Additive and fail-safe: never edits the app bundle. On the home page it inserts one block before the first ".home-block":
   "Complete your profile" for people without a card, and "Our team" with every colleague's card.
   A card holds only what the person chooses to enter (name, title, department, about, work phone, location, languages, photo).
   Colleagues see cards only, nothing else from HR. Visibility is enforced by the database (members of this workspace only).
   If anything is missing (no session, no anchor, error) it shows nothing. */
(function () {
  'use strict'
  var C = window.__MINDZ_CONFIG || {}
  if (!C.url || !C.anonKey || !window.supabase) return
  var KEY = 'sb-' + (C.url.replace(/^https?:\/\//, '').split('.')[0]) + '-auth-token'
  var ID = 'mz-people', BUCKET = 'avatars'
  var S = { ws: null, uid: null, cards: [], urls: {}, defName: '', at: 0, loading: false, ready: false, q: '' }

  function h(tag, attrs) {
    var e = document.createElement(tag), a = attrs || {}
    for (var k in a) { if (k === 'class') e.className = a[k]; else if (k === 'on') { for (var ev in a.on) e.addEventListener(ev, a.on[ev]) } else if (k === 'value') e.value = a[k]; else e.setAttribute(k, a[k]) }
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null || c === false) continue; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c) }
    return e
  }
  function token() { try { var r = JSON.parse(localStorage.getItem(KEY) || 'null'); return r && r.access_token ? r : null } catch (e) { return null } }
  function client(tok) { return window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: 'Bearer ' + tok } } }) }
  function initials(n) { var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() }
  function avatar(card, size) {
    var u = card && card.avatar_path && S.urls[card.avatar_path]
    var d = h('div', { class: 'mzp-av', style: 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size / 2.6) + 'px', 'aria-hidden': 'true' })
    if (u) { var im = h('img', { src: u, alt: '', loading: 'lazy' }); im.addEventListener('error', function () { im.remove(); d.textContent = initials(card.full_name) }); d.appendChild(im) } else d.textContent = initials(card && card.full_name)
    return d
  }

  async function load(force) {
    var t = token(); if (!t || S.loading) return
    if (!force && S.at && Date.now() - S.at < 120000) return
    S.loading = true; S.at = Date.now()
    try {
      var sb = client(t.access_token); S.uid = t.user && t.user.id
      if (!S.ws) { var m = await sb.from('workspace_members').select('workspace_id').eq('user_id', S.uid).limit(1); if (m.error || !m.data || !m.data.length) return; S.ws = m.data[0].workspace_id }
      var r = await sb.from('member_cards').select('*').eq('workspace_id', S.ws).order('full_name'); if (r.error) return
      S.cards = r.data || []
      var pr = await sb.from('profiles').select('display_name').eq('id', S.uid).maybeSingle(); S.defName = (pr.data && pr.data.display_name) || ''
      var paths = S.cards.map(function (c) { return c.avatar_path }).filter(Boolean)
      S.urls = {}
      if (paths.length) { var su = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600); (su.data || []).forEach(function (x) { if (x.signedUrl && x.path) S.urls[x.path] = x.signedUrl }) }
      S.ready = true
    } catch (e) { /* non-critical */ } finally { S.loading = false; rebuild() }
  }

  // ---------- profile editor ----------
  function resizeImage(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file)
      img.onload = function () {
        var s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 480
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 480, 480)
        URL.revokeObjectURL(url); c.toBlob(function (b) { b ? res(b) : rej(new Error('image')) }, 'image/jpeg', 0.86)
      }
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('That file is not a readable image.')) }
      img.src = url
    })
  }
  function closeModal() { var m = document.getElementById('mzp-modal'); if (m) m.remove(); document.removeEventListener('keydown', onKey) }
  function onKey(e) { if (e.key === 'Escape') closeModal() }
  function modal(title, body) {
    closeModal()
    var box = h('div', { class: 'mzp-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('div', { class: 'mzp-mh' }, h('b', {}, title), h('button', { class: 'mzp-x', type: 'button', 'aria-label': 'Close', on: { click: closeModal } }, '×')), body)
    var m = h('div', { id: 'mzp-modal', on: { mousedown: function (e) { if (e.target === m) closeModal() } } }, box)
    document.body.appendChild(m); document.addEventListener('keydown', onKey)
    var f = box.querySelector('input,textarea,button.mzp-p'); if (f) setTimeout(function () { f.focus() }, 30)
  }
  function mine() { return S.cards.filter(function (c) { return c.user_id === S.uid })[0] || null }

  function editor() {
    var cur = mine() || {}, pend = { blob: null, remove: false }
    var out = h('div', { class: 'mzp-msg', role: 'status' })
    function fld(label, id, val, opt) {
      var el = opt && opt.area ? h('textarea', { id: id, rows: '3', maxlength: String(opt.max || 500), dir: 'auto' }) : h('input', { id: id, type: opt && opt.type || 'text', maxlength: String(opt && opt.max || 120), dir: 'auto', autocomplete: 'off' })
      el.value = val || ''
      return h('label', { class: 'mzp-f', for: id }, h('span', {}, label), el)
    }
    var preview = h('div', { class: 'mzp-pv' })
    function drawPreview(url) { preview.innerHTML = ''; if (url) preview.appendChild(h('img', { src: url, alt: 'Your photo' })); else preview.appendChild(avatar(pend.remove ? { full_name: cur.full_name || S.defName } : { full_name: cur.full_name || S.defName, avatar_path: cur.avatar_path }, 96)) }
    drawPreview(null)
    var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', id: 'mzp-file', style: 'display:none' })
    file.addEventListener('change', async function () {
      var f = file.files && file.files[0]; if (!f) return
      try { pend.blob = await resizeImage(f); pend.remove = false; drawPreview(URL.createObjectURL(pend.blob)); out.textContent = '' } catch (e) { out.className = 'mzp-msg err'; out.textContent = e.message || 'Could not read that image.' }
    })
    var pick = h('button', { type: 'button', class: 'mzp-s', on: { click: function () { file.click() } } }, 'Upload photo · ارفع صورة')
    var rm = h('button', { type: 'button', class: 'mzp-q', on: { click: function () { pend.blob = null; pend.remove = true; drawPreview(null) } } }, 'Remove photo')
    var save = h('button', { type: 'button', class: 'mzp-p' }, 'Save profile · حفظ')
    var body = h('div', { class: 'mzp-body' },
      h('p', { class: 'mzp-note' }, 'Everyone in the company can see this card. Share only what you are comfortable with. HR records, salary and personal data are never shown here.'),
      h('div', { class: 'mzp-photo' }, preview, h('div', { class: 'mzp-pb' }, pick, rm, h('small', {}, 'JPG, PNG or WebP. It is cropped to a square automatically.'), file)),
      fld('Full name · الاسم بالكامل *', 'mzp-name', cur.full_name || S.defName, { max: 120 }),
      fld('Job title · المسمى الوظيفي', 'mzp-title', cur.job_title),
      fld('Department · القسم', 'mzp-dept', cur.department, { max: 80 }),
      fld('About me · نبذة عني', 'mzp-about', cur.about, { area: true, max: 500 }),
      fld('Work phone (optional) · موبايل الشغل', 'mzp-phone', cur.work_phone, { max: 30, type: 'tel' }),
      fld('Location · المكان', 'mzp-loc', cur.location, { max: 80 }),
      fld('Languages · اللغات', 'mzp-lang', cur.languages),
      out, h('div', { class: 'mzp-row' }, save, h('button', { type: 'button', class: 'mzp-q', on: { click: closeModal } }, 'Cancel')))
    function v(id) { return (document.getElementById(id).value || '').trim() }
    save.addEventListener('click', async function () {
      var name = v('mzp-name'); out.className = 'mzp-msg'
      if (name.length < 2) { out.className = 'mzp-msg err'; out.textContent = 'Please enter your full name.'; return }
      save.disabled = true; out.textContent = 'Saving…'
      try {
        var t = token(); if (!t) throw new Error('Please sign in again.'); var sb = client(t.access_token), path = cur.avatar_path || null
        if (pend.blob) { path = S.ws + '/' + S.uid + '/avatar.jpg'; var up = await sb.storage.from(BUCKET).upload(path, pend.blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' }); if (up.error) throw new Error('Photo upload failed: ' + up.error.message) }
        else if (pend.remove) { if (path) await sb.storage.from(BUCKET).remove([path]); path = null }
        var r = await sb.rpc('member_card_save', { p_ws: S.ws, p_full_name: name, p_title: v('mzp-title'), p_dept: v('mzp-dept'), p_about: v('mzp-about'), p_phone: v('mzp-phone'), p_location: v('mzp-loc'), p_languages: v('mzp-lang'), p_avatar_path: path })
        if (r.error) throw new Error(r.error.message)
        closeModal(); await load(true)
      } catch (e) { out.className = 'mzp-msg err'; out.textContent = e.message || 'Could not save. Please try again.'; save.disabled = false }
    })
    modal('My profile · بطاقتي', body)
  }

  function view(card) {
    var rows = []
    function row(k, v, tel) { if (v) rows.push(h('div', { class: 'mzp-r' }, h('span', {}, k), tel ? h('a', { href: 'tel:' + String(v).replace(/[^+\d]/g, '') }, v) : h('b', { dir: 'auto' }, v))) }
    row('Department', card.department); row('Location', card.location); row('Languages', card.languages); row('Work phone', card.work_phone, true)
    modal(card.full_name, h('div', { class: 'mzp-body' }, h('div', { class: 'mzp-vh' }, avatar(card, 96), h('div', {}, h('div', { class: 'mzp-vn', dir: 'auto' }, card.full_name), card.job_title ? h('div', { class: 'mzp-vt', dir: 'auto' }, card.job_title) : null)),
      card.about ? h('p', { class: 'mzp-ab', dir: 'auto' }, card.about) : null, (function () { var d = h('div'); rows.forEach(function (r) { d.appendChild(r) }); return d })(),
      card.user_id === S.uid ? h('div', { class: 'mzp-row' }, h('button', { class: 'mzp-p', type: 'button', on: { click: editor } }, 'Edit my profile')) : null))
  }

  // ---------- home block ----------
  function build() {
    var me = mine(), root = h('section', { id: ID, 'aria-label': 'Team profiles' })
    if (!me) root.appendChild(h('div', { class: 'mzp-cta' }, h('div', {}, h('b', {}, 'Add your profile card · أضف بطاقتك'), h('span', {}, 'Your full name, job title, photo and a few details, so colleagues know who you are.')), h('button', { class: 'mzp-p', type: 'button', on: { click: editor } }, 'Add my profile')))
    else root.appendChild(h('div', { class: 'mzp-me' }, avatar(me, 56), h('div', { class: 'mzp-mt' }, h('b', { dir: 'auto' }, me.full_name), h('span', { dir: 'auto' }, (!me.avatar_path || !me.about) ? 'Your card is ready. Add your photo and a short intro \u00b7 \u0623\u0636\u0641 \u0635\u0648\u0631\u062a\u0643 \u0648\u0646\u0628\u0630\u0629' : (me.job_title || 'Add your job title'))), h('button', { class: 'mzp-s', type: 'button', on: { click: editor } }, 'Edit my profile')))
    var cards = S.cards.filter(function (c) { var q = S.q.toLowerCase(); return !q || [c.full_name, c.job_title, c.department].join(' ').toLowerCase().indexOf(q) >= 0 })
    var head = h('div', { class: 'mzp-hd' }, h('b', {}, 'Our team · فريقنا'), h('span', {}, S.cards.length + (S.cards.length === 1 ? ' profile' : ' profiles')))
    if (S.cards.length > 6) { var inp = h('input', { type: 'search', placeholder: 'Search name or title', 'aria-label': 'Search team', value: S.q, dir: 'auto' }); inp.addEventListener('input', function () { S.q = inp.value; var g = document.getElementById('mzp-grid'); if (g) { var n = grid(); g.parentNode.replaceChild(n, g); var fi = document.querySelector('#' + ID + ' input[type=search]'); if (fi) { fi.focus(); fi.setSelectionRange(S.q.length, S.q.length) } } }); head.appendChild(inp) }
    root.appendChild(head); root.appendChild(grid())
    return root
  }
  function grid() {
    var q = S.q.toLowerCase(), cards = S.cards.filter(function (c) { return !q || [c.full_name, c.job_title, c.department].join(' ').toLowerCase().indexOf(q) >= 0 })
    var g = h('div', { id: 'mzp-grid', class: 'mzp-grid' })
    if (!cards.length) g.appendChild(h('p', { class: 'mzp-empty' }, S.cards.length ? 'No one matches that search.' : 'No profiles yet. Be the first to add yours.'))
    cards.forEach(function (c) {
      g.appendChild(h('button', { class: 'mzp-card', type: 'button', on: { click: function () { view(c) } }, 'aria-label': 'Open profile of ' + c.full_name }, avatar(c, 64), h('b', { dir: 'auto' }, c.full_name), h('span', { dir: 'auto' }, c.job_title || ''), h('small', { dir: 'auto' }, c.department || '')))
    })
    return g
  }
  function rebuild() { var o = document.getElementById(ID); if (!o) { ensure(); return } var n = build(); o.parentNode.replaceChild(n, o) }

  var CSS = '#mz-people{--b:#0D5FB3;--n:#020F22;margin:0 0 24px;font-family:inherit;color:var(--n)}' +
    '#mz-people .mzp-cta,#mz-people .mzp-me{display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#fff;border:1px solid #d6e2f3;border-radius:16px;padding:14px 18px;margin-bottom:14px;box-shadow:0 4px 18px rgba(13,95,179,.08)}' +
    '#mz-people .mzp-cta{background:linear-gradient(120deg,#fff,#eaf2fc);justify-content:space-between}#mz-people .mzp-cta>div{display:flex;flex-direction:column;gap:2px;flex:1;min-width:220px}#mz-people .mzp-cta span{color:#3b4a60;font-size:14px}' +
    '#mz-people .mzp-mt{display:flex;flex-direction:column;flex:1;min-width:150px}#mz-people .mzp-mt span{color:#3b4a60;font-size:14px}' +
    '.mzp-av{border-radius:50%;background:#0D5FB3;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none;border:2px solid #fff;box-shadow:0 0 0 2px #d6e2f3}.mzp-av img{width:100%;height:100%;object-fit:cover;display:block}' +
    '#mz-people .mzp-hd{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:6px 0 10px}#mz-people .mzp-hd b{font-size:18px}#mz-people .mzp-hd span{color:#3b4a60;font-size:14px}#mz-people .mzp-hd input{margin-inline-start:auto;font:inherit;padding:8px 12px;border:1px solid #c5d4ea;border-radius:999px;min-width:200px}' +
    '#mz-people .mzp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}' +
    '#mz-people .mzp-card{font:inherit;text-align:center;background:#fff;border:1px solid #d6e2f3;border-radius:16px;padding:16px 10px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;color:var(--n)}#mz-people .mzp-card:hover{border-color:var(--b);box-shadow:0 6px 18px rgba(13,95,179,.14)}#mz-people .mzp-card b{margin-top:6px;font-size:15px}#mz-people .mzp-card span{font-size:13px;color:#3b4a60}#mz-people .mzp-card small{font-size:12px;color:var(--b)}' +
    '#mz-people .mzp-empty{color:#3b4a60}' +
    '#mz-people button:focus-visible,#mzp-modal button:focus-visible,#mzp-modal input:focus-visible,#mzp-modal textarea:focus-visible,#mz-people input:focus-visible{outline:3px solid #FCFF59;outline-offset:2px;box-shadow:0 0 0 5px #020F22}' +
    '.mzp-p,.mzp-s,.mzp-q{font:inherit;font-weight:700;border-radius:999px;padding:10px 20px;cursor:pointer}.mzp-p{background:#0D5FB3;color:#fff;border:2px solid #0D5FB3}.mzp-s{background:#fff;color:#0D5FB3;border:2px solid #0D5FB3}.mzp-q{background:none;color:#3b4a60;border:2px solid transparent;text-decoration:underline}.mzp-p[disabled]{opacity:.6;cursor:default}' +
    '#mzp-modal{position:fixed;inset:0;background:rgba(2,15,34,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:14px}' +
    '.mzp-box{background:#fff;color:#020F22;border-radius:20px;width:min(520px,100%);max-height:92vh;overflow:auto;box-shadow:0 20px 60px rgba(2,15,34,.35);font-family:inherit}' +
    '.mzp-mh{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #e3ecf8;position:sticky;top:0;background:#fff}.mzp-mh b{font-size:18px}.mzp-x{font-size:26px;line-height:1;background:none;border:0;cursor:pointer;color:#3b4a60}' +
    '.mzp-body{padding:16px 20px 20px;display:flex;flex-direction:column;gap:12px}.mzp-note{margin:0;font-size:13px;color:#3b4a60;background:#eaf2fc;border-radius:12px;padding:10px 12px}' +
    '.mzp-photo{display:flex;gap:14px;align-items:center}.mzp-pv img{width:96px;height:96px;border-radius:50%;object-fit:cover;border:2px solid #fff;box-shadow:0 0 0 2px #d6e2f3}.mzp-pb{display:flex;flex-direction:column;gap:6px;align-items:flex-start}.mzp-pb small{color:#3b4a60}' +
    '.mzp-f{display:flex;flex-direction:column;gap:4px;font-size:14px;font-weight:600}.mzp-f input,.mzp-f textarea{font:inherit;font-weight:400;padding:10px 12px;border:1px solid #c5d4ea;border-radius:12px}' +
    '.mzp-row{display:flex;gap:10px;flex-wrap:wrap}.mzp-msg{min-height:1.2em;font-size:14px;color:#3b4a60}.mzp-msg.err{color:#a4151e;font-weight:600}' +
    '.mzp-vh{display:flex;gap:14px;align-items:center}.mzp-vn{font-size:20px;font-weight:700}.mzp-vt{color:#0D5FB3;font-weight:600}.mzp-ab{margin:0;line-height:1.5}.mzp-r{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid #eef3fb;font-size:14px}.mzp-r span{color:#3b4a60}.mzp-r a{color:#0D5FB3;font-weight:600}'
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st)

  var raf = 0
  // Sits under the greeting hero of the real home (<main class="hh"> > ".hh-hero"), after the NOUR welcome block when it is shown.
  function ensure() {
    var cur = document.getElementById(ID), hero = document.querySelector('.hh-hero'), anchor = hero ? null : document.querySelector('.home-block')
    if (!S.ready || (!hero && !anchor) || !token()) { if (cur && !hero && !anchor) cur.remove(); return }
    if (hero) {
      var wel = document.getElementById('nour-welcome'), base = wel && wel.parentNode === hero.parentNode ? wel : hero
      if (cur && cur.previousElementSibling === base) return
      if (cur) cur.remove()
      base.parentNode.insertBefore(build(), base.nextSibling); return
    }
    if (cur && cur.nextElementSibling === anchor) return
    if (cur) cur.remove()
    anchor.parentNode.insertBefore(build(), anchor)
  }
  function tick() {
    if (!document.querySelector('.hh-hero') && !document.querySelector('.home-block')) { var c = document.getElementById(ID); if (c) c.remove(); return }
    if (!document.getElementById(ID)) load(false)
    ensure()
  }
  new MutationObserver(function () { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; tick() }) }).observe(document.body, { childList: true, subtree: true })
  window.addEventListener('hashchange', function () { S.at = 0; tick() })
  tick()
})()
