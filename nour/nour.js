(function () {
  'use strict'
  var C = window.__MINDZ_CONFIG || {}, app = document.getElementById('app')
  var sb, me, ws, isDir = false, isHR = false, settings = {}, names = {}, tab = 'chat', chat = [], busy = false

  function h(tag, attrs) {
    var e = document.createElement(tag), a = attrs || {}
    for (var k in a) { if (k === 'class') e.className = a[k]; else if (k === 'on') { for (var ev in a.on) e.addEventListener(ev, a.on[ev]) } else if (k === 'value') e.value = a[k]; else e.setAttribute(k, a[k]) }
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null || c === false) continue; e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c) }
    return e
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild) }
  function nm(id) { return id ? (names[id] || 'Unknown') : '—' }
  function when(t) { try { return new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) } catch (e) { return t || '' } }
  function msg(kind, text) { return h('div', { class: kind }, text) }

  function fatal(text, linkText) {
    clear(app); app.appendChild(h('main', {}, h('div', { class: 'card' }, h('h3', {}, 'NOUR'), h('p', {}, text), linkText ? h('a', { href: '../' }, linkText) : null)))
  }

  async function boot() {
    if (!C.url || !C.anonKey || !window.supabase) return fatal('Could not load. Check your connection and reload.')
    // Same origin as Z Cloud, default storage key: this reuses the signed-in session. No new login, no tokens in the URL.
    sb = window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
    var s = (await sb.auth.getSession()).data.session
    if (!s) return fatal('Please sign in to Z Cloud first, then open NOUR again.', 'Open Z Cloud')
    me = s.user
    var m = await sb.from('workspace_members').select('workspace_id,role').eq('user_id', me.id)
    if (m.error || !m.data || !m.data.length) return fatal('Your account is not part of a workspace yet.')
    ws = m.data[0].workspace_id; isDir = m.data[0].role === 'director'
    var ma = await sb.from('module_access').select('module').eq('workspace_id', ws).eq('user_id', me.id).eq('module', 'hr_admin')
    isHR = isDir || !!(ma.data && ma.data.length)
    var st = await sb.from('nour_settings').select('*').eq('workspace_id', ws).maybeSingle()
    settings = st.data || {}
    var p = await sb.from('profiles').select('id,display_name')
    ;(p.data || []).forEach(function (r) { names[r.id] = r.display_name })
    render()
  }

  var TABS = function () {
    var t = [['chat', 'NOUR Live'], ['me', 'My HR'], ['concern', 'Confidential']]
    if (isHR) t.push(['approvals', 'Approvals'], ['cases', 'Cases'], ['team', 'Team'])
    if (isDir) t.push(['admin', 'Control'])
    return t
  }

  function render() {
    clear(app)
    app.appendChild(h('header', {}, h('span', { class: 'logo' }, 'NOUR'), h('div', {}, h('div', { class: 'ttl' }, 'AI Head of HR'), h('div', { class: 'sub' }, 'MINDz · ' + nm(me.id))), h('a', { href: '../' }, 'Z Cloud')))
    var nav = h('nav', {})
    TABS().forEach(function (t) { var b = h('button', { class: tab === t[0] ? 'on' : '', on: { click: function () { tab = t[0]; render() } } }, t[1]); nav.appendChild(b) })
    app.appendChild(nav)
    var main = h('main', {}); app.appendChild(main)
    if (!settings.enabled) main.appendChild(msg('err', 'NOUR is switched off for this workspace.'))
    else if (settings.paused) main.appendChild(msg('err', 'NOUR is paused by the Director. Data is visible, new AI actions are blocked.'))
    ;({ chat: vChat, me: vMe, concern: vConcern, approvals: vApprovals, cases: vCases, team: vTeam, admin: vAdmin })[tab](main)
  }

  // ---------- NOUR live: face, voice, proactive ----------
  var L = { started: false, live: true, lang: 'ar', mute: false, state: 'idle', mouth: 0, elevenOK: null, rec: null, audio: null, ctx: null, timer: null, poll: null, seen: null, mouthT: null }
  var T = {
    ar: { hello: function (n) { return 'أهلاً يا ' + n + '، أنا نور، مديرة الموارد البشرية في مايندز. ' }, none: 'مفيش حاجة مستنية قرارك دلوقتي. كل حاجة ماشية تمام.', ask: 'تحب أبدأ بإيه؟', apps: function (n) { return n + ' موافقة مستنية قرارك' }, cases: function (n) { return n + ' شكوى أو قضية مفتوحة' }, fu: function (n) { return n + ' متابعة موعدها جه' }, leave: function (n) { return n + ' طلب إجازة مستني' }, newApp: 'في موافقة جديدة محتاجة قرارك.', newCase: 'وصلتني حالة سرية جديدة، افتح تبويب القضايا.', brainOff: 'عقلي المحادثي لسه مش متوصل، بس أقدر أقولك الملخص والموافقات والإجازات. قول ملخص أو موافقات أو إجازات.', listening: 'بسمعك…', start: 'ابدأ مع نور', empA: function (n) { return 'رصيد إجازتك السنوية ' + n + ' يوم. ' } },
    en: { hello: function (n) { return 'Hello ' + n + ', I am NOUR, the Head of HR at MINDz. ' }, none: 'Nothing is waiting for your decision right now. All is on track.', ask: 'Where shall I start?', apps: function (n) { return n + ' approval' + (n == 1 ? '' : 's') + ' waiting for your decision' }, cases: function (n) { return n + ' open case' + (n == 1 ? '' : 's') }, fu: function (n) { return n + ' follow-up' + (n == 1 ? ' is' : 's are') + ' due' }, leave: function (n) { return n + ' leave request' + (n == 1 ? '' : 's') + ' pending' }, newApp: 'A new approval needs your decision.', newCase: 'A new confidential case just arrived. Please open the Cases tab.', brainOff: 'My conversation brain is not connected yet, but I can give you the brief, approvals and leave. Say brief, approvals or leave.', listening: 'Listening…', start: 'Start NOUR', empA: function (n) { return 'Your annual leave balance is ' + n + ' days. ' } }
  }
  var firstName = function () { return (nm(me.id) || '').split(' ')[0] || '' }
  function tx() { return T[L.lang] }

  function avatarSVG() {
    var d = document.createElement('div'); d.className = 'avwrap'
    var bars = ''; for (var i = 0; i < 9; i++) bars += '<i></i>'
    d.innerHTML = '<div id="nav" class="nav" data-s="idle" role="img" aria-label="NOUR"><div class="halo"></div><img class="portrait" src="nour-portrait.jpg" alt="NOUR, Head of HR" width="512" height="512" decoding="async"></div><div id="nwave" class="wave" aria-hidden="true">' + bars + '</div>'
    return d
  }
  // The portrait cannot lip-sync (and is never faked to). Speech level drives a waveform and halo instead.
  function setMouth(o) {
    L.mouth = o
    var a = document.getElementById('nav'); if (a) a.style.setProperty('--lv', o.toFixed(2))
    var w = document.getElementById('nwave'); if (!w) return
    var k = w.children; for (var i = 0; i < k.length; i++) { var m = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + Date.now() / 140)); k[i].style.transform = 'scaleY(' + (o < 0.07 ? 0.12 : Math.max(0.15, o * m)).toFixed(2) + ')' }
  }
  function setState(s) { L.state = s; var a = document.getElementById('nav'); if (a) a.setAttribute('data-s', s); var st = document.getElementById('nst'); if (st) st.textContent = ({ idle: '', listening: tx().listening, thinking: '…', speaking: '' })[s] || '' }

  function addMsg(role, text, sys) {
    chat.push({ role: role, content: text, sys: !!sys })
    var list = document.getElementById('nlist'); if (!list) return
    list.appendChild(h('div', { class: 'm ' + (role === 'user' ? 'u' : sys ? 'sys' : 'n'), dir: 'auto' }, text)); list.scrollTop = list.scrollHeight
  }

  function pickVoice() {
    var vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [], want = L.lang === 'ar' ? 'ar' : 'en'
    var c = vs.filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf(want) === 0 })
    var pref = c.filter(function (v) { return /EG/i.test(v.lang) }).concat(c.filter(function (v) { return /female|salma|laila|hoda|zira|aria|jenny|samantha|google/i.test(v.name) }), c)
    return pref[0] || null
  }
  function stopSpeaking() { try { if (L.audio) { L.audio.pause(); L.audio = null } if (window.speechSynthesis) speechSynthesis.cancel() } catch (e) {} clearInterval(L.mouthT); setMouth(0) }
  async function speakEleven(text) {
    var tok = (await sb.auth.getSession()).data.session.access_token
    var r = await fetch(C.url + '/functions/v1/nour-voice', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, apikey: C.anonKey }, body: JSON.stringify({ text: text }) })
    if (!r.ok) throw new Error('voice ' + r.status)
    var blob = await r.blob(), url = URL.createObjectURL(blob), a = new Audio(url); L.audio = a
    var AC = window.AudioContext || window.webkitAudioContext, an = null
    try { L.ctx = L.ctx || new AC(); var src = L.ctx.createMediaElementSource(a); an = L.ctx.createAnalyser(); an.fftSize = 512; src.connect(an); an.connect(L.ctx.destination) } catch (e) { an = null }
    var buf = an ? new Uint8Array(an.frequencyBinCount) : null
    return new Promise(function (res) {
      function tick() { if (!L.audio || L.audio !== a) return; if (an) { an.getByteTimeDomainData(buf); var s = 0; for (var i = 0; i < buf.length; i++) { var v = (buf[i] - 128) / 128; s += v * v } setMouth(Math.min(1, Math.sqrt(s / buf.length) * 5)) } else setMouth(Math.random() * 0.8); requestAnimationFrame(tick) }
      a.onended = function () { URL.revokeObjectURL(url); L.audio = null; setMouth(0); res() }
      a.onerror = function () { L.audio = null; setMouth(0); res() }
      a.play().then(function () { tick() }).catch(function () { res() })
    })
  }
  function speakBrowser(text) {
    return new Promise(function (res) {
      if (!window.speechSynthesis) return res()
      var u = new SpeechSynthesisUtterance(text), v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang } else u.lang = L.lang === 'ar' ? 'ar-EG' : 'en-US'
      u.rate = 1; u.pitch = 1.05
      u.onstart = function () { clearInterval(L.mouthT); L.mouthT = setInterval(function () { setMouth(0.15 + Math.random() * 0.75) }, 110) }
      u.onend = u.onerror = function () { clearInterval(L.mouthT); setMouth(0); res() }
      var guard = setTimeout(function () { clearInterval(L.mouthT); setMouth(0); res() }, 4000 + text.length * 110)
      var done = res; res = function () { clearTimeout(guard); done() }
      speechSynthesis.speak(u)
    })
  }
  async function say(text) {
    addMsg('assistant', text)
    if (L.mute) return
    stopSpeaking(); setState('speaking')
    if (L.elevenOK !== false) { try { await speakEleven(text); L.elevenOK = true; setState('idle'); return } catch (e) { if (L.elevenOK === null) L.elevenOK = false } }
    await speakBrowser(text); setState('idle')
  }

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition
  function stopListening() { try { if (L.rec) { L.rec.onend = null; L.rec.abort() } } catch (e) {} L.rec = null; if (L.state === 'listening') setState('idle') }
  function listen() {
    if (!SR || !L.started || L.state === 'speaking' || tab !== 'chat') return
    stopListening(); stopSpeaking()
    var rc = new SR(); L.rec = rc; rc.lang = L.lang === 'ar' ? 'ar-EG' : 'en-US'; rc.interimResults = true; rc.continuous = false
    var finalText = '', box = document.getElementById('nin')
    rc.onstart = function () { setState('listening') }
    rc.onresult = function (e) { var t = ''; for (var i = e.resultIndex; i < e.results.length; i++) { t += e.results[i][0].transcript; if (e.results[i].isFinal) finalText = t } if (box) box.value = t }
    rc.onerror = function () { setState('idle') }
    rc.onend = function () { L.rec = null; if (box) box.value = ''; setState('idle'); if (finalText.trim()) handle(finalText.trim()); else if (L.live && L.started && tab === 'chat') setTimeout(listen, 700) }
    try { rc.start() } catch (e) { setState('idle') }
  }

  async function gather() {
    var today = new Date().toISOString().slice(0, 10), o = { apps: 0, cases: 0, fu: 0, leave: 0, bal: null }
    if (isHR) {
      var a = await sb.from('nour_approvals').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).eq('status', 'PENDING_APPROVAL'); o.apps = a.count || 0
      var c = await sb.from('nour_cases').select('id,status', { count: 'exact' }).eq('workspace_id', ws).in('status', ['received', 'triage', 'escalated', 'investigating']); o.cases = c.count || 0
      var f = await sb.from('nour_followups').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).eq('status', 'open').lte('due_date', today); o.fu = f.count || 0
      var l = await sb.from('hr_leave_requests').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).eq('status', 'pending'); o.leave = l.error ? 0 : (l.count || 0)
    }
    var ctx = await sb.rpc('nour_employee_context', { p_ws: ws, p_user: me.id })
    if (!ctx.error && ctx.data) { o.ctx = ctx.data; var an = (ctx.data.leave_balances || []).filter(function (b) { return /annual/i.test(b.name) })[0]; if (an && an.remaining != null) o.bal = an.remaining }
    return o
  }
  function briefText(o) {
    var t = tx(), parts = []
    if (o.apps) parts.push(t.apps(o.apps)); if (o.cases) parts.push(t.cases(o.cases)); if (o.fu) parts.push(t.fu(o.fu)); if (o.leave) parts.push(t.leave(o.leave))
    var s = t.hello(firstName())
    if (isHR) s += parts.length ? (L.lang === 'ar' ? 'النهارده عندك: ' : 'Today you have: ') + parts.join(L.lang === 'ar' ? '، و' : ', ') + '. ' + t.ask : t.none
    else s += (o.bal != null ? t.empA(o.bal) : '') + (L.lang === 'ar' ? 'لو محتاج أي حاجة قولي.' : 'Tell me if you need anything.')
    return s
  }
  async function briefing() { setState('thinking'); var o = await gather(); L.seen = { apps: o.apps, cases: o.cases }; L.last = o; await say(briefText(o)); if (L.live) listen() }

  var LOCAL = [[/ملخص|النهارده|brief|today|summary/i, 'brief'], [/موافق|approv/i, 'apps'], [/شكو|قضي|قضا|حال|case|complain|concern/i, 'cases'], [/اجاز|إجاز|رصيد|leave|balance/i, 'leave']]
  async function local(text) {
    var k = null; LOCAL.forEach(function (p) { if (!k && p[0].test(text)) k = p[1] })
    var o = L.last || await gather(), t = tx(), ar = L.lang === 'ar'
    if (k === 'brief') { await briefing(); return true }
    if (k === 'apps') { var r = await sb.from('nour_approvals').select('code,action_type,status').eq('workspace_id', ws).eq('status', 'PENDING_APPROVAL').limit(5); var rows = r.data || []
      await say(rows.length ? (ar ? 'الموافقات المستنية: ' : 'Waiting approvals: ') + rows.map(function (x) { return x.code + ' ' + x.action_type.replace(/_/g, ' ') }).join(ar ? '، ' : ', ') + (ar ? '. افتح تبويب الموافقات عشان تقرر.' : '. Open the Approvals tab to decide.') : (ar ? 'مفيش موافقات مستنية.' : 'No approvals waiting.')); return true }
    if (k === 'cases') { await say(o.cases ? t.cases(o.cases) + (ar ? '. افتح تبويب القضايا.' : '. Open the Cases tab.') : (ar ? 'مفيش قضايا مفتوحة.' : 'No open cases.')); return true }
    if (k === 'leave') { var b = (o.ctx && o.ctx.leave_balances || []).filter(function (x) { return x.remaining != null }); await say(b.length ? b.map(function (x) { return x.name + ': ' + x.remaining }).join(ar ? '، ' : ', ') : (ar ? 'مفيش رصيد مسجل.' : 'No balance recorded.')); return true }
    return false
  }

  async function handle(text) {
    if (busy) return; busy = true; stopListening(); stopSpeaking()
    addMsg('user', text); setState('thinking')
    try {
      var tok = (await sb.auth.getSession()).data.session.access_token
      var r = await fetch(C.url + '/functions/v1/nour-chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, apikey: C.anonKey }, body: JSON.stringify({ workspace_id: ws, messages: chat.filter(function (c) { return !c.sys }).slice(-20).map(function (c) { return { role: c.role, content: c.content } }) }) })
      var j = await r.json().catch(function () { return {} })
      if (r.ok && j.reply) { busy = false; await say(j.reply) }
      else if (j.error === 'brain_offline') { busy = false; chat.pop(); chat.push({ role: 'user', content: text }); if (!(await local(text))) await say(tx().brainOff) }
      else { busy = false; await say(j.message || (L.lang === 'ar' ? 'حصلت مشكلة، جرب تاني.' : 'Something went wrong, please try again.')) }
    } catch (e) { busy = false; await say(L.lang === 'ar' ? 'في مشكلة في الشبكة.' : 'Network problem.') }
    busy = false; setState('idle'); if (L.live && L.started && tab === 'chat') setTimeout(listen, 500)
  }

  // proactive: while NOUR is open she watches for new items and speaks up on her own
  function startWatch() {
    clearInterval(L.poll)
    L.poll = setInterval(async function () {
      if (!L.started || document.hidden || busy || L.state === 'speaking' || !isHR) return
      var o = await gather(); var prev = L.seen || { apps: 0, cases: 0 }; L.last = o
      if (o.apps > prev.apps) { L.seen = { apps: o.apps, cases: o.cases }; await say(tx().newApp) }
      else if (o.cases > prev.cases) { L.seen = { apps: o.apps, cases: o.cases }; await say(tx().newCase) }
      else L.seen = { apps: o.apps, cases: o.cases }
    }, 60000)
  }

  function vChat(main) {
    var wrap = h('div', { class: 'live' }), av = avatarSVG()
    var st = h('div', { id: 'nst', class: 'nst' }), list = h('div', { id: 'nlist', class: 'msgs' })
    var inp = h('textarea', { id: 'nin', dir: 'auto', placeholder: L.lang === 'ar' ? 'اكتب أو اتكلم…' : 'Type or speak…', maxlength: '2000' })
    var send = h('button', { class: 'p' }, L.lang === 'ar' ? 'إرسال' : 'Send')
    var mic = h('button', { class: 's', title: 'Mic' }, '🎙'), live = h('button', { class: 's' }, L.live ? 'Live: on' : 'Live: off'), lang = h('button', { class: 's' }, L.lang === 'ar' ? 'عربي' : 'EN'), mute = h('button', { class: 's' }, L.mute ? 'Voice: off' : 'Voice: on')
    var start = h('button', { class: 'p big' }, tx().start)
    chat.forEach(function (c) { list.appendChild(h('div', { class: 'm ' + (c.role === 'user' ? 'u' : c.sys ? 'sys' : 'n'), dir: 'auto' }, c.content)) })
    function go() { var t = inp.value.trim(); if (!t) return; inp.value = ''; if (!L.started) { L.started = true; startWatch() } handle(t) }
    send.addEventListener('click', go); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go() } })
    mic.addEventListener('click', function () { if (!SR) { addMsg('assistant', 'This browser has no voice input. Use Chrome or Edge.', true); return } L.started = true; startWatch(); if (L.state === 'listening') stopListening(); else listen() })
    live.addEventListener('click', function () { L.live = !L.live; live.textContent = L.live ? 'Live: on' : 'Live: off'; if (L.live) listen(); else stopListening() })
    lang.addEventListener('click', function () { L.lang = L.lang === 'ar' ? 'en' : 'ar'; stopListening(); stopSpeaking(); render() })
    mute.addEventListener('click', function () { L.mute = !L.mute; mute.textContent = L.mute ? 'Voice: off' : 'Voice: on'; if (L.mute) stopSpeaking() })
    start.addEventListener('click', function () { L.started = true; start.parentNode.style.display = 'none'; startWatch(); briefing() })
    wrap.appendChild(av); wrap.appendChild(st)
    if (!L.started) wrap.appendChild(h('div', { class: 'center' }, start, h('div', { class: 'priv' }, 'One tap lets the browser play her voice. After that she talks on her own.')))
    wrap.appendChild(list)
    wrap.appendChild(h('div', { class: 'row ctl' }, mic, live, lang, mute))
    wrap.appendChild(h('div', { class: 'compose' }, inp, send))
    wrap.appendChild(h('div', { class: 'priv' }, 'Chats are not stored. Actions NOUR takes are logged. She never approves or executes anything for you.'))
    main.appendChild(wrap); setState(L.state); setMouth(0); setTimeout(function () { list.scrollTop = list.scrollHeight }, 0)
  }

  // ---------- my HR ----------
  async function vMe(main) {
    main.appendChild(h('div', { class: 'boot' }, 'Loading…'))
    var r = await sb.rpc('nour_employee_context', { p_ws: ws, p_user: me.id }); clear(main)
    if (r.error) { main.appendChild(msg('err', 'Could not load your HR file: ' + r.error.message)); return }
    var c = r.data || {}
    main.appendChild(h('div', { class: 'card' }, h('h3', {}, c.name || nm(me.id)), h('div', { class: 'mut' }, [c.job_title, c.department, c.status].filter(Boolean).join(' · ')), c.hire_date ? h('div', { class: 'mut' }, 'Joined ' + c.hire_date) : null))
    var lb = h('div', { class: 'kv' })
    ;(c.leave_balances || []).forEach(function (b) { lb.appendChild(h('div', {}, b.name)); lb.appendChild(h('div', {}, b.remaining == null ? 'n/a' : b.remaining + ' day' + (b.remaining == 1 ? '' : 's') + (b.pending ? ' (' + b.pending + ' pending)' : ''))) })
    main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Leave balances'), lb))
    var fu = await sb.from('nour_followups').select('id,title,detail,due_date,status').eq('workspace_id', ws).eq('user_id', me.id).eq('status', 'open').order('due_date')
    var card = h('div', { class: 'card' }, h('h3', {}, 'My follow-ups'))
    if (!(fu.data || []).length) card.appendChild(h('div', { class: 'mut' }, 'Nothing open.'))
    ;(fu.data || []).forEach(function (f) { card.appendChild(h('div', { class: 'row', style: 'margin:6px 0' }, h('div', { class: 'sp', dir: 'auto' }, f.title, f.due_date ? h('div', { class: 'mut' }, 'Due ' + f.due_date) : null), h('button', { class: 's', on: { click: async function () { var x = await sb.rpc('nour_followup_close', { p_id: f.id, p_status: 'done' }); if (x.error) alert(x.error.message); else render() } } }, 'Done'))) })
    main.appendChild(card)
    if (c.data_gaps && c.data_gaps.length) main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Missing in your file'), h('div', { class: 'mut' }, c.data_gaps.join(', ').replace(/_/g, ' '))))
  }

  // ---------- confidential concern ----------
  async function vConcern(main) {
    var cs = await sb.rpc('nour_complaints_status', { p_ws: ws })
    if (cs.error || !cs.data || !cs.data.active) {
      main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Confidential concerns'), h('div', { dir: 'auto' }, 'This channel is not open yet. It opens once the Director has set and verified the independent contact who handles concerns about leadership.'), h('div', { class: 'mut', style: 'margin-top:8px', dir: 'auto' }, 'Until then, please speak to the Director or HR directly. Nothing you type here is sent or stored.')))
      return
    }
    vConcernForm(main)
  }
  function vConcernForm(main) {
    var cats = ['workplace_concern', 'conflict', 'unfair_treatment', 'harassment', 'bullying', 'discrimination', 'workload', 'management', 'communication', 'safety']
    var sel = h('select', {}), sum = h('textarea', { dir: 'auto', maxlength: '4000', placeholder: 'Tell NOUR what happened, in your own words.' }), urg = h('input', { type: 'checkbox', style: 'width:auto' }), lead = h('input', { type: 'checkbox', style: 'width:auto' }), out = h('div', {}), btn = h('button', { class: 'p' }, 'Send confidentially')
    cats.forEach(function (c) { sel.appendChild(h('option', { value: c }, c.replace(/_/g, ' '))) })
    btn.addEventListener('click', async function () {
      if (sum.value.trim().length < 10) { clear(out); out.appendChild(msg('err', 'Please write a little more detail.')); return }
      btn.disabled = true
      var r = await sb.rpc('nour_case_open', { p_ws: ws, p_category: sel.value, p_summary: sum.value.trim(), p_urgent: urg.checked, p_involves_leadership: lead.checked })
      btn.disabled = false; clear(out)
      if (r.error) out.appendChild(msg('err', 'Could not open the case: ' + r.error.message))
      else { out.appendChild(msg('ok', 'Received. Case ' + r.data.code + '. ' + (r.data.routing_gap ? 'It will be handled by the Director as soon as an independent contact is set.' : 'It has been routed to the right person.'))); sum.value = '' }
    })
    main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Raise a concern, confidentially'), h('div', { class: 'mut' }, 'Only the people who must handle it can see it. Concerns about leadership go to an independent contact, not to the person concerned.'),
      h('label', {}, 'Type'), sel, h('label', {}, 'What happened'), sum,
      h('label', { class: 'row' }, urg, 'It is urgent or about safety'), h('label', { class: 'row' }, lead, 'It involves someone in company leadership'), h('div', { style: 'margin-top:10px' }, btn), h('div', { style: 'margin-top:10px' }, out)))
  }

  // ---------- approvals (HR/Director) ----------
  async function vApprovals(main) {
    main.appendChild(h('div', { class: 'boot' }, 'Loading…'))
    var r = await sb.from('nour_approvals').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(50); clear(main)
    if (r.error) { main.appendChild(msg('err', r.error.message)); return }
    if (!r.data.length) main.appendChild(h('div', { class: 'card mut' }, 'No approval requests yet.'))
    r.data.forEach(function (a) {
      var pend = a.status === 'PENDING_APPROVAL', note = h('input', { placeholder: 'Decision note (optional)', dir: 'auto' })
      var card = h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', {}, a.code), h('span', { class: 'pill ' + (a.level === 'C' ? 'bad' : 'warn') }, 'Level ' + a.level), h('span', { class: 'pill' }, a.status.replace('_', ' ')), h('span', { class: 'sp' })),
        h('div', {}, a.action_type.replace(/_/g, ' ') + (a.subject_user_id ? ' · ' + nm(a.subject_user_id) : '')), h('div', { class: 'mut', dir: 'auto' }, a.reason),
        a.recommendation ? h('div', { dir: 'auto' }, h('b', {}, 'NOUR recommends: '), a.recommendation) : null,
        a.legal_notes ? h('div', { class: 'mut', dir: 'auto' }, 'Legal: ' + a.legal_notes) : null,
        h('div', { class: 'mut' }, 'Requested by ' + nm(a.requested_by) + ' · ' + when(a.created_at)))
      if (a.status === 'DRAFT' && (a.requested_by === me.id || isDir)) card.appendChild(h('button', { class: 'p', on: { click: async function () { var x = await sb.rpc('nour_submit_approval', { p_id: a.id }); if (x.error) alert(x.error.message); else render() } } }, 'Submit for approval'))
      if (pend && isDir) card.appendChild(h('div', { style: 'margin-top:8px' }, note, h('div', { class: 'row', style: 'margin-top:8px' },
        h('button', { class: 'p', on: { click: async function () { var x = await sb.rpc('nour_decide_approval', { p_id: a.id, p_decision: 'APPROVED', p_note: note.value || null }); if (x.error) alert(x.error.message); else render() } } }, 'Approve'),
        h('button', { class: 'd', on: { click: async function () { var x = await sb.rpc('nour_decide_approval', { p_id: a.id, p_decision: 'REJECTED', p_note: note.value || null }); if (x.error) alert(x.error.message); else render() } } }, 'Reject'))))
      if (a.status === 'APPROVED') card.appendChild(h('div', { class: 'mut' }, 'Approved. NOUR does not execute it. A human performs it, then marks it executed with proof.'))
      if (a.status === 'EXECUTED' || a.status === 'FAILED') card.appendChild(h('div', { class: 'pill ' + (a.execution_verified ? 'ok' : 'bad') }, a.execution_verified ? 'Executed and verified' : 'Not verified'))
      main.appendChild(card)
    })
  }

  // ---------- cases ----------
  async function vCases(main) {
    main.appendChild(h('div', { class: 'boot' }, 'Loading…'))
    var r = await sb.from('nour_cases').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(50); clear(main)
    if (r.error) { main.appendChild(msg('err', r.error.message)); return }
    if (!r.data.length) main.appendChild(h('div', { class: 'card mut' }, 'No cases you are allowed to see.'))
    r.data.forEach(function (c) {
      var det = h('div', {}), open = false
      var card = h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', {}, c.code), h('span', { class: 'pill' + (c.urgent ? ' bad' : '') }, c.category.replace(/_/g, ' ')), h('span', { class: 'pill warn' }, c.status), c.routing_gap ? h('span', { class: 'pill bad' }, 'no independent contact') : null),
        h('div', { class: 'mut' }, 'Opened ' + when(c.created_at)), det)
      card.style.cursor = 'pointer'
      card.addEventListener('click', async function (ev) {
        if (ev.target.closest('button,select,textarea,input')) return
        open = !open; clear(det); if (!open) return
        var ev2 = await sb.from('nour_case_events').select('*').eq('case_id', c.id).order('at')
        det.appendChild(h('pre', { dir: 'auto' }, c.summary))
        ;(ev2.data || []).forEach(function (e) { det.appendChild(h('div', { class: 'mut', dir: 'auto', style: 'margin-top:6px' }, when(e.at) + ' · ' + nm(e.actor_id) + ' · ' + e.kind + (e.internal ? ' (internal)' : '') + (e.body ? ': ' + e.body : ''))) })
        var ta = h('textarea', { dir: 'auto', placeholder: 'Add a message' }), st = h('select', {}, ['received', 'triage', 'escalated', 'investigating', 'resolved', 'closed'].map(function (s) { return h('option', { value: s }, s) }))
        st.value = c.status
        det.appendChild(h('div', { style: 'margin-top:8px' }, ta, h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { class: 's', on: { click: async function () { if (!ta.value.trim()) return; var x = await sb.rpc('nour_case_message', { p_case: c.id, p_body: ta.value.trim(), p_internal: false }); if (x.error) alert(x.error.message); else render() } } }, 'Send'), st,
          h('button', { class: 'p', on: { click: async function () { var x = await sb.rpc('nour_case_set_status', { p_case: c.id, p_status: st.value, p_note: null }); if (x.error) alert(x.error.message); else render() } } }, 'Set status'))))
      })
      main.appendChild(card)
    })
  }

  // ---------- team (HR) ----------
  async function vTeam(main) {
    main.appendChild(h('div', { class: 'boot' }, 'Loading…'))
    var r = await sb.from('hr_employees').select('user_id,job_title,department,status,hire_date').eq('workspace_id', ws); clear(main)
    if (r.error) { main.appendChild(msg('err', r.error.message)); return }
    var fu = await sb.from('nour_followups').select('id,user_id,title,due_date').eq('workspace_id', ws).eq('status', 'open')
    var fm = {}; (fu.data || []).forEach(function (f) { (fm[f.user_id] = fm[f.user_id] || []).push(f) })
    r.data.forEach(function (e) {
      var title = h('input', { placeholder: 'New follow-up for ' + nm(e.user_id), dir: 'auto' }), due = h('input', { type: 'date' })
      var card = h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', {}, nm(e.user_id)), h('span', { class: 'pill' }, e.status || '')), h('div', { class: 'mut' }, [e.job_title, e.department].filter(Boolean).join(' · ')))
      ;(fm[e.user_id] || []).forEach(function (f) { card.appendChild(h('div', { class: 'mut', dir: 'auto' }, '• ' + f.title + (f.due_date ? ' (due ' + f.due_date + ')' : ''))) })
      card.appendChild(h('div', { class: 'row', style: 'margin-top:8px' }, h('div', { class: 'sp' }, title), h('div', {}, due), h('button', { class: 's', on: { click: async function () { if (!title.value.trim()) return; var x = await sb.rpc('nour_followup_add', { p_ws: ws, p_user: e.user_id, p_title: title.value.trim(), p_due: due.value || null, p_detail: null, p_via_nour: false }); if (x.error) alert(x.error.message); else render() } } }, 'Add')))
      main.appendChild(card)
    })
  }

  // ---------- Director control ----------
  async function vAdmin(main) {
    main.appendChild(h('div', { class: 'boot' }, 'Loading…'))
    var jr = await sb.from('nour_job_runs').select('*').eq('workspace_id', ws).order('started_at', { ascending: false }).limit(8)
    var ac = await sb.from('nour_activity').select('*').eq('workspace_id', ws).order('at', { ascending: false }).limit(25); clear(main)
    var members = Object.keys(names), esc = h('select', {}, h('option', { value: '' }, '— not set —'))
    members.forEach(function (id) { esc.appendChild(h('option', { value: id }, nm(id))) }); esc.value = settings.escalation_contact || ''
    var out = h('div', {})
    async function patch(p, label) { var x = await sb.rpc('nour_set_settings', { p_ws: ws, p_patch: p }); clear(out); if (x.error) out.appendChild(msg('err', x.error.message)); else { out.appendChild(msg('ok', label + ' saved.')); var s = await sb.from('nour_settings').select('*').eq('workspace_id', ws).maybeSingle(); settings = s.data || settings; setTimeout(render, 700) } }
    main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Control'), h('div', { class: 'row' }, h('span', { class: 'pill ' + (settings.enabled && !settings.paused ? 'ok' : 'bad') }, settings.enabled ? (settings.paused ? 'Paused' : 'Running') : 'Off'), h('span', { class: 'sp' }),
      h('button', { class: settings.paused ? 'p' : 'd', on: { click: function () { patch({ paused: !settings.paused }, settings.paused ? 'Resumed' : 'Paused') } } }, settings.paused ? 'Resume NOUR' : 'Pause NOUR')),
      h('label', {}, 'Independent contact for complaints about leadership'), esc, h('div', { style: 'margin-top:8px' }, h('button', { class: 's', on: { click: function () { patch({ escalation_contact: esc.value || null }, 'Contact') } } }, 'Save contact')), h('div', { style: 'margin-top:8px' }, out)))
    var cst = await sb.rpc('nour_complaints_status', { p_ws: ws }), cd = cst.data || {}, cout = h('div', {})
    function chk(ok, t) { return h('div', { class: 'row' }, h('span', { class: 'pill ' + (ok ? 'ok' : 'bad') }, ok ? 'OK' : 'Missing'), h('span', { class: 'mut' }, t)) }
    async function setAct(v) { var x = await sb.rpc('nour_complaints_set_active', { p_ws: ws, p_active: v }); clear(cout); if (x.error) cout.appendChild(msg('err', x.error.message.replace(/^Cannot activate: /, 'Cannot activate: '))); else { cout.appendChild(msg('ok', v ? 'Confidential complaints are now active.' : 'Confidential complaints are switched off.')); var s2 = await sb.from('nour_settings').select('*').eq('workspace_id', ws).maybeSingle(); settings = s2.data || settings; setTimeout(render, 700) } }
    main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Confidential complaints'), h('div', { class: 'row' }, h('span', { class: 'pill ' + (cd.active ? 'ok' : 'bad') }, cd.active ? 'Active' : 'Not active'), h('span', { class: 'sp' }), h('button', { class: cd.active ? 'd' : 'p', on: { click: function () { setAct(!cd.active) } } }, cd.active ? 'Switch off' : 'Verify and activate')),
      chk(!!cd.contact_set, 'Independent contact is set'), chk(!!cd.contact_is_member, 'Contact is a workspace member'), chk(!!cd.contact_independent_of_director, 'Contact is not a Director'),
      h('div', { class: 'mut', style: 'margin-top:6px', dir: 'auto' }, 'Concerns about leadership are hidden from the Director and HR and go only to the contact. Changing the contact switches this off until you verify again.'), h('div', { style: 'margin-top:8px' }, cout)))
    var ping = h('div', { class: 'card' }, h('h3', {}, 'Integrations'), h('div', { class: 'mut' }, 'Checking…'))
    main.appendChild(ping)
    ;(async function () {
      async function p(fn, label, okt, bad) { try { var r = await sb.functions.invoke(fn, { body: { ping: true } }); var d = r.data || {}; return chk(!!d.key_present, label + ': ' + (d.key_present ? okt : bad)) } catch (e) { return chk(false, label + ': not reachable') } }
      var a = await p('nour-chat', 'AI brain', 'key present (not yet live-tested)', 'key missing, local fallback in use'), b = await p('nour-voice', 'Voice', 'key present (not yet live-tested)', 'key missing, browser voice in use')
      clear(ping); ping.appendChild(h('h3', {}, 'Integrations')); ping.appendChild(a); ping.appendChild(b)
    })()
    var c1 = h('div', { class: 'card' }, h('h3', {}, 'Daily job runs'))
    if (!(jr.data || []).length) c1.appendChild(h('div', { class: 'mut' }, 'No runs yet. First run at 06:10 UTC on the next working day.'))
    ;(jr.data || []).forEach(function (j) { c1.appendChild(h('div', { class: 'row' }, h('span', { class: 'pill ' + (j.status === 'success' || j.status === 'ok' ? 'ok' : j.status === 'failed' ? 'bad' : '') }, j.status), h('span', { class: 'mut' }, j.job_key + ' · ' + j.run_date))) })
    main.appendChild(c1)
    var c2 = h('div', { class: 'card' }, h('h3', {}, 'Activity log'))
    ;(ac.data || []).forEach(function (a) { c2.appendChild(h('div', { class: 'mut', style: 'margin:3px 0' }, when(a.at) + ' · ' + (a.via === 'nour' ? 'NOUR' : nm(a.actor_id)) + ' · ' + a.action.replace(/_/g, ' '))) })
    main.appendChild(c2)
  }

  boot().catch(function (e) { fatal('Something went wrong: ' + (e && e.message || e)) })
})()
