(function () {
  'use strict'
  var C = window.__MINDZ_CONFIG || {}, app = document.getElementById('app')
  var sb, me, ws, isDir = false, isHR = false, isHandler = false, settings = {}, names = {}, roles = {}, welcome = {}, tab = 'chat', chat = [], busy = false

  function h(tag, attrs) {
    var e = document.createElement(tag), a = attrs || {}
    for (var k in a) { if (k === 'class') e.className = a[k]; else if (k === 'on') { for (var ev in a.on) e.addEventListener(ev, a.on[ev]) } else if (k === 'value') e.value = a[k]; else e.setAttribute(k, a[k]) }
    function add(c) {
      if (c == null || c === false) return
      if (Array.isArray(c)) { c.forEach(add); return }
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c)
    }
    for (var i = 2; i < arguments.length; i++) add(arguments[i])
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
    var rl = await sb.from('workspace_members').select('user_id,role').eq('workspace_id', ws)
    ;(rl.data || []).forEach(function (r) { roles[r.user_id] = r.role })
    // handler = the Director (ordinary cases) or the independent contact (cases involving the Director). HR admins are not handlers.
    isHandler = isDir || (!!settings.escalation_contact && settings.escalation_contact === me.id && roles[me.id] !== 'director')
    var wl = await sb.rpc('nour_welcome_status', { p_ws: ws }); welcome = wl.data || {}
    render()
  }

  var TABS = function () {
    var t = [['chat', 'NOUR Live'], ['me', 'My HR'], ['life', 'My tasks'], ['concern', 'Confidential']]
    if (isHR) t.push(['approvals', 'Approvals'], ['team', 'Team'], ['people', 'Lifecycle'])
    if (isHandler) t.splice(4, 0, ['cases', 'Cases'])
    if (isDir) t.push(['admin', 'Control'])
    return t
  }

  function render() {
    clear(app)
    app.appendChild(h('header', {}, h('span', { class: 'logo' }, 'NOUR'), h('div', {}, h('div', { class: 'ttl' }, 'AI People & Culture Partner'), h('div', { class: 'sub' }, 'MINDz · ' + nm(me.id))), h('a', { href: '../' }, 'Z Cloud')))
    var nav = h('nav', {})
    TABS().forEach(function (t) { var b = h('button', { class: tab === t[0] ? 'on' : '', on: { click: function () { tab = t[0]; render() } } }, t[1]); nav.appendChild(b) })
    app.appendChild(nav)
    var main = h('main', {}); app.appendChild(main)
    if (!settings.enabled) main.appendChild(msg('err', 'NOUR is switched off for this workspace.'))
    else if (settings.paused) main.appendChild(msg('err', 'NOUR is paused by the Director. Data is visible, new AI actions are blocked.'))
    ;({ chat: vChat, me: vMe, concern: vConcern, approvals: vApprovals, cases: vCases, team: vTeam, life: vMyLife, people: vPeople, admin: vAdmin })[tab](main)
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

  var GREETING = 'أهلاً بيك في MINDz! أنا NOUR، مساعدتك الذكية في كل ما يخص الـ HR وتجربتك في الشركة.\n\nتقدر تسألني عن الإجازات، الحضور، طلباتك، المهام، التدريب، وسياسات الشركة.\n\nولو عندك أي مشكلة أو اقتراح، تقدر تتكلم معايا، وأنا هساعدك توصل للجهة المناسبة.\n\nتحب أساعدك في إيه النهارده؟'
  function firstGreeting() {
    // shown once per person; the Director previewing before publication is not marked as greeted
    if (welcome.greeted || chat.length) return
    chat.push({ role: 'assistant', content: GREETING, sys: false })
    if (!(isDir && !welcome.published)) { welcome.greeted = true; sb.rpc('nour_welcome_mark', { p_ws: ws, p_what: 'greeted' }) }
  }
  function vChat(main) {
    firstGreeting()
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
  var NOTICE_EN = 'Concerns and complaints sent through this channel go to Amir, the Managing Director, as the designated recipient. Other employees and HR administrators cannot see them. Information may be shared only when necessary for authorised follow-up, safety or legal obligations. We cannot promise absolute confidentiality. If your concern is about Amir personally, or he has a direct conflict of interest, it is NOT sent to him: it goes to an independent contact.'
  var NOTICE_AR = 'أي شكوى أو ملاحظة بتبعتها من هنا بتوصل لأمير، المدير العام، باعتباره الجهة المخصصة لاستلامها. الموظفين التانيين ومسؤولي الـ HR مش بيشوفوها. المعلومات ممكن تتشارك بس لو ده ضروري للمتابعة المصرح بيها أو لحماية السلامة أو لالتزام قانوني. مش بنقدر نوعد بسرية مطلقة. لو الموضوع بخص أمير شخصياً أو عنده تعارض مصالح مباشر، الشكوى مش بتتبعتله، وبتروح لجهة مستقلة.'
  function privacyNotice(d) {
    var box = h('div', { class: 'card notice' }, h('h3', {}, 'How your concern is handled'), h('p', { dir: 'auto' }, NOTICE_EN), h('p', { dir: 'rtl' }, NOTICE_AR))
    box.appendChild(h('p', { class: d.independent_ready ? 'mut' : 'warnline', dir: 'auto' }, d.independent_ready ? 'The independent route is available.' : 'The independent route is not available yet. A concern about Amir or a conflict of interest cannot be sent to him. It would be held securely, and nobody could see it until the independent contact is set.'))
    return box
  }
  async function vConcern(main) {
    var cs = await sb.rpc('nour_complaints_status', { p_ws: ws }), d = cs.data || {}
    main.appendChild(privacyNotice(d))
    if (cs.error || !d.active) main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Confidential concerns'), h('div', { dir: 'auto' }, 'This channel is not open yet. Until it opens, please speak to the Director or HR directly. Nothing you type here is sent or stored.')))
    else vConcernForm(main, d)
    await myCases(main)
  }
  function vConcernForm(main, d) {
    var cats = ['workplace_concern', 'conflict', 'unfair_treatment', 'harassment', 'bullying', 'discrimination', 'workload', 'management', 'communication', 'safety']
    var sel = h('select', {}), sum = h('textarea', { dir: 'auto', maxlength: '4000', placeholder: 'Tell NOUR what happened, in your own words.' }), urg = h('input', { type: 'checkbox', style: 'width:auto' }), out = h('div', {}), btn = h('button', { class: 'p' }, 'Send privately')
    var rNo = h('input', { type: 'radio', name: 'conf', value: 'no', style: 'width:auto' }), rYes = h('input', { type: 'radio', name: 'conf', value: 'yes', style: 'width:auto' })
    cats.forEach(function (c) { sel.appendChild(h('option', { value: c }, c.replace(/_/g, ' '))) })
    async function send(involves, confirmNo) {
      btn.disabled = true
      var r = await sb.rpc('nour_case_open', { p_ws: ws, p_category: sel.value, p_summary: sum.value.trim(), p_urgent: urg.checked, p_involves_leadership: involves, p_confirm_not_conflict: !!confirmNo })
      btn.disabled = false; clear(out)
      if (r.error && /DIRECTOR_NAME_MENTIONED/.test(r.error.message)) {
        out.appendChild(h('div', { class: 'err', dir: 'auto' }, 'You mention Amir. Does this concern him personally, or is it a matter where he has a direct conflict of interest?',
          h('div', { class: 'row', style: 'margin-top:8px' },
            h('button', { class: 'd', on: { click: function () { send(true, false) } } }, 'Yes, it concerns him'),
            h('button', { class: 's', on: { click: function () { send(false, true) } } }, 'No, it does not'))))
        return
      }
      if (r.error) { out.appendChild(msg('err', 'Could not open the case: ' + r.error.message.replace(/^[A-Z_]+: /, ''))); return }
      out.appendChild(msg('ok', 'Received. Case ' + r.data.code + '. ' + r.data.notice)); sum.value = ''; rNo.checked = rYes.checked = false
      setTimeout(render, 1800)
    }
    btn.addEventListener('click', function () {
      if (sum.value.trim().length < 10) { clear(out); out.appendChild(msg('err', 'Please write a little more detail.')); return }
      if (!rNo.checked && !rYes.checked) { clear(out); out.appendChild(msg('err', 'Please answer the question about Amir first.')); return }
      send(rYes.checked, false)
    })
    main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Raise a concern'),
      h('label', {}, 'Type'), sel, h('label', {}, 'What happened'), sum,
      h('label', { class: 'row' }, urg, 'It is urgent or about safety'),
      h('div', { class: 'q' }, h('b', {}, 'Does this concern Amir personally, or a matter where he has a direct conflict of interest?'),
        h('label', { class: 'row', style: 'flex-wrap:nowrap' }, rNo, 'No'), h('label', { class: 'row', style: 'flex-wrap:nowrap;align-items:flex-start' }, rYes, 'Yes. Do not send it to him.' + (d.independent_ready ? '' : ' (The independent route is not available yet; it will be held securely.)'))),
      h('div', { style: 'margin-top:10px' }, btn), h('div', { style: 'margin-top:10px' }, out)))
  }
  var ROUTE_TXT = { director: 'With the Director', independent: 'With the independent contact', held: 'Held securely: the independent route is not available yet' }
  async function myCases(main) {
    var r = await sb.from('nour_cases').select('*').eq('workspace_id', ws).eq('reporter_id', me.id).order('created_at', { ascending: false }).limit(20)
    if (r.error || !r.data.length) return
    var box = h('div', { class: 'card' }, h('h3', {}, 'My cases'), h('div', { class: 'mut' }, 'You only ever see your own cases here.'))
    for (var i = 0; i < r.data.length; i++) {
      var c = r.data[i], ev = await sb.from('nour_case_events').select('*').eq('case_id', c.id).order('at')
      var ta = h('textarea', { dir: 'auto', placeholder: 'Add a message to the case' })
      var item = h('div', { class: 'case', style: 'margin-top:10px' }, h('div', { class: 'row' }, h('b', {}, c.code), h('span', { class: 'pill warn' }, c.status), h('span', { class: 'sp' }), h('span', { class: 'mut' }, when(c.created_at))),
        h('div', { class: 'mut', dir: 'auto' }, ROUTE_TXT[c.route] || ''), c.outcome ? h('div', { dir: 'auto' }, h('b', {}, 'Outcome: '), c.outcome) : null)
      ;(ev.data || []).forEach(function (e) { if (e.kind === 'opened' || !e.body) return; item.appendChild(h('div', { class: 'mut', dir: 'auto', style: 'margin-top:4px' }, when(e.at) + ' · ' + (e.actor_id ? (e.actor_id === me.id ? 'You' : 'Case handler') : 'NOUR') + ': ' + e.body)) })
      if (c.status !== 'closed') item.appendChild(h('div', { style: 'margin-top:6px' }, ta, h('button', { class: 's', style: 'margin-top:6px', on: { click: (function (cid, t) { return async function () { if (!t.value.trim()) return; var x = await sb.rpc('nour_case_message', { p_case: cid, p_body: t.value.trim(), p_internal: false }); if (x.error) alert(x.error.message); else render() } })(c.id, ta) } }, 'Send')))
      box.appendChild(item)
    }
    main.appendChild(box)
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

  // ---------- cases dashboard (the Director, or the independent contact for matters involving him) ----------
  var CATS = ['workplace_concern', 'conflict', 'unfair_treatment', 'harassment', 'bullying', 'discrimination', 'workload', 'management', 'communication', 'safety']
  var PRI = ['low', 'normal', 'high', 'urgent'], PRANK = { urgent: 0, high: 1, normal: 2, low: 3 }
  var caseFilter = 'open'
  function ageDays(t) { return Math.floor((Date.now() - new Date(t).getTime()) / 86400000) }
  async function vCases(main) {
    main.appendChild(h('div', { class: 'boot' }, 'Loading…'))
    var r = await sb.from('nour_cases').select('*').eq('workspace_id', ws).neq('reporter_id', me.id).order('created_at', { ascending: false }).limit(200); clear(main)
    if (r.error) { main.appendChild(msg('err', r.error.message)); return }
    var all = r.data, isOpen = function (c) { return c.status !== 'resolved' && c.status !== 'closed' }
    var open = all.filter(isOpen), oldest = open.reduce(function (m, c) { return Math.max(m, ageDays(c.created_at)) }, 0)
    function tile(n, l, bad) { return h('div', { class: 'tile' + (bad && n ? ' bad' : '') }, h('b', {}, String(n)), h('span', {}, l)) }
    main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Confidential cases'), h('div', { class: 'tiles' }, tile(open.length, 'open'), tile(open.filter(function (c) { return c.priority === 'urgent' || c.priority === 'high' }).length, 'high / urgent', true), tile(open.filter(function (c) { return c.status === 'received' }).length, 'not yet reviewed', true), tile(oldest, 'days, oldest open')),
      h('div', { class: 'mut', style: 'margin-top:8px', dir: 'auto' }, 'You see only the cases routed to you. Opening a case is recorded in its own history, never in the general log. Notes marked internal are never shown to the employee.'),
      h('div', { class: 'row', style: 'margin-top:8px' }, ['open', 'urgent', 'all'].map(function (f) { return h('button', { class: caseFilter === f ? 'p' : 's', on: { click: function () { caseFilter = f; render() } } }, f) }))))
    var list = all.filter(function (c) { return caseFilter === 'all' ? true : caseFilter === 'urgent' ? isOpen(c) && (c.priority === 'urgent' || c.priority === 'high') : isOpen(c) })
    list.sort(function (a, b) { return (PRANK[a.priority] - PRANK[b.priority]) || (new Date(a.created_at) - new Date(b.created_at)) })
    if (!list.length) main.appendChild(h('div', { class: 'card mut' }, 'No cases in this view.'))
    list.forEach(function (c) { main.appendChild(caseCard(c)) })
  }
  function caseCard(c) {
    var det = h('div', {}), opened = false
    var card = h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', {}, c.code), h('span', { class: 'pill ' + (c.priority === 'urgent' ? 'bad' : c.priority === 'high' ? 'warn' : '') }, c.priority), h('span', { class: 'pill' }, c.category.replace(/_/g, ' ')), h('span', { class: 'pill warn' }, c.status), h('span', { class: 'sp' }), c.involves_leadership ? h('span', { class: 'pill' }, 'independent') : null),
      h('div', { class: 'mut' }, nm(c.reporter_id) + ' · opened ' + when(c.created_at) + ' · ' + ageDays(c.created_at) + ' day(s) ago'), det)
    card.style.cursor = 'pointer'
    card.addEventListener('click', async function (ev) {
      if (ev.target.closest('button,select,textarea,input,label')) return
      opened = !opened; clear(det); if (!opened) return
      sb.rpc('nour_case_viewed', { p_case: c.id })
      var e2 = await sb.from('nour_case_events').select('*').eq('case_id', c.id).order('at'), a2 = await sb.from('nour_case_actions').select('*').eq('case_id', c.id).order('created_at')
      det.appendChild(h('pre', { dir: 'auto' }, c.summary))
      var tl = h('div', { class: 'hist' }, h('div', { class: 'mut' }, 'History'))
      ;(e2.data || []).forEach(function (e) { tl.appendChild(h('div', { class: 'mut', dir: 'auto', style: 'margin-top:4px' }, when(e.at) + ' · ' + (e.actor_id ? nm(e.actor_id) : 'system') + ' · ' + e.kind + (e.internal ? ' (internal)' : '') + (e.body ? ': ' + e.body : ''))) })
      det.appendChild(tl)
      // triage
      var cs = h('select', {}, CATS.map(function (x) { return h('option', { value: x }, x.replace(/_/g, ' ')) })), ps = h('select', {}, PRI.map(function (x) { return h('option', { value: x }, x) })); cs.value = c.category; ps.value = c.priority
      det.appendChild(h('div', { class: 'row', style: 'margin-top:10px' }, h('div', { class: 'sp' }, cs), ps, h('button', { class: 's', on: { click: async function () { var x = await sb.rpc('nour_case_triage', { p_case: c.id, p_category: cs.value, p_priority: ps.value }); if (x.error) alert(x.error.message); else render() } } }, 'Save triage')))
      // status
      var st = h('select', {}, ['triage', 'escalated', 'investigating', 'resolved', 'closed'].map(function (s) { return h('option', { value: s }, s) })), note = h('input', { dir: 'auto', placeholder: 'Closing note: the employee will see it (needed to resolve or close)' }); st.value = c.status === 'received' ? 'triage' : c.status
      det.appendChild(h('div', { style: 'margin-top:10px' }, note, h('div', { class: 'row', style: 'margin-top:6px' }, st, h('button', { class: 'p', on: { click: async function () { var x = await sb.rpc('nour_case_set_status', { p_case: c.id, p_status: st.value, p_note: note.value.trim() || null }); if (x.error) alert(x.error.message); else render() } } }, 'Set status'))))
      // message / internal note
      var ta = h('textarea', { dir: 'auto', placeholder: 'Reply to the employee, or write an internal note' }), internal = h('input', { type: 'checkbox', style: 'width:auto' })
      det.appendChild(h('div', { style: 'margin-top:10px' }, ta, h('div', { class: 'row', style: 'margin-top:6px' }, h('label', { class: 'row' }, internal, 'Internal note (employee cannot see it)'), h('span', { class: 'sp' }), h('button', { class: 's', on: { click: async function () { if (!ta.value.trim()) return; var x = await sb.rpc('nour_case_message', { p_case: c.id, p_body: ta.value.trim(), p_internal: internal.checked }); if (x.error) alert(x.error.message); else render() } } }, 'Save'))))
      // follow-up actions
      var acts = h('div', { style: 'margin-top:10px' }, h('div', { class: 'mut' }, 'Follow-up actions (the assignee sees only the action text, never the case)'))
      ;(a2.data || []).forEach(function (a) { acts.appendChild(h('div', { class: 'row', style: 'margin:4px 0' }, h('div', { class: 'sp', dir: 'auto' }, a.title + ' → ' + nm(a.assignee_id) + (a.due_date ? ' (due ' + a.due_date + ')' : '') + ' · ' + a.status),
        a.status === 'open' ? h('button', { class: 's', on: { click: async function () { var x = await sb.rpc('nour_case_action_set', { p_id: a.id, p_status: 'cancelled' }); if (x.error) alert(x.error.message); else render() } } }, 'Cancel') : null)) })
      var who = h('select', {}, h('option', { value: '' }, '— assign to —')); Object.keys(names).forEach(function (id) { if (id !== c.reporter_id && id !== me.id && !(c.involves_leadership && roles[id] === 'director')) who.appendChild(h('option', { value: id }, nm(id))) })
      var at = h('input', { dir: 'auto', maxlength: '200', placeholder: 'Action (do not write case details)' }), ad = h('input', { type: 'date' })
      acts.appendChild(h('div', { class: 'row', style: 'margin-top:6px' }, who, h('div', { class: 'sp' }, at), ad, h('button', { class: 's', on: { click: async function () { if (!who.value || !at.value.trim()) return; var x = await sb.rpc('nour_case_action_add', { p_case: c.id, p_assignee: who.value, p_title: at.value.trim(), p_due: ad.value || null }); if (x.error) alert(x.error.message); else render() } } }, 'Assign')))
      det.appendChild(acts)
    })
    return card
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
    members.filter(function (id) { return roles[id] !== 'director' }).forEach(function (id) { esc.appendChild(h('option', { value: id }, nm(id))) }); esc.value = settings.escalation_contact || ''
    var out = h('div', {})
    async function patch(p, label) { var x = await sb.rpc('nour_set_settings', { p_ws: ws, p_patch: p }); clear(out); if (x.error) out.appendChild(msg('err', x.error.message)); else { out.appendChild(msg('ok', label + ' saved.')); var s = await sb.from('nour_settings').select('*').eq('workspace_id', ws).maybeSingle(); settings = s.data || settings; setTimeout(render, 700) } }
    main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Control'), h('div', { class: 'row' }, h('span', { class: 'pill ' + (settings.enabled && !settings.paused ? 'ok' : 'bad') }, settings.enabled ? (settings.paused ? 'Paused' : 'Running') : 'Off'), h('span', { class: 'sp' }),
      h('button', { class: settings.paused ? 'p' : 'd', on: { click: function () { patch({ paused: !settings.paused }, settings.paused ? 'Resumed' : 'Paused') } } }, settings.paused ? 'Resume NOUR' : 'Pause NOUR')),
      h('div', { class: 'mut', style: 'margin-top:8px', dir: 'auto' }, 'Employee concerns come to you, the Director. If a concern involves you personally or you have a direct conflict of interest, it is never routed to you.'),
      h('label', {}, 'Independent contact for concerns involving the Director'), esc, h('div', { class: 'mut', dir: 'auto' }, 'Must be a Z Cloud member who is not a Director. Until one is set, such concerns are held securely and the employee is told the independent route is not available yet.'), h('div', { style: 'margin-top:8px' }, h('button', { class: 's', on: { click: function () { patch({ escalation_contact: esc.value || null }, 'Contact') } } }, 'Save contact')), h('div', { style: 'margin-top:8px' }, out)))
    var cst = await sb.rpc('nour_complaints_status', { p_ws: ws }), cd = cst.data || {}, cout = h('div', {})
    function chk(ok, t) { return h('div', { class: 'row' }, h('span', { class: 'pill ' + (ok ? 'ok' : 'bad') }, ok ? 'OK' : 'Missing'), h('span', { class: 'mut' }, t)) }
    async function setAct(v) { var x = await sb.rpc('nour_complaints_set_active', { p_ws: ws, p_active: v }); clear(cout); if (x.error) cout.appendChild(msg('err', x.error.message)); else { cout.appendChild(msg('ok', v ? 'Confidential complaints are now active.' : 'Confidential complaints are switched off.')); var s2 = await sb.from('nour_settings').select('*').eq('workspace_id', ws).maybeSingle(); settings = s2.data || settings; setTimeout(render, 700) } }
    var chkd = await sb.rpc('nour_complaints_check', { p_ws: ws }), ck = chkd.data || {}
    main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Confidential complaints'), h('div', { class: 'row' }, h('span', { class: 'pill ' + (cd.active ? 'ok' : 'bad') }, cd.active ? 'Active' : 'Not active'), h('span', { class: 'sp' }), h('button', { class: cd.active ? 'd' : 'p', on: { click: function () { setAct(!cd.active) } } }, cd.active ? 'Switch off' : 'Activate')),
      chk(!!ck.director_set, 'You are the recipient of ordinary concerns'), chk(!!ck.contact_valid, 'Independent contact set and valid (needed for concerns involving you)'),
      h('div', { class: 'mut', style: 'margin-top:6px', dir: 'auto' }, 'Without an independent contact the channel can still open, but a concern about you is held, nobody can see it, and the employee is told the route is not available. Activate only after reviewing the tests.'), h('div', { style: 'margin-top:8px' }, cout)))
    var wout = h('div', {})
    async function setWelcome(v) { var x = await sb.rpc('nour_set_settings', { p_ws: ws, p_patch: { welcome_published: v } }); clear(wout); if (x.error) wout.appendChild(msg('err', x.error.message)); else { wout.appendChild(msg('ok', v ? 'Welcome section published to all employees.' : 'Welcome section hidden from employees.')); var s3 = await sb.from('nour_settings').select('*').eq('workspace_id', ws).maybeSingle(); settings = s3.data || settings; setTimeout(render, 700) } }
    main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Welcome section on the Z Cloud home page'), h('div', { class: 'row' }, h('span', { class: 'pill ' + (settings.welcome_published ? 'ok' : 'warn') }, settings.welcome_published ? 'Visible to employees' : 'Preview only (you)'), h('span', { class: 'sp' }), h('button', { class: settings.welcome_published ? 'd' : 'p', on: { click: function () { setWelcome(!settings.welcome_published) } } }, settings.welcome_published ? 'Hide from employees' : 'Publish to employees')),
      h('div', { class: 'mut', dir: 'auto', style: 'margin-top:6px' }, 'While unpublished, only you see it on the home page, with a preview ribbon. Publishing shows it to every signed-in employee.'), h('div', { style: 'margin-top:8px' }, wout)))
    main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Automatic check-ins'), h('div', { class: 'row' }, h('span', { class: 'pill ' + (settings.checkins_enabled ? 'ok' : 'bad') }, settings.checkins_enabled ? 'On' : 'Off'), h('span', { class: 'sp' }), h('button', { class: settings.checkins_enabled ? 'd' : 'p', on: { click: function () { patch({ checkins_enabled: !settings.checkins_enabled }, 'Check-ins setting') } } }, settings.checkins_enabled ? 'Turn off' : 'Turn on')), h('div', { class: 'mut', dir: 'auto' }, 'When on, NOUR sends a 30-day and 90-day check-in to each new employee and a monthly check-in to everyone, with reminders. Answers are visible to HR and the Director. Off by default.')))
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


  // ---------- lifecycle (recruitment, contracts, onboarding, training, offboarding, check-ins) ----------
  var sub = 'recruit'
  function today() { return new Date().toISOString().slice(0, 10) }
  function fld(label, el) { return h('div', {}, h('label', {}, label), el) }
  function empSel() { var s = h('select', {}); Object.keys(names).forEach(function (id) { s.appendChild(h('option', { value: id }, nm(id))) }); return s }
  function dt(v) { return v ? String(v).slice(0, 10) : '—' }
  async function act(out, fn, args, okText) {
    var x = await sb.rpc(fn, args); clear(out)
    if (x.error) { out.appendChild(msg('err', x.error.message)); return false }
    out.appendChild(msg('ok', okText || 'Done.')); setTimeout(render, 500); return true
  }
  function btn(label, cls, fn) { return h('button', { class: cls || 's', on: { click: fn } }, label) }

  async function vMyLife(main) {
    main.appendChild(h('div', { class: 'boot' }, 'Loading…'))
    var q = await Promise.all([
      sb.from('nour_checkins').select('*').eq('workspace_id', ws).eq('user_id', me.id).order('sent_at', { ascending: false }).limit(10),
      sb.from('nour_tasks').select('*').eq('workspace_id', ws).eq('status', 'open').order('due_date', { ascending: true }).limit(100),
      sb.from('nour_training').select('*').eq('workspace_id', ws).eq('user_id', me.id).order('created_at', { ascending: false }).limit(20),
      sb.from('nour_contracts').select('*').eq('workspace_id', ws).eq('user_id', me.id).order('start_date', { ascending: false }).limit(3),
      sb.from('nour_resignations').select('*').eq('workspace_id', ws).eq('user_id', me.id).in('status', ['submitted', 'acknowledged']).limit(1)])
    clear(main)
    var chk = q[0].data || [], tasks = (q[1].data || []).filter(function (t) { return t.assignee_id === me.id || t.user_id === me.id }), tr = q[2].data || [], ct = q[3].data || [], rs = (q[4].data || [])[0]
    var pend = chk.filter(function (c) { return c.status === 'sent' })
    pend.forEach(function (c) {
      var mood = 0, out = h('div', {}), com = h('textarea', { dir: 'auto', maxlength: '1500', placeholder: 'Anything you want us to know (optional)' }), want = h('input', { type: 'checkbox', style: 'width:auto' }), row = h('div', { class: 'row' })
      for (var i = 1; i <= 5; i++) (function (n) { var b = h('button', { class: 's', on: { click: function () { mood = n; Array.prototype.forEach.call(row.children, function (x, j) { x.className = j + 1 === n ? 'p' : 's' }) } } }, String(n)); row.appendChild(b) })(i)
      main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'A check-in from NOUR'), h('div', { dir: 'auto' }, c.prompt), h('div', { class: 'mut' }, '1 = not good, 5 = great. Your answer is visible to HR and the Director.'), row, h('label', {}, 'Comment'), com,
        h('label', { class: 'row' }, want, 'I would like someone from HR to talk to me'),
        h('div', { style: 'margin-top:8px' }, btn('Send answer', 'p', function () { if (!mood) { clear(out); out.appendChild(msg('err', 'Please pick 1 to 5.')); return } act(out, 'nour_checkin_respond', { p_id: c.id, p_mood: mood, p_comment: com.value, p_wants_hr: want.checked }, 'Thank you. Your answer was sent.') })), h('div', { style: 'margin-top:8px' }, out)))
    })
    var tc = h('div', { class: 'card' }, h('h3', {}, 'My tasks'))
    if (!tasks.length) tc.appendChild(h('div', { class: 'mut' }, 'Nothing is waiting for you.'))
    tasks.forEach(function (t) {
      var late = t.due_date && t.due_date < today(), mine = t.assignee_id === me.id, out = h('span', {})
      tc.appendChild(h('div', { class: 'row', style: 'margin:6px 0' }, h('div', { style: 'flex:1', dir: 'auto' }, h('div', {}, t.title), h('div', { class: 'mut' }, (t.user_id !== me.id ? 'About ' + nm(t.user_id) + ' · ' : '') + 'due ' + dt(t.due_date))), late ? h('span', { class: 'pill bad' }, 'Overdue') : null,
        (mine && (!t.human_only || isHR)) ? btn('Done', 'p', function () { act(out, 'nour_task_complete', { p_id: t.id }, 'Marked done.') }) : null, out))
    })
    main.appendChild(tc)
    var ca = await sb.from('nour_case_actions').select('id,title,due_date,status').eq('assignee_id', me.id).eq('status', 'open').order('due_date')
    if ((ca.data || []).length) { var cc = h('div', { class: 'card' }, h('h3', {}, 'Follow-ups assigned to me'), h('div', { class: 'mut' }, 'Assigned by the Director. You only see the action, nothing else.')); ca.data.forEach(function (a) { var o2 = h('span', {}); cc.appendChild(h('div', { class: 'row', style: 'margin:6px 0' }, h('div', { style: 'flex:1', dir: 'auto' }, h('div', {}, a.title), h('div', { class: 'mut' }, 'due ' + dt(a.due_date))), btn('Done', 'p', function () { act(o2, 'nour_case_action_set', { p_id: a.id, p_status: 'done' }, 'Marked done.') }), o2)) }); main.appendChild(cc) }
    if (tr.length) { var trc = h('div', { class: 'card' }, h('h3', {}, 'My training')); tr.forEach(function (t) { var out = h('span', {}); trc.appendChild(h('div', { class: 'row', style: 'margin:6px 0' }, h('div', { style: 'flex:1', dir: 'auto' }, h('div', {}, t.title), h('div', { class: 'mut' }, (t.provider || '') + ' · due ' + dt(t.due_date))), h('span', { class: 'pill' + (t.status === 'completed' ? ' ok' : '') }, t.status.replace('_', ' ')), t.status === 'planned' ? btn('Start', 's', function () { act(out, 'nour_training_status', { p_id: t.id, p_status: 'in_progress' }) }) : null, (t.status === 'planned' || t.status === 'in_progress') ? btn('Completed', 'p', function () { act(out, 'nour_training_status', { p_id: t.id, p_status: 'completed' }) }) : null, out)) }); main.appendChild(trc) }
    if (ct.length) main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'My contract dates'), ct.map(function (c) { return h('div', { class: 'mut' }, c.contract_type.replace('_', ' ') + ' · starts ' + dt(c.start_date) + ' · ends ' + dt(c.end_date) + ' · probation ends ' + dt(c.probation_end) + ' · ' + c.status) })))
    // resignation
    var rc = h('div', { class: 'card' }, h('h3', {}, 'Resignation')), rout = h('div', {})
    if (rs) {
      rc.appendChild(h('div', { dir: 'auto' }, 'Your resignation is ' + rs.status + '. Last working day: ' + dt(rs.last_working_day) + '.'))
      rc.appendChild(h('div', { style: 'margin-top:8px' }, btn('Withdraw resignation', 'd', function () { act(rout, 'nour_resignation_withdraw', { p_id: rs.id }, 'Withdrawn.') })))
    } else {
      var ld = h('input', { type: 'date', min: today() }), rr = h('textarea', { dir: 'auto', maxlength: '2000', placeholder: 'Reason (optional, visible to HR and the Director only)' }), armed = false, sb2
      sb2 = btn('Submit resignation', 'd', function () { if (!ld.value) { clear(rout); rout.appendChild(msg('err', 'Pick your last working day.')); return } if (!armed) { armed = true; sb2.textContent = 'Tap again to confirm'; return } act(rout, 'nour_resignation_submit', { p_ws: ws, p_last_day: ld.value, p_reason: rr.value }, 'Submitted. HR will contact you.') })
      rc.appendChild(h('div', { class: 'mut', dir: 'auto' }, 'Only use this to resign formally. HR and the Director will be notified.')); rc.appendChild(fld('Last working day', ld)); rc.appendChild(fld('Reason', rr)); rc.appendChild(h('div', { style: 'margin-top:8px' }, sb2))
    }
    rc.appendChild(h('div', { style: 'margin-top:8px' }, rout)); main.appendChild(rc)
    var done = chk.filter(function (c) { return c.status === 'answered' })
    if (done.length) main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'My past check-ins'), done.map(function (c) { return h('div', { class: 'mut' }, dt(c.answered_at) + ' · mood ' + c.mood + '/5') })))
  }

  async function vPeople(main) {
    var subs = [['recruit', 'Recruitment'], ['contracts', 'Contracts'], ['tasks', 'Tasks & onboarding'], ['training', 'Training'], ['off', 'Offboarding'], ['checkins', 'Check-ins']]
    var bar = h('div', { class: 'row', style: 'flex-wrap:wrap;margin-bottom:8px' })
    subs.forEach(function (x) { bar.appendChild(btn(x[1], sub === x[0] ? 'p' : 's', function () { sub = x[0]; render() })) })
    main.appendChild(bar)
    var body = h('div', {}); main.appendChild(body); body.appendChild(h('div', { class: 'boot' }, 'Loading…'))
    await ({ recruit: pRecruit, contracts: pContracts, tasks: pTasks, training: pTraining, off: pOff, checkins: pChecks })[sub](body)
  }

  async function pRecruit(b) {
    var r = await sb.from('nour_candidates').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(100); clear(b)
    var n = h('input', { placeholder: 'Full name', maxlength: '120', dir: 'auto' }), em = h('input', { placeholder: 'Email', type: 'email' }), ph = h('input', { placeholder: 'Phone' }), po = h('input', { placeholder: 'Position', maxlength: '120', dir: 'auto' }), so = h('input', { placeholder: 'Source (LinkedIn, referral…)' }), out = h('div', {})
    b.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Add candidate'), n, em, ph, po, so, h('div', { style: 'margin-top:8px' }, btn('Add', 'p', function () { act(out, 'nour_candidate_add', { p_ws: ws, p_name: n.value, p_email: em.value, p_phone: ph.value, p_position: po.value, p_source: so.value }, 'Candidate added.') })), h('div', { style: 'margin-top:8px' }, out), h('div', { class: 'priv' }, 'Candidate data is visible to HR and the Director only. Offer and hire decisions are the Director\'s.')))
    if (r.error) { b.appendChild(msg('err', r.error.message)); return }
    var order = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn']
    order.forEach(function (st) {
      var rows = r.data.filter(function (c) { return c.stage === st }); if (!rows.length) return
      var card = h('div', { class: 'card' }, h('h3', {}, st[0].toUpperCase() + st.slice(1) + ' (' + rows.length + ')'))
      rows.forEach(function (c) {
        var o2 = h('span', {}), nx = order[order.indexOf(c.stage) + 1], closed = ['hired', 'rejected', 'withdrawn'].indexOf(c.stage) > -1, note = h('input', { placeholder: 'Note (optional)', dir: 'auto' })
        var canNext = !closed && nx && ['hired', 'rejected', 'withdrawn'].indexOf(nx) < 0 && ((nx !== 'offer') || isDir)
        var row = h('div', { style: 'margin:8px 0;border-top:1px solid var(--line);padding-top:8px' }, h('div', { dir: 'auto' }, h('b', {}, c.full_name), ' · ' + c.position + ' · ' + c.code), h('div', { class: 'mut' }, [c.email, c.phone, c.source].filter(Boolean).join(' · ')), c.notes ? h('div', { class: 'mut', dir: 'auto' }, c.notes) : null)
        if (!closed) {
          row.appendChild(note)
          var rw = h('div', { class: 'row', style: 'margin-top:6px;flex-wrap:wrap' })
          if (canNext) rw.appendChild(btn('Move to ' + nx, 'p', function () { act(o2, 'nour_candidate_set_stage', { p_id: c.id, p_stage: nx, p_note: note.value }) }))
          if (c.stage === 'offer' && isDir) rw.appendChild(btn('Mark hired (Director)', 'p', function () { act(o2, 'nour_candidate_set_stage', { p_id: c.id, p_stage: 'hired', p_note: note.value }) }))
          rw.appendChild(btn('Add note', 's', function () { act(o2, 'nour_candidate_note', { p_id: c.id, p_note: note.value }, 'Note added.') }))
          rw.appendChild(btn('Reject', 'd', function () { act(o2, 'nour_candidate_set_stage', { p_id: c.id, p_stage: 'rejected', p_note: note.value }) }))
          rw.appendChild(btn('Withdrawn', 's', function () { act(o2, 'nour_candidate_set_stage', { p_id: c.id, p_stage: 'withdrawn', p_note: note.value }) })); row.appendChild(rw)
        }
        row.appendChild(o2); card.appendChild(row)
      }); b.appendChild(card)
    })
    if (!r.data.length) b.appendChild(h('div', { class: 'card mut' }, 'No candidates yet.'))
  }

  async function pContracts(b) {
    var r = await sb.from('nour_contracts').select('*').eq('workspace_id', ws).order('start_date', { ascending: false }).limit(100); clear(b)
    var e = empSel(), ty = h('select', {}), st = h('input', { type: 'date', value: today() }), en = h('input', { type: 'date' }), pe = h('input', { type: 'date' }), no = h('input', { placeholder: 'Notes (no salary here)', maxlength: '1000', dir: 'auto' }), out = h('div', {})
    ;['probation', 'fixed_term', 'indefinite', 'internship', 'freelance', 'other'].forEach(function (t) { ty.appendChild(h('option', { value: t }, t.replace('_', ' '))) })
    b.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Record a contract'), fld('Employee', e), fld('Type', ty), fld('Start', st), fld('End (optional)', en), fld('Probation end (blank = start + probation days from Control)', pe), no,
      h('div', { style: 'margin-top:8px' }, btn('Save contract', 'p', function () { act(out, 'nour_contract_save', { p_ws: ws, p_user: e.value, p_type: ty.value, p_start: st.value, p_end: en.value || null, p_probation_end: pe.value || null, p_notes: no.value }, 'Contract recorded.') })), h('div', { style: 'margin-top:8px' }, out), h('div', { class: 'priv' }, 'Dates only. Salary and compensation are never shown or stored here. Probation outcomes are human decisions.')))
    if (r.error) { b.appendChild(msg('err', r.error.message)); return }
    var c = h('div', { class: 'card' }, h('h3', {}, 'Contracts')); if (!r.data.length) c.appendChild(h('div', { class: 'mut' }, 'None recorded yet.'))
    r.data.forEach(function (k) { var o2 = h('span', {}); c.appendChild(h('div', { class: 'row', style: 'margin:6px 0' }, h('div', { style: 'flex:1' }, h('b', {}, nm(k.user_id)), h('div', { class: 'mut' }, k.contract_type.replace('_', ' ') + ' · ' + dt(k.start_date) + ' → ' + dt(k.end_date) + ' · probation ends ' + dt(k.probation_end))), h('span', { class: 'pill' + (k.status === 'active' ? ' ok' : '') }, k.status), k.status === 'active' ? btn('End', 's', function () { act(o2, 'nour_contract_set_status', { p_id: k.id, p_status: 'ended' }) }) : null, (k.status === 'active' && isDir) ? btn('Terminated', 'd', function () { act(o2, 'nour_contract_set_status', { p_id: k.id, p_status: 'terminated' }) }) : null, o2)) })
    b.appendChild(c)
  }

  async function pTasks(b) {
    var r = await sb.from('nour_tasks').select('*').eq('workspace_id', ws).eq('status', 'open').order('due_date', { ascending: true }).limit(200); clear(b)
    var e = empSel(), out = h('div', {}), e2 = empSel(), t = h('input', { placeholder: 'Task title', maxlength: '200', dir: 'auto' }), a = empSel(), d = h('input', { type: 'date' }), ho = h('input', { type: 'checkbox', style: 'width:auto' }), o3 = h('div', {}), k = h('select', {})
    ;['other', 'document', 'onboarding', 'probation', 'training', 'offboarding', 'contract'].forEach(function (x) { k.appendChild(h('option', { value: x }, x)) }); a.value = me.id
    b.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Start onboarding'), h('div', { class: 'mut' }, 'Creates the standard checklist (documents, welcome, access, policies). Safe to repeat: nothing is duplicated.'), e, h('div', { style: 'margin-top:8px' }, btn('Start onboarding', 'p', function () { act(out, 'nour_onboarding_start', { p_ws: ws, p_user: e.value }, 'Onboarding checklist created.') })), h('div', { style: 'margin-top:8px' }, out)))
    b.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Add a task'), fld('About employee', e2), fld('Kind', k), t, fld('Assigned to', a), fld('Due', d), h('label', { class: 'row' }, ho, 'Human only (NOUR never completes it)'),
      h('div', { style: 'margin-top:8px' }, btn('Add task', 'p', function () { act(o3, 'nour_task_add', { p_ws: ws, p_user: e2.value, p_kind: k.value, p_title: t.value, p_detail: null, p_assignee: a.value, p_due: d.value || null, p_human_only: ho.checked }, 'Task added.') })), h('div', { style: 'margin-top:8px' }, o3)))
    if (r.error) { b.appendChild(msg('err', r.error.message)); return }
    var c = h('div', { class: 'card' }, h('h3', {}, 'Open tasks (' + r.data.length + ')')); if (!r.data.length) c.appendChild(h('div', { class: 'mut' }, 'No open tasks.'))
    r.data.forEach(function (x) { var o2 = h('span', {}), late = x.due_date && x.due_date < today(); c.appendChild(h('div', { style: 'margin:8px 0;border-top:1px solid var(--line);padding-top:8px' }, h('div', { dir: 'auto' }, h('b', {}, x.title)), h('div', { class: 'mut' }, 'About ' + nm(x.user_id) + ' · ' + x.kind + ' · for ' + nm(x.assignee_id) + ' · due ' + dt(x.due_date) + (x.human_only ? ' · human only' : '') + (x.escalated_at ? ' · escalated' : '')), h('div', { class: 'row', style: 'margin-top:4px' }, late ? h('span', { class: 'pill bad' }, 'Overdue') : null, btn('Done', 'p', function () { act(o2, 'nour_task_complete', { p_id: x.id }) }), btn('Cancel', 's', function () { act(o2, 'nour_task_cancel', { p_id: x.id }) }), o2))) })
    b.appendChild(c)
  }

  async function pTraining(b) {
    var r = await sb.from('nour_training').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(100); clear(b)
    var e = empSel(), t = h('input', { placeholder: 'Course / development item', maxlength: '200', dir: 'auto' }), p = h('input', { placeholder: 'Provider (optional)' }), d = h('input', { type: 'date' }), out = h('div', {})
    b.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Assign training'), fld('Employee', e), t, p, fld('Due', d), h('div', { style: 'margin-top:8px' }, btn('Assign', 'p', function () { act(out, 'nour_training_add', { p_ws: ws, p_user: e.value, p_title: t.value, p_provider: p.value, p_due: d.value || null }, 'Assigned. The employee was notified.') })), h('div', { style: 'margin-top:8px' }, out)))
    var c = h('div', { class: 'card' }, h('h3', {}, 'Training')); if (!(r.data || []).length) c.appendChild(h('div', { class: 'mut' }, 'None assigned yet.'))
    ;(r.data || []).forEach(function (x) { var o2 = h('span', {}); c.appendChild(h('div', { class: 'row', style: 'margin:6px 0' }, h('div', { style: 'flex:1', dir: 'auto' }, h('b', {}, x.title), h('div', { class: 'mut' }, nm(x.user_id) + ' · due ' + dt(x.due_date))), h('span', { class: 'pill' + (x.status === 'completed' ? ' ok' : '') }, x.status.replace('_', ' ')), (x.status === 'planned' || x.status === 'in_progress') ? btn('Cancel', 's', function () { act(o2, 'nour_training_status', { p_id: x.id, p_status: 'cancelled' }) }) : null, o2)) })
    b.appendChild(c)
  }

  async function pOff(b) {
    var r = await sb.from('nour_resignations').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(50); clear(b)
    var c = h('div', { class: 'card' }, h('h3', {}, 'Resignations and offboarding')); if (!(r.data || []).length) c.appendChild(h('div', { class: 'mut' }, 'None.'))
    ;(r.data || []).forEach(function (x) { var o2 = h('div', {}); c.appendChild(h('div', { style: 'margin:8px 0;border-top:1px solid var(--line);padding-top:8px' }, h('div', {}, h('b', {}, nm(x.user_id)), ' · ' + x.status), h('div', { class: 'mut' }, 'Submitted ' + dt(x.submitted_on) + ' · last day ' + dt(x.last_working_day)), x.reason ? h('div', { class: 'mut', dir: 'auto' }, 'Reason: ' + x.reason) : null,
      h('div', { class: 'row', style: 'margin-top:4px' }, x.status === 'submitted' ? btn('Acknowledge and start offboarding', 'p', function () { act(o2, 'nour_resignation_ack', { p_id: x.id }, 'Acknowledged. Offboarding tasks were created.') }) : null, (x.status === 'acknowledged' && isDir) ? btn('Close offboarding (Director)', 'p', function () { act(o2, 'nour_resignation_complete', { p_id: x.id }, 'Offboarding closed.') }) : null), o2)) })
    b.appendChild(c); b.appendChild(h('div', { class: 'priv' }, 'Access removal, final settlement and clearance are human-only tasks. NOUR prepares them but never executes them.'))
  }

  async function pChecks(b) {
    var r = await sb.from('nour_checkins').select('*').eq('workspace_id', ws).order('sent_at', { ascending: false }).limit(100); clear(b)
    var e = empSel(), out = h('div', {})
    b.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Send a check-in'), h('div', { class: 'mut' }, 'Automatic 30/90-day and monthly check-ins are ' + (settings.checkins_enabled ? 'ON' : 'OFF') + ' (Director setting in Control).'), e, h('div', { style: 'margin-top:8px' }, btn('Send check-in', 'p', function () { act(out, 'nour_checkin_send', { p_ws: ws, p_user: e.value }, 'Sent.') })), h('div', { style: 'margin-top:8px' }, out)))
    var c = h('div', { class: 'card' }, h('h3', {}, 'Check-ins')); if (!(r.data || []).length) c.appendChild(h('div', { class: 'mut' }, 'None yet.'))
    ;(r.data || []).forEach(function (x) { c.appendChild(h('div', { style: 'margin:6px 0;border-top:1px solid var(--line);padding-top:6px' }, h('div', {}, h('b', {}, nm(x.user_id)), ' · ' + x.kind + ' · ', h('span', { class: 'pill' + (x.status === 'answered' ? (x.mood <= 2 ? ' bad' : ' ok') : '') }, x.status === 'answered' ? 'mood ' + x.mood + '/5' : x.status)), x.comment ? h('div', { class: 'mut', dir: 'auto' }, x.comment) : null, x.wants_hr ? h('div', { class: 'mut' }, 'Asked to talk to HR') : null)) })
    b.appendChild(c)
  }

  boot().catch(function (e) { fatal('Something went wrong: ' + (e && e.message || e)) })
})()
