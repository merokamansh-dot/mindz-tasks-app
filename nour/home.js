/* NOUR welcome section for the Z Cloud home page.
   Additive and fail-safe: it never edits the app bundle. It inserts one block before the first ".home-block" on the home page,
   only when (a) the Director has published it, or (b) the viewer is the Director (preview, clearly ribboned).
   If anything is missing (no session, no anchor, RPC error) it shows nothing. */
(function () {
  'use strict'
  var C = window.__MINDZ_CONFIG || {}
  if (!C.url || !C.anonKey || !window.supabase) return
  var KEY = 'sb-' + (C.url.replace(/^https?:\/\//, '').split('.')[0]) + '-auth-token'
  var state = { ws: null, status: null, at: 0, loading: false, expanded: null }
  var ID = 'nour-welcome'

  function h(tag, attrs) {
    var e = document.createElement(tag), a = attrs || {}
    for (var k in a) { if (k === 'class') e.className = a[k]; else if (k === 'on') { for (var ev in a.on) e.addEventListener(ev, a.on[ev]) } else e.setAttribute(k, a[k]) }
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null || c === false) continue; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c) }
    return e
  }
  function token() { try { var r = JSON.parse(localStorage.getItem(KEY) || 'null'); return r && r.access_token ? r : null } catch (e) { return null } }
  function client(tok) { return window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: 'Bearer ' + tok } } }) }

  async function load() {
    var t = token(); if (!t || state.loading) return
    if (state.at && Date.now() - state.at < 120000) return   // throttles failures too
    state.loading = true; state.at = Date.now()
    try {
      var sb = client(t.access_token), uid = t.user && t.user.id
      if (!state.ws) { var m = await sb.from('workspace_members').select('workspace_id').eq('user_id', uid).limit(1); if (m.error || !m.data || !m.data.length) return; state.ws = m.data[0].workspace_id }
      var r = await sb.rpc('nour_welcome_status', { p_ws: state.ws }); if (r.error || !r.data) { state.status = null; return }
      state.status = r.data
      if (state.expanded === null) {
        state.expanded = !r.data.dismissed
        // Show once: after the first expanded display to a real employee (published, not the Director's preview),
        // record it at once, so later logins show only the slim bar with "Show welcome" to replay it.
        if (state.expanded && r.data.published) mark('dismiss')
      }
    } catch (e) { state.status = null } finally { state.loading = false; ensure() }
  }
  function mark(what) { var t = token(); if (!t || !state.ws) return; try { client(t.access_token).rpc('nour_welcome_mark', { p_ws: state.ws, p_what: what }) } catch (e) { /* non-critical */ } }

  var CSS = '#nour-welcome{--b:#0D5FB3;--n:#020F22;font-family:inherit;margin:0 0 24px;border-radius:20px;overflow:hidden;background:#fff;color:var(--n);border:1px solid #d6e2f3;box-shadow:0 8px 30px rgba(13,95,179,.12);position:relative}' +
    '#nour-welcome *{box-sizing:border-box}#nour-welcome h2,#nour-welcome h3,#nour-welcome p{margin:0}' +
    '#nour-welcome .nw-ribbon{background:#FCFF59;color:var(--n);font-weight:700;font-size:13px;padding:6px 14px;text-align:center}' +
    '#nour-welcome .nw-hero{display:grid;grid-template-columns:1.15fr .85fr;background:linear-gradient(120deg,#fff 0%,#eaf2fc 100%)}' +
    '#nour-welcome .nw-copy{padding:36px 34px;display:flex;flex-direction:column;justify-content:center;gap:14px}' +
    '#nour-welcome .nw-eyebrow{color:var(--b);font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase}' +
    '#nour-welcome h2{font-size:clamp(26px,4vw,38px);line-height:1.12;font-weight:800}' +
    '#nour-welcome .nw-sub{font-size:17px;color:#3b4a60;max-width:34em}' +
    '#nour-welcome .nw-btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}' +
    '#nour-welcome button,#nour-welcome a.nw-btn{font:inherit;font-weight:700;border-radius:999px;padding:12px 22px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;min-height:46px}' +
    '#nour-welcome .nw-p{background:var(--b);color:#fff;border:2px solid var(--b)}#nour-welcome .nw-s{background:#fff;color:var(--b);border:2px solid var(--b)}#nour-welcome .nw-q{background:none;color:#5b6b82;border:0;font-weight:500;text-decoration:underline;padding:8px 6px;min-height:40px}' +
    '#nour-welcome button:focus-visible,#nour-welcome a:focus-visible,#nour-welcome video:focus-visible{outline:3px solid #FCFF59;outline-offset:2px;box-shadow:0 0 0 5px var(--n)}' +
    '#nour-welcome .nw-face{background:var(--b);display:flex;align-items:center;justify-content:center;padding:26px 26px 64px;position:relative}' +
    '#nour-welcome .nw-face img{width:min(260px,70%);height:auto;aspect-ratio:1/1;flex:none;border-radius:50%;object-fit:cover;border:5px solid #fff;box-shadow:0 0 0 10px rgba(255,255,255,.22)}' +
    '#nour-welcome .nw-tag{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);background:#fff;color:var(--n);border-radius:999px;padding:6px 14px;font-size:13px;white-space:nowrap}#nour-welcome .nw-tag b{color:var(--b)}' +
    '#nour-welcome .nw-vid{padding:22px 34px 8px;background:#f4f8fd;border-top:1px solid #d6e2f3}#nour-welcome video{width:100%;max-height:70vh;border-radius:14px;background:#020F22;display:block}' +
    '#nour-welcome .nw-note{font-size:13px;color:#5b6b82;margin-top:8px}' +
    '#nour-welcome .nw-help{padding:30px 34px 10px}#nour-welcome .nw-help h3{font-size:24px;font-weight:800;margin-bottom:16px}' +
    '#nour-welcome .nw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}' +
    '#nour-welcome .nw-c{background:#f4f8fd;border-radius:14px;padding:16px;border:1px solid #e1eaf6}#nour-welcome .nw-c b{display:flex;align-items:center;gap:10px;font-size:16px;margin-bottom:6px}' +
    '#nour-welcome .nw-c i{font-style:normal;background:var(--b);color:#fff;width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex:none}#nour-welcome .nw-c span{font-size:14px;color:#3b4a60;display:block}' +
    '#nour-welcome .nw-ai{margin:18px 34px 30px;padding:18px 20px;border-radius:14px;background:var(--n);color:#fff;font-size:15px;line-height:1.5}#nour-welcome .nw-ai b{color:#FCFF59}' +
    '#nour-welcome .nw-bar{display:flex;align-items:center;gap:14px;padding:12px 18px;flex-wrap:wrap}#nour-welcome .nw-bar img{width:42px;height:42px;border-radius:50%;object-fit:cover}#nour-welcome .nw-bar span{flex:1;min-width:160px;font-weight:600}' +
    '@media(max-width:720px){#nour-welcome .nw-hero{grid-template-columns:1fr}#nour-welcome .nw-face{order:-1;padding:22px 22px 60px}#nour-welcome .nw-copy{padding:24px 20px}#nour-welcome .nw-vid{padding:16px 16px 6px}#nour-welcome .nw-help{padding:24px 16px 6px}#nour-welcome .nw-ai{margin:14px 16px 22px}#nour-welcome .nw-btns>*{flex:1 1 140px}}'

  var CATS = [
    ['HR Questions', 'Policies, benefits, working hours and how things work at MINDz.'],
    ['Leave & Requests', 'Check your balance, prepare leave and other requests, and follow their status.'],
    ['Onboarding & Employment', 'Joining steps, documents, contract and probation dates, your employment record.'],
    ['Performance & Development', 'Training, goals, check-ins and growth opportunities.'],
    ['Workplace Support', 'Raise a concern or a suggestion. NOUR helps you reach the right person.'],
    ['Reminders & Follow-ups', 'Tasks, deadlines and follow-ups, so nothing slips.'],
    ['Company Information', 'People, policies and useful information about MINDz.']
  ]

  function build() {
    var st = state.status || {}, preview = !st.published && st.can_preview
    var sec = h('section', { id: ID, 'aria-labelledby': 'nw-h' })
    var ribbon = preview ? h('div', { class: 'nw-ribbon', role: 'note' }, 'PREVIEW. Only you can see this. Employees do not see it until you publish it in NOUR, Control.') : null
    if (ribbon) sec.appendChild(ribbon)
    var base = 'nour/'
    if (!state.expanded) {
      sec.appendChild(h('div', { class: 'nw-bar' }, h('img', { src: base + 'nour-portrait.jpg', alt: '' }), h('span', {}, 'NOUR, your People & Culture Partner'),
        h('button', { class: 'nw-s', type: 'button', on: { click: function () { state.expanded = true; mark('undismiss'); rebuild() } } }, 'Show welcome'),
        h('a', { class: 'nw-btn nw-p', href: base }, 'Talk to NOUR')))
      return sec
    }
    var vidBox = h('div', { class: 'nw-vid', hidden: '' })
    var video = null
    function openVideo(play) {
      if (!video) {
        video = h('video', { controls: '', preload: 'none', playsinline: '', poster: base + 'nour-intro-poster.jpg', 'aria-label': 'NOUR introduction video, 41 seconds, with English subtitles' },
          h('source', { src: base + 'nour-intro.mp4', type: 'video/mp4' }),
          h('track', { kind: 'subtitles', srclang: 'en', label: 'English', src: base + 'nour-intro.vtt', default: '' }),
          'Your browser cannot play this video.')
        video.addEventListener('play', function () { mark('video_seen') })
        vidBox.appendChild(video)
        vidBox.appendChild(h('p', { class: 'nw-note' }, 'This introduction is a silent video with English captions. Use the player controls to pause, replay or turn captions on or off.'))
      }
      vidBox.hidden = false
      if (play) { try { video.play() } catch (e) { /* user can press play */ } }
      try { vidBox.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) } catch (e) { /* ignore */ }
    }
    var meet = h('button', { class: 'nw-p', type: 'button', on: { click: function () { openVideo(true) } } }, 'Meet NOUR')
    var talk = h('a', { class: 'nw-btn nw-s', href: base }, 'Talk to NOUR')
    var hide = h('button', { class: 'nw-q', type: 'button', on: { click: function () { state.expanded = false; mark('dismiss'); rebuild() } } }, 'Hide this for now')
    sec.appendChild(h('div', { class: 'nw-hero' },
      h('div', { class: 'nw-copy' }, h('div', { class: 'nw-eyebrow' }, 'New at MINDz'),
        h('h2', { id: 'nw-h' }, 'Meet NOUR — Your People & Culture Partner'),
        h('p', { class: 'nw-sub' }, 'Your AI-powered HR companion, here to make your work experience at MINDz easier.'),
        h('div', { class: 'nw-btns' }, meet, talk, hide)),
      h('div', { class: 'nw-face' }, h('img', { src: base + 'nour-portrait.jpg', alt: 'NOUR, MINDz AI People and Culture partner', width: '260', height: '260' }), h('div', { class: 'nw-tag' }, h('b', {}, 'NOUR'), ' · AI assistant'))))
    sec.appendChild(vidBox)
    var grid = h('div', { class: 'nw-grid' })
    CATS.forEach(function (c, i) { grid.appendChild(h('div', { class: 'nw-c' }, h('b', {}, h('i', { 'aria-hidden': 'true' }, String(i + 1)), c[0]), h('span', {}, c[1]))) })
    sec.appendChild(h('div', { class: 'nw-help' }, h('h3', {}, 'What can NOUR help you with?'), grid))
    sec.appendChild(h('div', { class: 'nw-ai', role: 'note' }, h('b', {}, 'NOUR is an AI assistant. '), 'She can provide information, prepare requests and coordinate workflows. She cannot independently make final decisions about hiring, dismissal, salary changes, promotions or disciplinary action. Those decisions always stay with management.'))
    return sec
  }
  function rebuild() { var o = document.getElementById(ID); if (o) { var n = build(); o.parentNode.replaceChild(n, o) } }

  var raf = 0
  function ensure() {
    var st = state.status, cur = document.getElementById(ID)
    var show = !!st && (st.published || st.can_preview) && !!token()
    var anchor = document.querySelector('.home-block')
    if (!show || !anchor) { if (cur && !anchor) cur.remove(); if (cur && !show) cur.remove(); return }
    if (cur && cur.nextElementSibling === anchor) return
    if (cur) cur.remove()
    anchor.parentNode.insertBefore(build(), anchor)
  }
  function tick() {
    if (!document.querySelector('.home-block')) { var c = document.getElementById(ID); if (c) c.remove(); return }
    if (!document.getElementById(ID)) load()
    ensure()
  }
  var style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style)
  new MutationObserver(function () { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; tick() }) }).observe(document.body, { childList: true, subtree: true })
  window.addEventListener('hashchange', function () { state.at = 0; tick() })
  tick()
})()
