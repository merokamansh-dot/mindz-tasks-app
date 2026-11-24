(function () {
  'use strict'
  var C = window.__MINDZ_CONFIG || {}, EMB = (typeof __NE !== 'undefined' && __NE) || null, app = EMB ? EMB.root : document.getElementById('app')
  var sb, me, ws, isDir = false, isHR = false, isHandler = false, cstate = {}, settings = {}, names = {}, roles = {}, welcome = {}, tab = 'chat', chat = [], busy = false

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
    clear(app); app.appendChild(h('main', {}, h('div', { class: 'card' }, h('h3', {}, 'NOUR'), h('p', {}, text), linkText && !EMB ? h('a', { href: '../' }, linkText) : null)))
  }

  async function boot() {
    if (!C.url || !C.anonKey || (!EMB && !window.supabase)) return fatal('Could not load. Check your connection and reload.')
    // Same origin as Z Cloud, default storage key: this reuses the signed-in session. No new login, no tokens in the URL.
    sb = EMB ? EMB.sb : window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
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
    // handler = ONLY the designated complaints recipient (the Director, or another member the Director picks). HR admins are never handlers.
    var cs0 = await sb.rpc('nour_complaints_status', { p_ws: ws }); cstate = cs0.data || {}
    isHandler = !!cstate.is_handler
    var wl = await sb.rpc('nour_welcome_status', { p_ws: ws }); welcome = wl.data || {}
    if (EMB && EMB.mode === 'chat') { L.mute = true; L.live = false; L.started = true; render(); startWatch(); briefing(); return }
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
    if (!EMB) app.appendChild(h('header', {}, h('span', { class: 'logo' }, 'NOUR'), h('div', {}, h('div', { class: 'ttl' }, 'AI People & Culture Partner'), h('div', { class: 'sub' }, 'MINDz · ' + nm(me.id))), h('a', { href: '../' }, 'Z Cloud')))
    var nav = h('nav', {})
    TABS().forEach(function (t) { var b = h('button', { class: tab === t[0] ? 'on' : '', on: { click: function () { tab = t[0]; render() } } }, t[1]); nav.appendChild(b) })
    app.appendChild(nav)
    var main = h('main', {}); app.appendChild(main)
    if (!settings.enabled) main.appendChild(msg('err', 'NOUR is switched off for this workspace.'))
    else if (settings.paused) main.appendChild(msg('err', 'NOUR is paused by the Director. Data is visible, new AI actions are blocked.'))
    ;({ chat: vChat, me: vMe, concern: vConcern, approvals: vApprovals, cases: vCases, team: vTeam, life: vMyLife, people: vPeople, admin: vAdmin })[tab](main)
  }

  // ---------- NOUR live: face, voice, proactive ----------
  var L = { started: false, live: true, lang: 'ar', mute: false, state: 'idle', mouth: 0, elevenOK: false, rec: null, audio: null, ctx: null, timer: null, poll: null, seen: null, mouthT: null }
  var T = {
    ar: { hello: function (n) { return 'أهلاً يا ' + n + '، أنا نور، مديرة الموارد البشرية في مايندز. ' }, none: 'مفيش حاجة مستنية قرارك دلوقتي. كل حاجة ماشية تمام.', ask: 'تحب أبدأ بإيه؟', apps: function (n) { return n + ' موافقة مستنية قرارك' }, cases: function (n) { return n + ' شكوى أو قضية مفتوحة' }, fu: function (n) { return n + ' متابعة موعدها جه' }, leave: function (n) { return n + ' طلب إجازة مستني' }, newApp: 'في موافقة جديدة محتاجة قرارك.', newCase: 'وصلتني حالة سرية جديدة، افتح تبويب القضايا.', brainOff: 'عقلي المحادثي لسه مش متوصل، بس أقدر أقولك الملخص والموافقات والإجازات. قول ملخص أو موافقات أو إجازات.', listening: 'بسمعك…', start: 'ابدأ مع نور', empA: function (n) { return 'رصيد إجازتك السنوية ' + n + ' يوم. ' } },
    en: { hello: function (n) { return 'Hello ' + n + ', I am NOUR, the Head of HR at MINDz. ' }, none: 'Nothing is waiting for your decision right now. All is on track.', ask: 'Where shall I start?', apps: function (n) { return n + ' approval' + (n == 1 ? '' : 's') + ' waiting for your decision' }, cases: function (n) { return n + ' open case' + (n == 1 ? '' : 's') }, fu: function (n) { return n + ' follow-up' + (n == 1 ? ' is' : 's are') + ' due' }, leave: function (n) { return n + ' leave request' + (n == 1 ? '' : 's') + ' pending' }, newApp: 'A new approval needs your decision.', newCase: 'A new confidential case just arrived. Please open the Cases tab.', brainOff: 'My conversation brain is not connected yet, but I can give you the brief, approvals and leave. Say brief, approvals or leave.', listening: 'Listening…', start: 'Start NOUR', empA: function (n) { return 'Your annual leave balance is ' + n + ' days. ' } }
  }
  var firstName = function () { return (nm(me.id) || '').split(' ')[0] || '' }
  function tx() { return T[L.lang] }

  function avatarSVG() {
    var d = document.createElement('div'); d.className = 'avwrap'
    var bars = ''; for (var i = 0; i < 9; i++) bars += '<i></i>'
    d.innerHTML = '<div id="nav" class="nav" data-s="idle" role="img" aria-label="NOUR"><div class="halo"></div><img class="portrait" src="' + (EMB ? EMB.portrait : 'nour-portrait.jpg') + '" alt="NOUR, Head of HR" width="512" height="512" decoding="async"></div><div id="nwave" class="wave" aria-hidden="true">' + bars + '</div>'
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

  function voiceList() {
    var vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [], want = L.lang === 'ar' ? 'ar' : 'en'
    var c = vs.filter(function (v) { return v.lang && v.lang.toLowerCase().replace('_', '-').indexOf(want) === 0 })
    function sc(v) {
      var n = v.name || '', k = 0
      if (/EG/i.test(v.lang)) k += 6
      if (/natural|neural|online/i.test(n)) k += 5
      if (/salma|laila|hoda|zeina|noura|hala|amira|zira|aria|jenny|samantha|sara|female|fatima|mariam|nora/i.test(n)) k += 4
      if (/male(?!.*fe)|maged|tarik|naayf|hamed|shakir|david|mark|guy|ryan|google.*male/i.test(n) && !/female/i.test(n)) k -= 8
      if (/google/i.test(n)) k += 1
      if (v.localService === false) k += 1
      return k
    }
    var r = c.sort(function (x, y) { return sc(y) - sc(x) }), f = r.filter(function (v) { return sc(v) > -4 })
    return f.length ? f : r
  }
  var told = {}
  function notice(t) { if (told[t]) return; told[t] = 1; addMsg('assistant', t, true) }
  function pickVoice() {
    var c = voiceList(), saved = ''
    try { saved = localStorage.getItem('nour_voice_' + L.lang) || '' } catch (e) {}
    if (saved) { var m = c.filter(function (v) { return v.name === saved })[0]; if (m) return m }
    return c[0] || null
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
  function ttsOK() { return !!(window.speechSynthesis && typeof window.SpeechSynthesisUtterance !== 'undefined') }
  function speakBrowser(text) {
    return new Promise(function (res) {
      if (!ttsOK()) { notice(L.lang === 'ar' ? 'الصوت مش مدعوم في التطبيق ده، فهرد عليك كتابة. جرّب Chrome لو عايزني أتكلم.' : 'Spoken replies are not supported in this app. Try Chrome for voice.'); return res() }
      var v = pickVoice(), parts = String(text).match(/[^.!؟?\n]+[.!؟?]*/g) || [String(text)], n = 0, fin = false, began = false
      parts = parts.map(function (x) { return x.trim() }).filter(Boolean)
      function done() { if (fin) return; fin = true; clearTimeout(guard); clearTimeout(start); clearInterval(L.mouthT); setMouth(0); res() }
      var guard = setTimeout(done, 6000 + text.length * 120)
      // if nothing starts within 4 s the device has no usable voice (or blocked it): say so instead of staying silent
      var start = setTimeout(function () {
        if (began) return
        try { speechSynthesis.cancel() } catch (e) {}
        notice(L.lang === 'ar' ? 'جهازك مش بيشغّل صوت لنور. تأكد إن الصوت مش مكتوم وإن في محرك نطق عربي (Settings ← Text-to-speech). لحد ما يشتغل هرد عليك كتابة.' : 'This device is not playing her voice. Check the volume and that a text-to-speech engine with this language is installed. Replies stay in text.')
        done()
      }, 4000)
      if (!parts.length) return done()
      parts.forEach(function (t) {
        var u = new SpeechSynthesisUtterance(t); if (v) { u.voice = v; u.lang = v.lang } else u.lang = L.lang === 'ar' ? 'ar-EG' : 'en-US'
        u.rate = 0.97; u.pitch = 1.08
        u.onstart = function () { began = true; clearInterval(L.mouthT); L.mouthT = setInterval(function () { setMouth(0.15 + Math.random() * 0.75) }, 110) }
        u.onend = function () { if (++n >= parts.length) done() }
        u.onerror = function (e) { began = true; var er = e && e.error; if (er && er !== 'canceled' && er !== 'interrupted') notice((L.lang === 'ar' ? 'الصوت وقف (' : 'Voice stopped (') + er + (L.lang === 'ar' ? '). غالباً مفيش محرك نطق عربي على الجهاز.' : ').')); if (++n >= parts.length) done() }
        speechSynthesis.speak(u)
      })
    })
  }
  async function say(text) {
    addMsg('assistant', text)
    if (L.mute) return
    stopSpeaking(); setState('speaking')
    if (L.elevenOK !== false) { try { await speakEleven(text); L.elevenOK = true; setState('idle'); return } catch (e) { if (L.elevenOK === null) L.elevenOK = false } }
    await speakBrowser(text); setState('idle')
  }

  try { if (window.speechSynthesis) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = function () {} } } catch (e) {}
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition
  function stopListening() { try { if (L.rec) { L.rec.onend = null; L.rec.abort() } } catch (e) {} L.rec = null; if (L.state === 'listening') setState('idle') }
  function listen() {
    if (!SR || !L.started || L.state === 'speaking' || tab !== 'chat') return
    stopListening(); stopSpeaking()
    var rc = new SR(); L.rec = rc; rc.lang = L.lang === 'ar' ? 'ar-EG' : 'en-US'; rc.interimResults = true; rc.continuous = false
    var finalText = '', box = document.getElementById('nin')
    rc.onstart = function () { setState('listening') }
    rc.onresult = function (e) { var t = ''; for (var i = e.resultIndex; i < e.results.length; i++) { t += e.results[i][0].transcript; if (e.results[i].isFinal) finalText = t } if (box) box.value = t }
    rc.onerror = function (e) {
      setState('idle'); var er = e && e.error
      if (er === 'not-allowed' || er === 'service-not-allowed') { L.live = false; notice(L.lang === 'ar' ? 'الميكروفون مش مسموح. اسمح للتطبيق أو المتصفح بالميكروفون من إعدادات الجهاز، أو اكتب رسالتك.' : 'Microphone is blocked. Allow microphone access in your device settings, or type your message.') }
      else if (er === 'audio-capture') { L.live = false; notice(L.lang === 'ar' ? 'مش لاقية ميكروفون شغال على الجهاز.' : 'No working microphone found.') }
      else if (er === 'network' || er === 'language-not-supported') { L.live = false; notice(L.lang === 'ar' ? 'التعرف على الصوت مش متاح دلوقتي (محتاج إنترنت). اكتب رسالتك.' : 'Speech recognition is not available right now. Please type.') }
    }
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

  // Basic mode: free, private, runs in the browser with the caller's own session. Used while no external AI key is configured.
  // Z Cloud Academy knowledge (from the employee tutorial videos), searched locally; the same text is stored in nour_knowledge for the AI brain.
  var KB = [{"id":"overview","ep":"Academy","title":"What Z Cloud has","kw":["z ?cloud|زد كلاود|زيد كلاود|what.*(can|does).*z ?cloud|modules|tabs|الاقسام|الأقسام|التابات|ايه.*(في|فيه).*(z ?cloud|الابلكيشن|التطبيق)|بيعمل ايه|بتعمل ايه"],"en":"Z Cloud is MINDz's workspace. The tabs are: Home (your day at a glance), Tasks, Mail (your work mailbox), Briefs, CRM, Sales, Expenses and the MINDz HR Suite. Operations people also have the Directory with suppliers, orders and the warehouse, and the Pricing Calculator. Tell me which one you want to learn about and I will walk you through it.","ar":"Z Cloud هو مساحة الشغل بتاعة مايندز. التابات: Home (يومك بنظرة)، Tasks، Mail (إيميل الشغل)، Briefs، CRM، Sales، Expenses وMINDz HR Suite. ولناس الـOperations كمان الـDirectory (الموردين والأوردرات والمخزن) وحاسبة التسعير. قولي عايز تتعلم أنهي واحد وأنا أمشّيك فيه خطوة خطوة.","tab":"Home"},{"id":"home","ep":"Ep1 Home","title":"Home page","kw":["home","الرئيسي","الهوم","first thing","تحيه|بتحييك|greet","day at a glance","نظره"],"en":"Home is the first thing you see each morning. Z Cloud greets you by name and shows your day at a glance: four tiles (open tasks, deadlines in the next 7 days, overdue, unread alerts), your next-up task list sorted by deadline, and shortcut tiles to every module you can use: Tasks, Mail, Briefs, CRM, Sales, Expenses and the HR Suite. Your goal is simple: keep overdue at zero.","ar":"الهوم هي أول حاجة بتشوفها الصبح. Z Cloud بتسلم عليك بالاسم وبتورّيك يومك: أربع مربعات (التاسكات المفتوحة، المواعيد في الـ7 أيام الجاية، المتأخر، والتنبيهات اللي ما اتقراتش)، وتحتهم قايمة \"الجاي\" مرتبة بالديدلاين، وبعدها اختصارات لكل الأقسام اللي تقدر تستخدمها: Tasks وMail وBriefs وCRM وSales وExpenses وHR Suite. الهدف بسيط: خلي المتأخر صفر.","tab":"Home"},{"id":"home_tiles","ep":"Ep1 Home","title":"The four key numbers on Home","kw":["tiles?|مربع|كروت|الاربع|four","open tasks.*(overdue|due)","overdue|متاخر|متأخر","due in 7|7 days|سبع|٧ ايام"],"en":"The four tiles on Home show where you stand: open tasks, deadlines due in the next seven days, anything overdue, and unread alerts. If the red overdue tile is not zero, start there. Click any task in the next-up list and it opens right away.","ar":"المربعات الأربعة في الهوم بتقولك إنت فين: التاسكات المفتوحة، المواعيد في الـ7 أيام الجاية، المتأخر، والتنبيهات اللي ما اتقراتش. لو مربع المتأخر الأحمر مش صفر ابدأ بيه. وأي تاسك في قايمة \"الجاي\" بتدوس عليه بيفتح على طول.","tab":"Home"},{"id":"bell","ep":"Ep1 Home","title":"The bell and alerts","kw":["bell|جرس","alerts?|notification|تنبيه|اشعار|إشعار","mentions?","mark.*read|اقرا|مقروء"],"en":"The bell at the top is your alert centre. Assigned tasks, mentions, new mail and brief updates all land there. Open it, read what is new, and mark it as read. The number on the bell is how many alerts you have not read yet.","ar":"الجرس اللي فوق هو مركز التنبيهات بتاعك. أي تاسك اتسندلك، منشن، إيميل جديد أو تحديث في Brief بيوصل هناك. افتحه واقرا الجديد وعلّم عليه إنه اتقرا. الرقم على الجرس هو عدد التنبيهات اللي لسه ما قريتهاش.","tab":"Header"},{"id":"theme","ep":"Ep1 Home","title":"Light and dark mode","kw":["dark|light|theme|ثيم|مظلم|دارك|ليل|الوضع","sun|moon|شمس|قمر|زرار الشمس"],"en":"The sun/moon button at the top switches between light and dark mode.","ar":"زرار الشمس/القمر اللي فوق بيبدّل بين الوضع الفاتح والغامق.","tab":"Header"},{"id":"live","ep":"Ep1 Home","title":"The Live badge","kw":["live|لايف","refresh|ريفريش|تحديث تلقائي","real.?time|instantly|فوري"],"en":"The green Live badge means updates from your team appear instantly, so there is no need to refresh the page.","ar":"علامة Live الخضرا معناها إن تحديثات فريقك بتظهر فورًا، من غير ما تعمل ريفريش للصفحة.","tab":"Header"},{"id":"account","ep":"Ep1 Home","title":"Change password and Sign out","kw":["password|باسورد|باسوورد|كلمة السر|كلمه السر|الرقم السري","sign ?out|log ?out|خروج|اخرج|تسجيل الخروج","sign ?in|log ?in|دخول|ادخل|تسجيل الدخول","change password"],"en":"Your account buttons are at the top right of every page: Change password lets you set a new password, and Sign out logs you out of Z Cloud. To sign in, use your work email and password on the sign-in screen. If you forgot your password, ask the Director or HR to reset it.","ar":"أزرار حسابك فوق على اليمين في كل صفحة: Change password عشان تغيّر الباسورد، وSign out عشان تخرج من Z Cloud. للدخول استخدم إيميل الشغل والباسورد في شاشة الدخول. لو نسيت الباسورد اطلب من الدايركتور أو HR يعيّنوهولك من جديد.","tab":"Header"},{"id":"tasks","ep":"Ep2 Tasks","title":"Tasks overview","kw":["tasks?|تاسك|تاسكات|مهام|مهمه|شغل","performance chart|الاداء|الأداء|progress","on time|في ميعاده|ديدلاين|deadline"],"en":"The Tasks tab starts with tiles counting your active, pending, in-progress, completed and overdue tasks. If the red overdue tile is not zero, start there. Below it, the performance chart shows your average progress by month and how many tasks you finish on time. This feeds your performance review, so keep your progress honest.","ar":"تاب Tasks بيبدأ بمربعات بتعد تاسكاتك: النشطة، المعلّقة، الشغالة، المخلصة والمتأخرة. لو المربع الأحمر (المتأخر) مش صفر ابدأ بيه. تحته رسم الأداء بيوريك متوسط تقدمك كل شهر وكام تاسك بتخلصها في ميعادها. ده بيدخل في تقييم أدائك، فخلّي تقدمك صادق.","tab":"Tasks"},{"id":"task_new","ep":"Ep2 Tasks","title":"Create a new task","kw":["(new|create|add|make) (a |an |the )?(new )?tasks?","تاسك جديد|اضيف تاسك|اعمل تاسك|ضيف تاسك|انشئ تاسك|عمل تاسك","how.*(add|create|make).*task|ازاي.*(تاسك|مهمه)","tasks?|تاسك|مهام"],"en":"To add work: click New task, give it a clear title, choose a priority and set a deadline (tasks without deadlines are the ones that get forgotten). You can also tag teammates who work on it with you. Then press Create task and it lands on your list straight away.","ar":"عشان تضيف شغل: دوس New task، اكتب عنوان واضح، اختار الأولوية وحدد ديدلاين (التاسكات من غير ديدلاين هي اللي بتتنسي). وتقدر تعمل تاج لزمايلك اللي شغالين معاك. وبعدين دوس Create task وهتظهر في لستتك على طول.","tab":"Tasks"},{"id":"task_update","ep":"Ep2 Tasks","title":"Update, complete and archive a task","kw":["update.*task|complete|mark.*complete|finish|خلص|اكمل|اقفل","archive|ارشيف|أرشيف","progress|نسبه|نسبة|تقدم","notes?|files?|ملف|ملاحظ","rate|rating|يقيّم|تقييم المدير","tasks?|تاسك|مهام"],"en":"Open any task to update it: move the progress as you work, add notes and files, and when it is finished mark it complete. Completed tasks move to your archive, and your manager can rate them.","ar":"افتح أي تاسك عشان تحدّثه: حرّك نسبة التقدم وانت شغال، ضيف ملاحظات وملفات، ولما يخلص علّم عليه Complete. التاسكات المخلصة بتروح الأرشيف، والمدير بتاعك يقدر يقيّمها.","tab":"Tasks"},{"id":"task_search","ep":"Ep2 Tasks","title":"Search and filter tasks","kw":["search|filter|بحث|دور|فلتر|urgent|عاجل|مستعجل","tasks?|تاسك|مهام"],"en":"Use the search box and the filter chips to find any task fast. Type a client name, or tap Urgent to see only what cannot wait.","ar":"استخدم خانة البحث وأزرار الفلتر عشان تلاقي أي تاسك بسرعة. اكتب اسم عميل، أو دوس Urgent عشان تشوف بس اللي مبيستناش.","tab":"Tasks"},{"id":"briefs","ep":"Ep3 Briefs","title":"Briefs overview","kw":["briefs?|بريف|بريفات","dashboard.*stage|awaiting pricing|مراحل|مرحله","overdue.*brief|banner"],"en":"The Briefs dashboard counts your briefs by stage: draft, awaiting pricing, approved and completed. A warning banner appears when a brief is overdue. Open All Briefs to see everything you created or are tagged on, search by ID, client or keyword, and filter by status or priority.","ar":"داشبورد Briefs بيعد البريفات حسب المرحلة: مسودة، مستني تسعير، معتمد ومكتمل. لو بريف اتأخر بيظهر بانر تحذير. افتح All Briefs عشان تشوف كل اللي عملته أو اتعملك فيه تاج، وابحث بالـID أو العميل أو كلمة، وفلتر بالحالة أو الأولوية.","tab":"Briefs"},{"id":"brief_new","ep":"Ep3 Briefs","title":"Create a new brief","kw":["(new|create|add|submit|start|make|open) (a |an |the )?(new )?briefs?","بريف جديد|اعمل بريف|اقدم بريف|اضيف بريف|عمل بريف|ضيف بريف","wizard|seven.?step|7.?step|خطوات.*(بريف|brief)|(بريف|brief).*خطوات","how.*brief|ازاي.*بريف","briefs?|بريف"],"en":"To start a new brief click New Brief. It is a seven-step wizard: client, project, scope, requirements, timeline and budget, notes, and a final review. Fill each step and press Next. Your draft saves on this device as you go, so you never lose your work. The last step is a review before you submit.","ar":"عشان تبدأ بريف جديد دوس New Brief. هو ويزارد من 7 خطوات: العميل، المشروع، النطاق، المتطلبات، الجدول والميزانية، ملاحظات، وأخيرًا مراجعة. املا كل خطوة ودوس Next. المسودة بتتحفظ على جهازك وانت بتكتب فمش هتضيع منك. وآخر خطوة مراجعة قبل الإرسال.","tab":"Briefs"},{"id":"brief_detail","ep":"Ep3 Briefs","title":"Open a brief","kw":["details?|email history|linked tasks|comments?|تفاصيل|تعليق","open.*brief|افتح.*بريف","briefs?|بريف"],"en":"Open any brief from the list and you will see its details, email history, linked tasks, files and comments in one place.","ar":"افتح أي بريف من اللستة وهتلاقي تفاصيله وتاريخ الإيميلات والتاسكات المرتبطة والملفات والتعليقات كلها في مكان واحد.","tab":"Briefs"},{"id":"brief_pricing","ep":"Ep3 Briefs","title":"Request pricing or a quotation from Operations","kw":["pricing|quotation|price|سعر|تسعير|عرض سعر|كوتيشن|اسعار","operations|اوبريشن|العمليات","requests? tab|request pricing","briefs?|بريف"],"en":"Need prices from Operations? Open the brief and choose Request a quotation or Request pricing, add a short note with quantities and the deadline, and send it. Company Operations gets notified straight away. Everything you asked for is tracked under Requests, with the reply from Operations once it is handled, so check there before you chase anyone.","ar":"محتاج أسعار من الـOperations؟ افتح البريف واختار Request a quotation أو Request pricing، اكتب ملاحظة قصيرة بالكميات والديدلاين وابعت. الـOperations بيتنبّهوا فورًا. كل طلباتك بتتتابع تحت Requests ومعاها رد الـOperations لما يخلصوه، فبص هناك قبل ما تسأل حد.","tab":"Briefs"},{"id":"crm","ep":"Ep4 CRM","title":"CRM overview","kw":["crm|سي ار ام|عملاء|clients?|كلاينت","needs attention|due today|overdue follow","only you can see"],"en":"The CRM dashboard shows tiles for your clients, overdue follow-ups and what is due today. Needs Attention lists follow-ups that are late or due today: make that section empty every morning and no client is ever forgotten. Only you can see your own CRM data. Open the Clients tab for your full list.","ar":"داشبورد الـCRM فيه مربعات لعملاءك والمتابعات المتأخرة وإللي مستحقة النهارده. Needs Attention فيها المتابعات المتأخرة أو اللي ميعادها النهارده: فضّيها كل صبح ومفيش عميل هيتنسي. بيانات الـCRM بتاعتك إنت بس اللي بتشوفها. افتح تاب Clients عشان قايمة عملاءك كاملة.","tab":"CRM"},{"id":"crm_client","ep":"Ep4 CRM","title":"Add a client","kw":["(add|new|create|make) (a |an |the )?(new )?clients?","عميل جديد|اضيف عميل|ضيف عميل|اعمل عميل|اضافه عميل|اضافة عميل","export|csv|اكسبورت|تصدير","crm|clients?|follow.?ups?|leads?|عميل|عملاء|متابع"],"en":"In Clients you can search by name or company and export everything to CSV any time. To add a client click Add client, fill in the name, company and contact details, and save. Add the mobile number so you can call or message straight from the app.","ar":"في Clients تقدر تبحث بالاسم أو الشركة وتعمل Export لكل حاجة CSV في أي وقت. عشان تضيف عميل دوس Add client، اكتب الاسم والشركة وبيانات التواصل واحفظ. ضيف رقم الموبايل عشان تتصل أو تبعت رسالة من التطبيق مباشرة.","tab":"CRM"},{"id":"crm_follow","ep":"Ep4 CRM","title":"Follow-ups","kw":["follow.?ups?|متابع|اتابع|تابع|فولو","reschedule|اجل|أجل|ميعاد تاني","whatsapp|واتس|call|email|اتصل","crm|clients?|follow.?ups?|leads?|عميل|عملاء|متابع"],"en":"Open the Follow-ups tab: every follow-up shows when it is due, who it is for, and what you planned. Each row has quick buttons: Call, WhatsApp or Email the client directly. Then press Complete and note the outcome, or Reschedule if they asked for another day.","ar":"افتح تاب Follow-ups: كل متابعة بتوريك ميعادها ولمين وإنت مخطط تعمل إيه. كل صف عليه أزرار سريعة: Call أو WhatsApp أو Email للعميل مباشرة. وبعدين دوس Complete واكتب النتيجة، أو Reschedule لو العميل طلب يوم تاني.","tab":"CRM"},{"id":"crm_lead","ep":"Ep4 CRM","title":"Lead Finder, Reports and Settings","kw":["lead ?finder|ليد|leads?|عملاء جدد|عملاء محتملين","reports?|تقرير|pipeline|بايب","settings|اعدادات|إعدادات","crm|clients?|follow.?ups?|leads?|عميل|عملاء|متابع"],"en":"Lead Finder helps you find new clients: paste a list of names and companies and Z Cloud finds their phone and contact details for you. Reports shows your pipeline and activity, and Settings lets you tune your alerts.","ar":"Lead Finder بيساعدك تلاقي عملاء جدد: الصق لستة أسماء وشركات وZ Cloud بتدوّرلك على أرقامهم وبيانات التواصل. Reports بيوريك الـpipeline والنشاط، وSettings بتظبط منها التنبيهات.","tab":"CRM"},{"id":"sales","ep":"Ep5 Sales","title":"Sales tab: target and achievement","kw":["sales|مبيعات|سيلز","target|تارجت|هدف","achievement|actual|تحقيق|انجاز|إنجاز"],"en":"In Sales, first choose the month and year you want to look at, then check your monthly target. Set it once and every percentage on the page follows it. The top shows your actual sales, your achievement percentage against target and the number of deals in the period. Below, the monthly performance chart compares every month's actual sales with your target so you can see strong and weak months at a glance.","ar":"في Sales اختار الأول الشهر والسنة اللي عايز تبص عليهم، وبعدين راجع التارجت الشهري. اظبطه مرة واحدة وكل النسب في الصفحة بتمشي عليه. فوق بتشوف مبيعاتك الفعلية ونسبة تحقيقك من التارجت وعدد الصفقات في الفترة. وتحت رسم الأداء الشهري بيقارن مبيعات كل شهر بالتارجت عشان تشوف الشهور القوية والضعيفة بنظرة.","tab":"Sales"},{"id":"sales_deal","ep":"Ep5 Sales","title":"Add a deal to Sales","kw":["add deal|add to sales|new deal|deal|صفقه|صفقة|ضيف.*سيلز|اضيف.*مبيعات","accepted quotation|approved brief","export|csv","(add|new|create) (a |an |the )?(new )?deals?","sales|deals?|مبيعات|سيلز|صفقه"],"en":"Approved briefs and accepted quotations appear in lists on the Sales page. When a client confirms, press Add to Sales and the deal form is filled in for you. Check the details, adjust the value if the final price changed, and press Add deal. It now counts toward your actual sales and your achievement updates immediately. For a deal that did not come from a brief, fill in the same form yourself: client, project and value. You can also export everything to CSV.","ar":"البريفات المعتمدة وعروض الأسعار المقبولة بتظهر في لستات في صفحة Sales. لما العميل يأكد دوس Add to Sales وفورم الصفقة بيتملي لوحده. راجع التفاصيل، عدّل القيمة لو السعر النهائي اتغير، ودوس Add deal. كده الصفقة بتتحسب في مبيعاتك الفعلية ونسبة تحقيقك بتتحدث فورًا. لو الصفقة مش جاية من بريف، املا نفس الفورم بنفسك: العميل والمشروع والقيمة. وتقدر تعمل Export لكل حاجة CSV.","tab":"Sales"},{"id":"expenses","ep":"Ep6 Expenses","title":"Expenses overview","kw":["expenses?|مصروف|مصاريف|expense|فلوس","reimburse|claim|مطالب|استرداد|سلفه|سلفة"],"en":"The Expenses tab summarises the month: what you submitted, what is waiting for approval, what is approved and what has already been paid to you.","ar":"تاب Expenses بيلخّص الشهر: اللي قدّمته، اللي مستني موافقة، اللي اتعتمد، واللي اتدفعلك فعلًا.","tab":"Expenses"},{"id":"expense_new","ep":"Ep6 Expenses","title":"Submit an expense claim","kw":["(add|new|submit|create|make) (a |an |the )?(new )?expenses?|expense claim|receipt|ايصال|فاتوره|قدم.*مصروف|اضيف مصروف|ازاي.*(اقدم|اضيف|اسجل).*(مصروف|مصاريف)","expenses?|مصروف|مصاريف|claims?"],"en":"To submit a claim click Add New Expense. Choose the date and category, describe what it was for and enter the amount. Always attach the receipt: if you do not have one you will be asked to explain why, so keep every receipt. Link the expense to a project so finance knows where it belongs, then save.","ar":"عشان تقدّم مصروف دوس Add New Expense. اختار التاريخ والكاتيجوري واكتب المصروف كان لإيه وادخل المبلغ. دايمًا ارفق الإيصال: لو معندكش هيتطلب منك تشرح السبب، فاحتفظ بكل إيصال. اربط المصروف بمشروع عشان الفاينانس يعرفوه تبع مين، وبعدين احفظ.","tab":"Expenses"},{"id":"expense_status","ep":"Ep6 Expenses","title":"Expense history, statuses and rejections","kw":["history|status|pending|approved|paid|rejected|resubmit|مرفوض|اترفض|رفض|معلق|مدفوع|حاله|حالة","expenses?|مصروف|مصاريف|claims?"],"en":"My Expense History lists every claim with its status. Pending means your manager has not decided yet. Approved means it is accepted and Paid means the money is on its way to you. Press Open on any expense to see its full details, the decision and any comment from your manager. If one is rejected you can fix it and resubmit. You can filter the history by month, category, project, approval status or payment status.","ar":"My Expense History بيعرض كل مطالبة وحالتها. Pending يعني المدير لسه ما قررش. Approved يعني اتقبلت، وPaid يعني الفلوس في طريقها ليك. دوس Open على أي مصروف عشان تشوف تفاصيله والقرار وأي تعليق من المدير. لو اترفض تقدر تصلّحه وتبعته تاني. وتقدر تفلتر بالشهر أو الكاتيجوري أو المشروع أو حالة الموافقة أو حالة الدفع.","tab":"Expenses"},{"id":"hr","ep":"Ep7 HR Suite","title":"HR Suite dashboard","kw":["hr suite|اتش ار|hr dashboard|my hr|الموارد البشريه|الموارد البشرية","scorecard|dashboard","suite|سويت|what.*(can|do).*hr|بيعمل ايه.*hr"],"en":"The HR Suite dashboard is your starting point. It shows your leave balance, your goal progress, unread notifications and open requests, and big buttons take you straight to the most common actions. Salaries, documents and your profile are in the other tabs, and only you and HR can see them.","ar":"داشبورد الـHR Suite هي نقطة البداية. بتوريك رصيد إجازاتك وتقدمك في الأهداف والتنبيهات اللي ما اتقراتش والطلبات المفتوحة، وفيها أزرار كبيرة توديك على أشهر الإجراءات. المرتبات والمستندات وبروفايلك في التابات التانية، ومحدش بيشوفها غيرك وغير HR.","tab":"MINDz HR Suite"},{"id":"leave_how","ep":"Ep7 HR Suite","title":"How to request leave","kw":["how.*(request|apply|take|ask).*(leave|vacation)|ازاي.*(اجاز|إجاز)|(اطلب|اقدم|أقدم|اقدّم).*(اجاز|إجاز)|leave request|request leave|time off|steps? .*leave","hr|اجاز|leave|performance|اداء|تقييم"],"en":"To request leave in the HR Suite: go to the leave section, choose the type, pick the start and end dates, add a reason if it is needed, and submit. Your director gets notified and you will see the decision right there. The leave section also shows your balance for each type: how many days you are entitled to, how many you used and how many are left. You can also just tell me the dates here, for example: annual leave from 15-12 to 30-12, and I will prepare the request and submit it once you confirm.","ar":"عشان تطلب إجازة من الـHR Suite: ادخل على قسم الإجازات، اختار النوع، حدد تاريخ البداية والنهاية، اكتب سبب لو مطلوب، وابعت. الدايركتور بيتنبّه وهتشوف القرار هناك. وقسم الإجازات بيوريك رصيدك لكل نوع: مستحق كام يوم، استخدمت كام، وفاضل كام. وتقدر كمان تقولي التواريخ هنا، مثلاً: إجازة اعتيادية من 15-12 لـ 30-12، وأنا أجهز الطلب وأقدمه بعد ما تأكد.","tab":"MINDz HR Suite"},{"id":"hr_perf","ep":"Ep7 HR Suite","title":"Performance tracking","kw":["performance|scorecard|my score|review|rating|اداء|أداء|تقييم|اهداف|أهداف|targets? met|goal","hr|اجاز|leave|performance|اداء|تقييم"],"en":"Performance Tracking shows how you are doing: your score, your rating and how many targets you met this month. Open your scorecard to see each target, what you achieved and the result. Your latest review feedback is there as well: read it, add your comment and acknowledge it.","ar":"Performance Tracking بيوريك أداءك: السكور والتقييم وعدد التارجتس اللي حققتها الشهر ده. افتح الـscorecard عشان تشوف كل تارجت وإنت حققت كام والنتيجة. وآخر فيدباك من التقييم موجود هناك كمان: اقراه، اكتب تعليقك، وأكّد إنك اطلعت عليه.","tab":"MINDz HR Suite"},{"id":"hr_requests","ep":"Ep7 HR Suite","title":"HR Requests","kw":["hr requests?|new request|letter|document|contract|خطاب|مستند|عقد|شهاده|شهادة|طلب من hr|استفسار|سؤال.*(hr|عقد)","hr|اجاز|leave|performance|اداء|تقييم"],"en":"Need something from HR, like a letter, a document or a question about your contract? Open HR Requests, click New request, and follow it until it is answered.","ar":"محتاج حاجة من HR، زي خطاب أو مستند أو سؤال عن عقدك؟ افتح HR Requests ودوس New request وتابعه لحد ما يتردّ عليه.","tab":"MINDz HR Suite"},{"id":"hr_cal","ep":"Ep7 HR Suite","title":"Company calendar","kw":["calendar|holiday|holidays|company event|اجازه رسميه|اجازات رسميه|اجازة رسمية|تقويم|كاليندر|اجازات الشركه|إجازات الشركة|عطله|عطلة"],"en":"The Company Calendar shows holidays, company events and your approved leaves, so you can plan around them.","ar":"التقويم (Company Calendar) بيوريك الإجازات الرسمية وفعاليات الشركة وإجازاتك المعتمدة، عشان تخطط حواليهم.","tab":"MINDz HR Suite"},{"id":"hr_salary","ep":"Ep7 HR Suite","title":"Salaries and documents privacy","kw":["salary|salaries|payslip|مرتب|راتب|مرتبي|المرتبات"],"en":"Salaries, documents and your profile live in their own tabs in the HR Suite, and only you and HR can see them. I cannot share anyone else's salary details.","ar":"المرتبات والمستندات وبروفايلك في تابات خاصة جوه الـHR Suite، ومحدش بيشوفها غيرك وغير HR. ومقدرش أديك تفاصيل مرتب حد تاني.","tab":"MINDz HR Suite"},{"id":"mail","ep":"Ep8 Mail","title":"Mail folders and reading","kw":["mail|email|inbox|ايميل|إيميل|ميل|رسايل|رسائل|انبوكس","folders?|drafts?|sent|junk|trash","unread|starred|مقروء|بنجمه"],"en":"Mail is your own work mailbox inside Z Cloud. On the left are your folders: Inbox, Drafts, Sent, Junk and Trash. The number next to Inbox is how many messages you have not read, and it also shows on the Mail tab wherever you are in Z Cloud. Unread messages are in bold. Use the All, Unread and Starred filters, or search by subject or sender to find a client's email in seconds. Attachments are listed with the message and download with one click.","ar":"Mail هو صندوق إيميل الشغل بتاعك جوه Z Cloud. على الشمال الفولدرات: Inbox وDrafts وSent وJunk وTrash. الرقم جنب Inbox هو عدد الرسايل اللي ما قريتهاش، وبيظهر كمان على تاب Mail من أي مكان في Z Cloud. الرسايل الجديدة بالبولد. استخدم فلاتر All وUnread وStarred أو ابحث بالموضوع أو المرسل عشان تلاقي إيميل عميل في ثواني. المرفقات بتظهر مع الرسالة وتنزّلها بضغطة.","tab":"Mail"},{"id":"mail_send","ep":"Ep8 Mail","title":"Reply, forward and compose","kw":["reply|forward|compose|new message|send|draft|star|رد|ابعت|ارسل|أرسل|رسالة جديدة|مسوده|مسودة","mail|email|ايميل|ميل"],"en":"To respond press Reply, or Reply all to include everyone who was copied. Write your message and press Send. Forward works the same way. The message goes out from your own work address. If you are not ready to send you can discard it or keep it as a draft. Star important emails to find them again in the Starred filter, mark one as unread to come back to it later, or delete it when you are done. To start a new conversation press New message, add the recipient and subject, and write.","ar":"عشان ترد دوس Reply، أو Reply all لو عايز كل الناس اللي كانوا في النسخة. اكتب رسالتك ودوس Send. Forward بنفس الطريقة. الرسالة بتخرج من إيميل شغلك إنت. لو مش جاهز تبعت تقدر تلغيها أو تسيبها Draft. حط نجمة على الإيميلات المهمة تلاقيها في فلتر Starred، أو علّمها Unread ترجعلها بعدين، أو امسحها لما تخلص. ولبدء محادثة جديدة دوس New message وحط المستلم والموضوع واكتب.","tab":"Mail"},{"id":"ops_requests","ep":"Ops Ep3 Briefs","title":"Operations: pricing requests","kw":["awaiting ops|pricing done|handled|waiting for me|mark done|ops requests?|operations.*(request|queue|brief)","request.*sent to (me|you)"],"en":"For Operations, the Briefs dashboard shows Awaiting Ops and Awaiting Pricing cards: those briefs are waiting for you. Open the Requests tab. Under Waiting for me you see every pricing request sent to you, with the brief, who asked and their note, which carries the quantities and what needs pricing. Read it carefully before you contact suppliers, and open All Briefs for the client, services, deadline and requirements so your pricing matches the real scope. When ready, go back to Requests, click Pricing done, write a short reply with the total cost, supplier notes and what you attached to the brief, and press Mark done. It moves to Handled with your reply attached. Answer on the same day and your response time stays green. The Operations tab lists briefs waiting on operations or in production: check it every morning.","ar":"للـOperations: داشبورد Briefs فيها كروت Awaiting Ops وAwaiting Pricing، دي البريفات اللي مستنياكم. افتح تاب Requests. تحت Waiting for me هتلاقي كل طلبات التسعير المبعوتة ليك، ومعاها البريف ومين طلب وملاحظته (فيها الكميات وإيه المطلوب تسعيره). اقراها كويس قبل ما تتواصل مع الموردين، وافتح All Briefs تشوف العميل والخدمات والديدلاين والمتطلبات عشان تسعيرك يطابق النطاق الحقيقي. لما تخلص ارجع Requests ودوس Pricing done، اكتب رد قصير فيه إجمالي التكلفة وملاحظات الموردين وإيه اللي رفعته على البريف، ودوس Mark done. الطلب بيروح Handled ومعاه ردك. لو رديت في نفس اليوم وقت ردك بيفضل أخضر. وتاب Operations فيه البريفات المستنية العمليات أو في الإنتاج: راجعه كل صبح.","tab":"Briefs"},{"id":"directory","ep":"Ops Ep4 Suppliers","title":"Operations Directory (suppliers)","kw":["directory|supplier|suppliers|vendor|مورد|موردين|دليل","preferred|star|freelancer|hotel|factory|venue","suppliers?|directory|مورد"],"en":"The Operations Directory counts your records by type: active suppliers, preferred ones, freelancers, hotels, factories, production companies and venues. Recently added suppliers are listed below, and All Suppliers has the full list. The star marks your preferred suppliers, the ones you trust and call first. Use Filters to narrow the list by type, city, status or price level, so you get a shortlist in one go. Click View to see a supplier's profile: contacts, services, payment terms and notes. Edit keeps the details current and Duplicate saves time for similar records.","ar":"الـOperations Directory بتعد سجلاتك حسب النوع: موردين نشطين، المفضلين، فريلانسرز، فنادق، مصانع، شركات إنتاج وأماكن. الموردين المضافين حديثًا تحت، وAll Suppliers فيها اللستة كاملة. النجمة بتعلّم الموردين المفضلين، اللي بتثق فيهم وبتتصل بيهم الأول. استخدم Filters عشان تضيّق اللستة بالنوع أو المدينة أو الحالة أو مستوى السعر وتطلع بشورت ليست مرة واحدة. دوس View تشوف بروفايل المورد: جهات الاتصال والخدمات وشروط الدفع والملاحظات. Edit بتحدّث البيانات وDuplicate بتوفر وقت للسجلات المتشابهة.","tab":"Operations Directory"},{"id":"directory_add","ep":"Ops Ep4 Suppliers","title":"Add or manage suppliers","kw":["add supplier|new supplier|مورد جديد|اضيف مورد|أضيف مورد|categories|import|export|backup|recently deleted|settings.*(supplier|directory)|price level|payment terms","(add|new|create) (a |an |the )?(new )?suppliers?","suppliers?|directory|مورد"],"en":"To add a supplier click Add Supplier at the top, fill in the name, type, services and contacts, then save. Keep records complete because pricing depends on them. Categories groups suppliers by what they provide, like printing, staging or photography, so everyone searches the same way. Import and Export lets you load a supplier list from a file or download a backup: use it after an expo or before you change anything big. Settings holds the lists behind the directory: supplier types, cities, statuses, price levels and payment terms. Recently Deleted keeps removed records in case you need one back.","ar":"عشان تضيف مورد دوس Add Supplier فوق، اكتب الاسم والنوع والخدمات وجهات الاتصال واحفظ. خلي السجلات كاملة لأن التسعير بيعتمد عليها. Categories بتجمّع الموردين حسب اللي بيقدموه، زي طباعة أو ستيجينج أو تصوير، عشان الكل يدوّر بنفس الطريقة. Import and Export بتسمحلك ترفع لستة موردين من ملف أو تنزّل باك أب: استخدمها بعد أي إكسبو أو قبل أي تغيير كبير. Settings فيها القوائم اللي ورا الدليل: أنواع الموردين والمدن والحالات ومستويات السعر وشروط الدفع. وRecently Deleted بتحتفظ بالسجلات المحذوفة لو احتجت ترجّع واحد.","tab":"Operations Directory"},{"id":"orders","ep":"Ops Ep5 Orders","title":"Supply orders and purchase orders","kw":["supply orders?|purchase orders?|orders?|اوردر|أوردر|امر شراء|أمر شراء|طلبيه|طلبية","next step|release|return|exit"],"en":"Supply Orders move items out of your warehouse for a project. The cards count orders waiting for approval, approved and ready to release, items out now, overdue returns and closed orders. Use the filters to see what needs attention, what is approved, what is out and what is closed, and the Next Step column tells you what to do with each order. To create one click New supply order, choose the project, the exit and return dates and the items. Approved orders are released from the warehouse and closed when everything is back. Purchase Orders are for buying from suppliers with the same logic: new orders wait for approval, approved ones are in progress and closed ones are done.","ar":"Supply Orders بتطلّع حاجات من المخزن لمشروع. الكروت بتعد الأوردرات المستنية موافقة، المعتمدة الجاهزة للإخراج، الحاجات اللي بره دلوقتي، المرتجعات المتأخرة، والمقفولة. استخدم الفلاتر تشوف إيه اللي محتاج انتباه وإيه المعتمد وإيه بره وإيه اتقفل، وعمود Next Step بيقولك تعمل إيه في كل أوردر. عشان تعمل واحد دوس New supply order، اختار المشروع وتاريخ الخروج والرجوع والأصناف. الأوردرات المعتمدة بتطلع من المخزن وبتتقفل لما كل حاجة ترجع. وPurchase Orders للشراء من الموردين بنفس المنطق: الجديد مستني موافقة، المعتمد شغال، والمقفول خلص.","tab":"Operations Directory"},{"id":"warehouse","ep":"Ops Ep5 Warehouse","title":"Warehouse stock","kw":["warehouse|stock|inventory|مخزن|المخزن|مخزون|add item|paste a list|archive item"],"en":"The Warehouse shows your stock: item types, pieces in the warehouse, how many are out or reserved and how many are available now. Search for any item. Add Item creates a new one and Paste a list adds many items at once. Edit corrects quantities and Archive hides items you no longer use.","ar":"المخزن (Warehouse) بيوريك المخزون: أنواع الأصناف والقطع الموجودة وكام بره أو محجوز وكام متاح دلوقتي. ابحث عن أي صنف. Add Item بتضيف صنف جديد وPaste a list بتضيف أصناف كتير مرة واحدة. Edit بتصحح الكميات وArchive بتخبّي الأصناف اللي مش بتستخدمها.","tab":"Operations Directory"},{"id":"pricing_calc","ep":"Ops Ep6 Pricing","title":"Pricing Calculator","kw":["pricing calculator|cost sheet|line item|cost line|margin|overhead|serial|حاسبه|حاسبة|تكلفه|تكلفة|شيت التسعير","how.*(price|cost)|ازاي.*(اسعر|أسعر|تكلفه|تكلفة)","pricing|price|تسعير|سعر"],"en":"The Pricing Calculator costs a job completely so the price that reaches the client is built on real numbers. Start with the brief details: pick the linked brief and the project and client fill in automatically, then choose the company and the month, and type the project name and client so the sheet is easy to find later. Saved sheets are listed at the top, grouped by company and month. Then add the cost line items: choose a category, describe the item, name the vendor, enter the quantity and the unit cost, and the line total calculates itself. Add a line for every cost: printing, production, venue, labour, transport, and click Add line item for more rows. Be complete, because a missing cost becomes a lost margin. The selling price, overhead and margin are set by the director, so your job is the costs. Save the sheet so it can be priced and reopened when the client asks for changes.","ar":"حاسبة التسعير (Pricing Calculator) بتكلّف الشغل كامل عشان السعر اللي يوصل للعميل يتبني على أرقام حقيقية. ابدأ ببيانات البريف: اختار البريف المرتبط والمشروع والعميل بيتملوا لوحدهم، وبعدين اختار الشركة والشهر، واكتب اسم المشروع والعميل عشان الشيت يتلاقى بسهولة بعدين. الشيتات المحفوظة فوق متجمّعة بالشركة والشهر. بعدين ضيف بنود التكلفة: اختار كاتيجوري، اوصف البند، اكتب المورد، وادخل الكمية وتكلفة الوحدة والإجمالي بيتحسب لوحده. ضيف سطر لكل تكلفة: طباعة، إنتاج، مكان، عمالة، نقل، ودوس Add line item لو محتاج صفوف زيادة. كمّل كل حاجة لأن أي تكلفة ناقصة بتبقى هامش ضايع. سعر البيع والـoverhead والهامش بيحددهم الدايركتور، فشغلك إنت التكاليف. احفظ الشيت عشان يتسعّر ويتفتح تاني لما العميل يطلب تعديل.","tab":"Pricing"}];
  function nrm(x) { return String(x || '').toLowerCase().replace(/[ً-ٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)) }) }
  // Patterns shared by 3+ topics are "generic" (they only say which tab); they count less than a specific phrase.
  var KWF = {}; KB.forEach(function (k) { k.kw.forEach(function (p) { KWF[p] = (KWF[p] || 0) + 1 }) })
  // Short words must match as whole words ("star" must not match "start", the Arabic "رد" must not match "الاوردرات").
  function kwGuard(p) {
    if (/[()\[\]\\]/.test(p)) return p
    return p.split('|').map(function (a) {
      if (/^[a-z0-9 ?.-]+$/.test(a)) return '\\b' + a + (a.replace(/[ ?.-]/g, '').length <= 5 ? '(?![a-z])' : '')
      if (/^(رد|ميل)$/.test(a)) return '(?:^|\\s)(?:ال)?' + a + '(?=\\s|$)'
      return a
    }).join('|')
  }
  var KBX = KB.map(function (k) { return { k: k, ov: /^(overview|home|tasks|briefs|crm|sales|expenses|hr|mail|directory|pricing_calc)$/.test(k.id) ? 0.05 : 0, r: k.kw.map(function (p) { try { return { re: new RegExp(kwGuard(nrm(p)), 'i'), w: KWF[p] >= 3 ? 0.3 : 1 } } catch (e) { return null } }).filter(Boolean) } })
  function kbRank(text) {
    var q = nrm(text), out = []
    KBX.forEach(function (e) { var sc = 0; e.r.forEach(function (r) { if (r.re.test(q)) sc += r.w }); if (sc > 0) out.push({ k: e.k, s: sc + e.ov }) })
    return out.sort(function (a, b) { return b.s - a.s })
  }
  function kbFind(text) { var r = kbRank(text); return r.length ? r[0].k : null }
  function arDays(n) { return n === 1 ? 'يوم' : n === 2 ? 'يومين' : n <= 10 ? n + ' أيام' : n + ' يوم' }
  var MONTHS = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
    'يناير': 1, 'فبراير': 2, 'مارس': 3, 'ابريل': 4, 'مايو': 5, 'يونيو': 6, 'يوليو': 7, 'اغسطس': 8, 'سبتمبر': 9, 'اكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12 }
  function isoD(d) { var z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10) }
  function ymd(y, m, d) { var dt = new Date(Date.UTC(y, m - 1, d)); if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null; return dt.toISOString().slice(0, 10) }
  // Dates in any common form: 2026-12-15, 15-12-2026, 15/12, 15 December, 15 ديسمبر, tomorrow, بكرة; "for 3 days" / "3 أيام" extends a single start date.
  function parseDates(raw) {
    var t = nrm(raw), now = new Date(), cy = now.getFullYear(), today = isoD(now), found = []
    function add(pos, iso) { if (iso) found.push({ p: pos, d: iso }) }
    function yearFor(m, d, y) { if (y) return y < 100 ? 2000 + y : y; var iso = ymd(cy, m, d); return iso && iso < today ? cy + 1 : cy }
    var re, m
    re = /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/g; while ((m = re.exec(t))) { add(m.index, ymd(+m[1], +m[2], +m[3])); t = t.slice(0, m.index) + ' '.repeat(m[0].length) + t.slice(m.index + m[0].length) }
    re = /(\d{1,2})[-\/.](\d{1,2})(?:[-\/.](\d{2,4}))?/g; while ((m = re.exec(t))) { var dd = +m[1], mm = +m[2]; if (mm > 12 && dd <= 12) { var x = dd; dd = mm; mm = x } add(m.index, ymd(yearFor(mm, dd, m[3] ? +m[3] : 0), mm, dd)); t = t.slice(0, m.index) + ' '.repeat(m[0].length) + t.slice(m.index + m[0].length) }
    var names = Object.keys(MONTHS).sort(function (a, b) { return b.length - a.length }).join('|')
    re = new RegExp('(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(' + names + ')(?![a-z\\u0600-\\u06FF])(?:\\s*,?\\s*(\\d{4}))?', 'g'); while ((m = re.exec(t))) { var mo = MONTHS[m[2]]; add(m.index, ymd(yearFor(mo, +m[1], m[3] ? +m[3] : 0), mo, +m[1])); t = t.slice(0, m.index) + ' '.repeat(m[0].length) + t.slice(m.index + m[0].length) }
    re = new RegExp('(' + names + ')\\s+(\\d{1,2})(?:st|nd|rd|th)?(?![a-z0-9])(?:\\s*,?\\s*(\\d{4}))?', 'g'); while ((m = re.exec(t))) { var mo2 = MONTHS[m[1]]; add(m.index, ymd(yearFor(mo2, +m[2], m[3] ? +m[3] : 0), mo2, +m[2])); t = t.slice(0, m.index) + ' '.repeat(m[0].length) + t.slice(m.index + m[0].length) }
    found.sort(function (a, b) { return a.p - b.p })
    var out = found.map(function (f) { return f.d })
    if (!out.length) { if (/بكره|بكرا|tomorrow/.test(t)) out = [isoD(new Date(now.getTime() + 864e5))]; else if (/النهارده|انهارده|today/.test(t)) out = [today] }
    var WD = { 'يومين': 2, 'two days': 2, 'three days': 3, 'four days': 4, 'five days': 5, 'تلات ايام': 3, 'ثلاث ايام': 3, 'اربع ايام': 4, 'خمس ايام': 5 }, wdn = 0; Object.keys(WD).forEach(function (k) { if (!wdn && t.indexOf(nrm(k)) >= 0) wdn = WD[k] })
    if (out.length === 1 && wdn) t += ' ' + wdn + ' days'
    if (out.length === 1) { var n = t.match(/(?:for|لمده|لمدة)?\s*(\d{1,2})\s*(?:days?|day|ايام|يوم)/); if (n && +n[1] > 1 && +n[1] <= 60) { var s0 = new Date(out[0] + 'T00:00:00Z'); out = [out[0], new Date(s0.getTime() + (+n[1] - 1) * 864e5).toISOString().slice(0, 10)] } else out = [out[0], out[0]] }
    return out.slice(0, 2)
  }
  var LEAVE_WORD = /اجاز|sick days?|leave|vacation|time off|days? off|holiday|اوف|(tomorrow|today) off|off (tomorrow|today)|اخد يوم|ياخد يوم/
  var LEAVE_TYPES = [[/sick|مرض/, /sick|مرض/], [/casual|عارض/, /casual|عارض/], [/emergen|طارئ|طوارئ/, /emergen|طارئ|طوارئ/], [/unpaid|بدون (مرتب|اجر|راتب)/, /unpaid|بدون/], [/annual|اعتياد|سنو|regular|عاديه/, /annual|اعتياد|سنو/]]
  function pickType(rows, q) {
    var want = null; LEAVE_TYPES.forEach(function (p) { if (!want && p[0].test(q)) want = p[1] })
    var hit = want ? rows.filter(function (x) { return want.test(nrm(x.name)) })[0] : null
    return { want: !!want, row: hit || (want ? null : rows.filter(function (x) { return /annual|اعتياد|سنو/.test(nrm(x.name)) })[0] || null) }
  }
  async function leaveFlow(text, ar) {
    var q = nrm(text), yes = /^(ايوه|ايوا|اه|تمام|ماشي|اكيد|اكد|yes|y|ok|okay|sure|confirm)(?=\s|$|[.!؟?،])/.test(q.trim()), no = /^(لا|لأ|لاء|no|nope|cancel|الغي|الغاء)(?=\s|$|[.!؟?،])/.test(q.trim())
    if (L.pend && (yes || no)) { var p = L.pend; L.pend = null
      if (no) { await say(ar ? 'تمام، ما قدمتش حاجة.' : 'Okay, I did not submit anything.'); return true }
      var r = await sb.rpc('hr_submit_leave', { p_ws: ws, p_type: p.type, p_start: p.s, p_end: p.e, p_reason: p.reason })
      await say(r.error ? (ar ? 'ماقدرتش أقدم الطلب: ' : 'I could not submit it: ') + r.error.message : (ar ? 'اتقدم الطلب لـ HR عشان القرار. هتوصلك النتيجة هنا.' : 'Submitted to HR for a decision. You will see the result here.')); return true }
    var ds = parseDates(text), hasL = LEAVE_WORD.test(q), howQ = /\b(how|what is|steps?)\b|ازاي|طريق|خطوات|بتعمل ايه/.test(q)
    if (howQ && !ds.length) return false
    if (!ds.length) { if (L.lvWait && /^(من|from|\d)/.test(q.trim())) { L.lvWait = null } return false }
    if (!hasL && !L.lvWait) return false
    var ty = (await sb.from('hr_leave_types').select('id,name').eq('workspace_id', ws).eq('active', true)).data || []
    var typed = L.lvWait ? { want: true, row: ty.filter(function (x) { return x.id === L.lvWait })[0] || null } : pickType(ty, q)
    L.lvWait = null
    if (!typed.row) { await say(ar ? 'مش لاقية نوع الإجازة اللي تقصده. الأنواع المتاحة: ' + ty.map(function (x) { return x.name }).join('، ') + '. قولي النوع والتواريخ.' : 'I could not match that leave type. Available types: ' + ty.map(function (x) { return x.name }).join(', ') + '. Tell me the type and the dates.'); return true }
    if (ds[1] < ds[0]) { await say(ar ? 'تاريخ النهاية قبل البداية، قولي التواريخ تاني.' : 'The end date is before the start date. Tell me the dates again.'); return true }
    L.pend = { type: typed.row.id, s: ds[0], e: ds[1], reason: text.slice(0, 300) }
    var days = Math.round((new Date(ds[1]) - new Date(ds[0])) / 864e5) + 1
    await say(ar ? 'تمام، هقدم طلب ' + typed.row.name + ' من ' + ds[0] + ' إلى ' + ds[1] + ' (' + arDays(days) + '). أقدّمه؟ قول أيوه أو لا.' : 'Got it: ' + typed.row.name + ' from ' + ds[0] + ' to ' + ds[1] + ' (' + days + ' day' + (days > 1 ? 's' : '') + '). Shall I submit it? Say yes or no.'); return true
  }

  // ---- Director (manager) commands: NOUR knows Amir (the Director) is her manager and carries out his orders within what the database allows ----
  function dirName() { var k = Object.keys(roles).filter(function (u) { return roles[u] === 'director' })[0]; var n = k && names[k] ? String(names[k]).split(/\s+/)[0] : ''; return n || 'أمير' }
  function findPeople(q) { return Object.keys(names).filter(function (u) { var n = nrm(names[u] || ''); if (!n) return false; return n.split(/\s+/).some(function (w) { return w.length > 2 && new RegExp('(^|\\s)' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)').test(q) }) }) }
  async function loadNotes() { if (L.notes && Date.now() - L.notesAt < 6e4) return L.notes; var r = await sb.from('nour_memory').select('kind,topic,note,detail,day,created_at,shared').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(60); L.notes = r.data || []; L.notesAt = Date.now(); return L.notes }
  function noteHit(q) { var w = q.split(/\s+/).filter(function (x) { return x.length > 3 }); if (w.length < 2) return null; var best = null, bs = 0
    ;(L.notes || []).filter(function (n) { return n.kind === 'taught' }).forEach(function (n) { var hay = nrm(n.topic + ' ' + n.note), sc = w.filter(function (x) { return hay.indexOf(x) > -1 }).length; if (sc > bs) { bs = sc; best = n } })
    return bs >= 2 ? best : null }
  var AREA = { tasks: ['التاسكات', 'tasks'], briefs: ['البريفات', 'briefs'], crm: ['الـCRM', 'CRM'], sales: ['المبيعات', 'sales'], expenses: ['المصاريف', 'expenses'], quotations: ['عروض الأسعار', 'quotations'], pricing: ['التسعير', 'pricing'], directory: ['الدليل', 'directory'], mail: ['الإيميل', 'mail'], attention: ['التنبيهات', 'alerts'] }

  // ---- Knowledge base in the database (SOPs, HR playbook, anything the Director or Claude teaches her). RLS decides which rows each person can read. ----
  async function loadDbKb() { if (L.dbkb && Date.now() - L.dbkbAt < 3e5) return L.dbkb; var r = await sb.from('nour_knowledge').select('kind,subject,interpretation,lang_ar,keywords,needs_counsel').eq('workspace_id', ws).limit(300); L.dbkb = (r && r.data) || []; L.dbkbAt = Date.now(); return L.dbkb }
  function dbKbFind(q) {
    var words = q.split(/\s+/).filter(function (x) { return x.length > 3 }), best = null, bs = 0
    ;(L.dbkb || []).forEach(function (row) { var sc = 0
      String(row.keywords || '').split('|').forEach(function (k) { k = nrm(k).trim(); if (!k) return; var latin = /^[a-z0-9 .?\\]+$/.test(k); try { if (new RegExp(latin ? '(^|[^a-z0-9])(' + k + ')($|[^a-z0-9])' : k).test(q)) sc += 2 } catch (e) {} })
      var hay = nrm(row.subject); sc += words.filter(function (w) { return hay.indexOf(w) > -1 }).length
      if (sc > bs) { bs = sc; best = row } })
    return bs >= 2 ? best : null }
  // Review loop: what NOUR was unsure about (pending, with the asker so the answer can come back on the bell) and what she answered from knowledge (answered, no name), so the Director's reviewer can correct her. Sensitive topics are never logged.
  var SENS = /شكو|تحرش|تنمر|ظلم|اهان|استقال|مرتب|راتب|فلوس|عقوب|انذار|جزاء|فصل|ضغط نفسي|harass|bully|discriminat|complain|resign|salary|payroll|warning|dismiss|fired|\d{7,}/
  function lastNour() { for (var i = chat.length - 1; i >= 0; i--) if (chat[i].role === 'assistant') return chat[i].content; return '' }
  function logReview(text, answer, kind) { try { if (!text || text.length < 6) return; if (SENS.test(nrm(text))) return; sb.rpc('nour_review_log', { p_ws: ws, p_q: text, p_a: answer || '', p_kind: kind }) } catch (e) {} }
  function logUnanswered(text) { try { if (text && text.length > 5) sb.rpc('nour_question_log', { p_ws: ws, p_text: text }) } catch (e) {} }
  async function dirCmd(text, ar, q) {
    if (!isDir) return false
    var qt = q.trim()
    // 1) teach: "اتعلمي ..." / "remember that ..."
    var tm = /^(اتعلمي|اتعلم|تعلمي|تعلم|تذكري|افتكري|احفظي|سجلي عندك|خدي في بالك|remember|learn|keep in mind|note that|note)(?=\s|$|[:،,.!؟?])[\s:،,]*(?:ان|إن|that)?\s*(.+)$/.exec(text.trim().replace(/\s+/g, ' ').replace(/^(نور|nour)[\s،,]+/i, '')) 
    if (!tm) tm = /^(?:nour|نور)[\s،,]+(اتعلمي|اتعلم|تعلمي|تذكري|افتكري|احفظي|remember|learn)(?=\s|$|[:،,.!؟?])[\s:،,]*(?:ان|إن|that)?\s*(.+)$/i.exec(text.trim())
    if (tm && tm[2] && tm[2].length > 3) { var note = tm[2].trim(), topic = note.split(/\s+/).slice(0, 4).join(' ')
      var r = await sb.rpc('nour_teach', { p_ws: ws, p_topic: topic, p_note: note, p_shared: false }); L.notes = null
      await say(r.error ? (ar ? 'ماقدرتش أحفظها: ' : 'I could not save it: ') + r.error.message : (ar ? 'تمام يا ' + dirName() + '، اتعلمتها وحفظتها: "' + note.slice(0, 160) + '". هعمل بيها من دلوقتي.' : 'Understood, ' + dirName() + '. I learned and saved it: "' + note.slice(0, 160) + '". I will act on it from now on.')); return true }
    // 2) what did you learn / what is happening in the system
    if (/اتعلمتي ايه|اتعلمتي|بتتعلمي|عرفتي ايه|ايه اللي بيحصل|بيحصل ايه|السيستم عامل ايه|حصل ايه|اخبار السيستم|what (did|have) you (learn|learned)|what(.?s| is) (happening|going on|new)|system (activity|status|pulse)|what do you know|what did i teach/.test(q)) {
      await sb.rpc('nour_learn_now', { p_ws: ws, p_days: 3 }); L.notes = null; var nts = await loadNotes()
      var lr = nts.filter(function (n) { return n.kind === 'learned' }).sort(function (a, b) { return a.day < b.day ? 1 : -1 }).slice(0, 3), tg = nts.filter(function (n) { return n.kind === 'taught' }).slice(0, 5)
      var parts = []
      lr.forEach(function (n) { var d = n.detail || {}, areas = Object.keys(d).filter(function (k) { return k.charAt(0) !== '_' && AREA[k] }).sort(function (a, b) { return d[b].n - d[a].n }).slice(0, 4).map(function (k) { return AREA[k][ar ? 0 : 1] + ' ' + d[k].n })
        parts.push((ar ? 'يوم ' : 'Day ') + n.day + ': ' + (d._changes || 0) + (ar ? ' تغيير بواسطة ' : ' changes by ') + (d._active_people || 0) + (ar ? ' ناس نشيطين' : ' active people') + (areas.length ? ' (' + areas.join(ar ? '، ' : ', ') + ')' : '')) })
      var top = lr[0] && lr[0].detail || {}
      var out = (ar ? 'بتابع السيستم يوميًا. آخر ما لاحظته:\n' : 'I follow the system daily. What I noticed lately:\n') + (parts.length ? parts.join('\n') : (ar ? 'لسه مفيش نشاط مسجل.' : 'No activity recorded yet.'))
      if (top._pending_leave || top._pending_approvals) out += '\n' + (ar ? 'مستنيين قرارك: ' + (top._pending_leave || 0) + ' طلب إجازة و' + (top._pending_approvals || 0) + ' موافقة.' : 'Waiting for your decision: ' + (top._pending_leave || 0) + ' leave request(s) and ' + (top._pending_approvals || 0) + ' approval(s).')
      out += '\n' + (tg.length ? (ar ? 'وده اللي علمتهولي: ' : 'And what you taught me: ') + tg.map(function (n) { return '"' + n.note.slice(0, 80) + '"' }).join(ar ? '، ' : '; ') : (ar ? 'لسه ما علمتنيش حاجة بإيدك. قولي "اتعلمي ..." وأنا أحفظها.' : 'You have not taught me anything yet. Say "remember that ..." and I will save it.'))
      out += '\n' + (ar ? '(بتعلم من أعداد النشاط بس، من غير ما أقرا محتوى حد أو بيانات HR أو الشكاوى.)' : '(I learn from activity counts only, never from anyone’s content, HR data or complaints.)')
      await say(out); return true }
    // 3) pending leave list / decide
    var decA = /^(?:نور[\s،,]+)?(وافقي|اوافقي|اعتمدي|وافق|approve|accept|grant)(?=\s|$|[:،,.!؟?])/.test(qt), decR = /^(?:نور[\s،,]+)?(ارفضي|ارفض|reject|deny|decline)(?=\s|$|[:،,.!؟?])/.test(qt)
    if (!decA && !decR && /(اجاز|leave|time off)/.test(q) && /(مستنيه|معلقه|معلق|pending|waiting|مين طالب|مين مقدم|who (requested|asked|applied)|requests?\b|الطلبات)/.test(q)) {
      var pl = (await sb.from('hr_leave_requests').select('id,user_id,start_date,end_date,days,leave_type_id').eq('workspace_id', ws).eq('status', 'pending').order('submitted_at')).data || []
      if (!pl.length) { await say(ar ? 'مفيش طلبات إجازة مستنية.' : 'No leave requests are waiting.'); return true }
      var lt = {}; ((await sb.from('hr_leave_types').select('id,name').eq('workspace_id', ws)).data || []).forEach(function (x) { lt[x.id] = x.name })
      await say((ar ? 'طلبات الإجازة المستنية:\n' : 'Leave requests waiting:\n') + pl.map(function (x) { return '• ' + (names[x.user_id] || '?') + ' — ' + (lt[x.leave_type_id] || '') + ' ' + x.start_date + ' → ' + x.end_date + ' (' + x.days + ')' }).join('\n') + '\n' + (ar ? 'قولي "وافقي على اجازة <الاسم>" أو "ارفضي ..." وأنا أنفذ.' : 'Say "approve <name>’s leave" or "reject ..." and I will do it.')); return true }
    if ((decA || decR) && /(اجاز|leave|time off|vacation|اجازة)/.test(q) || ((decA || decR) && findPeople(q).length && !/(approval|موافقه)/.test(q))) {
      var who = findPeople(q), pend = (await sb.from('hr_leave_requests').select('id,user_id,start_date,end_date,days').eq('workspace_id', ws).eq('status', 'pending')).data || []
      var cand = who.length ? pend.filter(function (x) { return who.indexOf(x.user_id) > -1 }) : pend
      if (!cand.length) { await say(who.length ? (ar ? 'مفيش طلب إجازة مستني بالاسم ده.' : 'No pending leave request under that name.') : (ar ? 'مفيش طلبات إجازة مستنية.' : 'No leave requests are waiting.')); return true }
      if (cand.length > 1) { await say((ar ? 'في أكتر من طلب، حدد الاسم:\n' : 'More than one request, tell me which name:\n') + cand.map(function (x) { return '• ' + (names[x.user_id] || '?') + ' ' + x.start_date + ' → ' + x.end_date }).join('\n')); return true }
      var c = cand[0], dr = await sb.rpc('hr_decide_leave', { p_id: c.id, p_decision: decA ? 'approved' : 'rejected', p_note: null, p_override: false })
      await say(dr.error ? (ar ? 'ماقدرتش أنفذ: ' : 'I could not do it: ') + dr.error.message : (ar ? (decA ? 'تم، وافقت' : 'تم، رفضت') + ' على إجازة ' + (names[c.user_id] || '') + ' من ' + c.start_date + ' إلى ' + c.end_date + '. الموظف هيتبلّغ بالقرار.' : 'Done. ' + (decA ? 'Approved' : 'Rejected') + ' ' + (names[c.user_id] || '') + '’s leave ' + c.start_date + ' → ' + c.end_date + '. The employee will see the decision.')); return true }
    // 4) approvals by code
    var am = /(approve|reject|وافقي|اعتمدي|ارفضي)[^\n]*?\b([a-z]{2,6}-?\d{1,6})(?=\s|$|[:،,.!؟?])/i.exec(text)
    if (am) { var code = am[2].toUpperCase(), ap = (await sb.from('nour_approvals').select('id,code,action_type,status').eq('workspace_id', ws).eq('status', 'PENDING_APPROVAL')).data || []
      var hit = ap.filter(function (x) { return String(x.code).toUpperCase().replace('-', '') === code.replace('-', '') })[0]
      if (!hit) { await say(ar ? 'مش لاقية موافقة مستنية بالكود ده.' : 'I cannot find a pending approval with that code.'); return true }
      var ok = /approve|وافقي|اعتمدي/i.test(am[1]), xr = await sb.rpc('nour_decide_approval', { p_id: hit.id, p_decision: ok ? 'APPROVED' : 'REJECTED', p_note: null })
      await say(xr.error ? (ar ? 'ماقدرتش أنفذ: ' : 'I could not do it: ') + xr.error.message : (ar ? 'تم. ' + hit.code + (ok ? ' اتعتمدت.' : ' اترفضت.') : 'Done. ' + hit.code + (ok ? ' approved.' : ' rejected.'))); return true }
    // 5) remind me / follow up
    var rm = /^(?:نور[\s،,]+)?(فكريني|فكرني|ذكريني|remind me|follow up|تابعي)(?=\s|$|[:،,.!؟?])[\s:،,]*(?:ب|بـ|to|about|that)?\s*(.+)$/i.exec(text.trim())
    if (rm && rm[2] && rm[2].length > 2) { var ds2 = parseDates(text), due = ds2.length ? ds2[0] : null
      var fr = await sb.rpc('nour_followup_add', { p_ws: ws, p_user: me.id, p_title: rm[2].slice(0, 200), p_due: due, p_detail: null, p_via_nour: true })
      await say(fr.error ? (ar ? 'ماقدرتش أسجلها: ' : 'I could not save it: ') + fr.error.message : (ar ? 'تمام، سجلتها وهفكرك' + (due ? ' يوم ' + due : '') + '.' : 'Noted, I will remind you' + (due ? ' on ' + due : '') + '.')); return true }
    // 5b) announce to all employees (bell notification) — only the Director's explicit order
    var annV = /(ابعت|ابعتي|ارسل|ارسلي|وجهي|انشر|انشري|اكتب|اكتبي|send|post|publish|broadcast|announce|write)/.test(q), annT = /(للموظفين|لكل الموظفين|لجميع الموظفين|للفريق|لكل الفريق|للكل|لكل الناس|to (all )?(the )?(employees|staff|team|everyone)|all (the )?(employees|staff)|everyone)/.test(q), annM = /(رساله|رسالة|اعلان|تحيه|تحية|ترحيب|تعارف|message|announcement|greeting|welcome|intro)/.test(q)
    if (annV && annT && annM) {
      var greet = /(تحيه|تحية|ترحيب|تعارف|greeting|welcome|intro|know you|تعرفهم|تعرفوا)/.test(q)
      var cm = /[:：]\s*([\s\S]{8,})$/.exec(text.trim()), ttl, body
      if (cm && !greet) { ttl = ar ? 'رسالة من نور' : 'A message from NOUR'; body = cm[1].trim().slice(0, 1500) }
      else if (greet) { ttl = 'أهلاً بيكم من نور'; body = 'أنا نور، مديرة الموارد البشرية الجديدة في مايندز (مساعدة بالذكاء الاصطناعي). تقدروا تكلموني من صفحة Home في Z Cloud في أي وقت: تطلبوا إجازة، تسألوا عن رصيدكم، تتعلموا أي قسم في السيستم، أو تبعتوا ملاحظة أو شكوى بشكل خاص. أنا هنا أساعدكم، وأي حاجة مش قادرة عليها بوصلها للإدارة.' }
      else { await say(ar ? 'عايزة أبعت إيه بالظبط؟ اكتب النص بعد نقطتين، مثلاً: ابعت للموظفين رسالة: اجتماع الفريق الأحد 10 الصبح.' : 'What exactly should I send? Put the text after a colon, for example: send to all employees: team meeting Sunday 10am.'); return true }
      if (L.annSent === body) { await say(ar ? 'الرسالة دي اتبعتت قبل كده في المحادثة دي. لو عايزها تتبعت تاني قولي.' : 'I already sent that one in this chat. Tell me if you want it sent again.'); return true }
      var ar2 = await sb.rpc('hr_send_announcement', { p_ws: ws, p_title: ttl, p_body: body, p_user_ids: null })
      if (ar2.error) { await say((ar ? 'ماقدرتش أبعتها: ' : 'I could not send it: ') + ar2.error.message); return true }
      L.annSent = body
      await say(ar ? 'تم يا ' + dirName() + '، بعت الرسالة لـ ' + ar2.data + ' موظف على الجرس في Z Cloud (مش إيميل). ' + (greet ? 'وقسم الترحيب بتاعي ' + (settings.welcome_published ? 'ظاهر لهم أصلاً' : 'لسه ما اتنشرش') + ' على صفحة Home.\nنص الرسالة: "' + body.slice(0, 200) + '"' : 'نصها: "' + body.slice(0, 200) + '"') : 'Done, ' + dirName() + '. I sent it to ' + ar2.data + ' employees on the Z Cloud bell (not email). ' + (greet ? 'My welcome section is ' + (settings.welcome_published ? 'already visible' : 'not published yet') + ' on the Home page.' : '')); return true }
    // 5c) any other order I cannot execute in basic mode: say so honestly instead of answering with a tutorial
    if (/^(?:(?:نور|nour)[\s،,]+)?(ابعت|ابعتي|ارسل|ارسلي|انشر|انشري|فعل|فعلي|اعمل|اعملي|ضيف|ضيفي|احذف|احذفي|امسح|امسحي|غيري|عدلي|اقفلي|افتحي|اطلبي|حددي|جهزي|اكتبي|سجلي|حولي|send|publish|activate|enable|disable|create|add|delete|remove|change|update|edit|set|schedule|close|open|prepare|write|assign|transfer)(?=\s|$|[:،,.!؟?])/.test(qt)) {
      logUnanswered(text)
      await say(ar ? 'فهمت إنه أمر يا ' + dirName() + '، بس مش هنفذه غلط: في الوضع الأساسي بنفذ بس الأوامر دي: حفظ قاعدة ("اتعلمي ..."), الموافقة على الإجازات أو رفضها, الموافقات بالكود, "فكريني ...", وإرسال رسالة لكل الموظفين ("ابعت للموظفين رسالة: ..."). الأمر ده سجلته عندي، وهنفذه من هنا لما نشغل الذكاء الكامل، أو قوله لـ Claude في الشغل وهو ينفذه فورًا.' : 'I understood that as an order, ' + dirName() + ', but I will not guess: in basic mode I execute only: saving a rule ("remember that ..."), approving or rejecting leave, approvals by code, "remind me ...", and messaging all employees ("send to all employees: ..."). I have logged this order, and I will run it when the full AI is switched on, or you can ask Claude directly and it runs it right away.'); return true }
    // 6) taught notes (only when asked about something the Director taught)
    return false
  }
  var VARI = { ar: ['تحب أشرحلك حاجة تانية في Z Cloud؟', 'لو في حاجة تانية قولي.', 'عايز تعرف حاجة كمان؟'], en: ['Want me to explain anything else in Z Cloud?', 'Tell me if you need anything else.', 'Anything else you would like to know?'] }
  async function local(text) {
    var ar = /[؀-ۿ]/.test(text), q = nrm(text), t = T[ar ? 'ar' : 'en']
    if (await leaveFlow(text, ar)) return true
    if (await dirCmd(text, ar, q)) return true
    if (/^(مرحبا|اهلا|هاي|هلا|صباح|مساء|السلام|hi\b|hello|hey|good (morning|evening))/.test(q.trim())) { await say(isDir ? (ar ? 'أهلاً يا ' + firstName() + '، أنا نور. تحت أمرك، اطلب أي حاجة وأنا أنفذها، وأي قرار يخصني هرجعلك فيه.' : 'Hello ' + firstName() + ', I am NOUR. At your service: tell me what you need and I will carry it out, and I will come back to you on anything that needs your decision.') : t.hello(firstName()) + (ar ? 'تحب أساعدك في إيه؟' : 'How can I help?')); return true }
    if (/شكرا|thank/.test(q)) { await say(ar ? 'العفو، أنا موجودة.' : 'Anytime.'); return true }
    if (/مين مديرك|مين مديرتك|مين رئيسك|مين بيديك اوامر|who.?s your (manager|boss)|who is your (manager|boss)|who do you (report|work) (to|for)/.test(q)) { await say(isDir ? (ar ? 'إنت مديري يا ' + firstName() + '. بترجعلك في أي قرار، وبنفذ اللي تأمرني بيه في حدود صلاحياتي.' : 'You are my manager, ' + firstName() + '. I come back to you on any decision and carry out what you instruct within my permissions.') : (ar ? 'مديري هو ' + dirName() + '، مدير الشركة. بنفذ تعليماته وبرجعله في القرارات المهمة، والقرار النهائي للإدارة.' : 'My manager is ' + dirName() + ', the company Director. I follow his instructions and go back to him on important decisions; final decisions stay with management.')); return true }
    if (/مين انت|انتي مين|انت مين|who are you|what are you/.test(q)) { await say(isDir ? (ar ? 'أنا نور، مديرة الموارد البشرية في مايندز، وإنت مديري. بنفذ أوامرك وبتابع السيستم يوميًا عشان أفضل فاهمة الشغل.' : 'I am NOUR, MINDz’s HR manager, and you are my manager. I carry out your instructions and follow the system daily so I keep understanding the work.') : ar ? 'أنا نور، مديرة الموارد البشرية في مايندز. أنا ذكاء اصطناعي: بجهز وبنسق، والقرارات النهائية للإدارة.' : 'I am NOUR, MINDz’s HR manager. I am an AI: I prepare and coordinate, and final decisions stay with management.'); return true }
    var o = null
    if (/شكو|قضي|قضا|case|complain|concern|تحرش|تنمر|ظلم|harass|bully|discriminat|ضايق|مضايق|بيزعق|بيهين|اهانه|بيستغل|toxic|insult|picking on|treats me (badly|unfairly)|bothering me|مش مرتاح في الشغل/.test(q)) { o = L.last || await gather()
      if (isHandler) await say(o.cases ? t.cases(o.cases) + (ar ? '. افتح تبويب Cases.' : '. Open the Cases tab.') : (ar ? 'مفيش قضايا مفتوحة.' : 'No open cases.'))
      else await say(ar ? 'أنا آسفة إنك بتمر بده. تقدر تبلّغ بشكل سري من تبويب "Confidential". الشكوى بتتحفظ بشكل آمن وبتروح بشكل خاص للجهة اللي الشركة حددتها، والزملاء ومسؤولي الـ HR مش بيشوفوها.' : 'I am sorry you are dealing with that. You can raise it privately under the Confidential tab. It is saved securely and goes privately to the person the company designated; colleagues and HR administrators cannot see it.'); return true }
    if (/اقتراح|فكره|suggestion|suggest an? idea|i have an idea/.test(q)) { await say(ar ? 'شكراً على الفكرة. اكتبها لي بالتفصيل في تبويب "Confidential" أو قولها للإدارة مباشرة، وأنا هتابعها.' : 'Thank you. Please write it up under the Confidential tab or tell management directly, and I will follow it.'); return true }
    if (/(الموافقات|approvals)\b|موافقات مستني|pending approval/.test(q)) { var r = await sb.from('nour_approvals').select('code,action_type,status').eq('workspace_id', ws).eq('status', 'PENDING_APPROVAL').limit(5); var rows = r.data || []
      await say(rows.length ? (ar ? 'الموافقات المستنية: ' : 'Waiting approvals: ') + rows.map(function (x) { return x.code + ' ' + x.action_type.replace(/_/g, ' ') }).join(ar ? '، ' : ', ') + (ar ? '. افتح تبويب الموافقات عشان تقرر.' : '. Open the Approvals tab to decide.') : (ar ? 'مفيش موافقات مستنية.' : 'No approvals waiting.')); return true }
    if (/ملخص|النهارده|daily (summary|brief)|my day|summary\b|today.?s (summary|brief)/.test(q)) { await briefing(); return true }
    if (isHR && /overview|headcount|عدد الموظفين|نظره عامه|اجمالي الموظفين/.test(q)) { var ov = await sb.rpc('hr_overview', { p_ws: ws }); var d = ov.data || {}; var ks = Object.keys(d).filter(function (x) { return typeof d[x] === 'number' }).slice(0, 6)
      await say(ks.length ? ks.map(function (x) { return x.replace(/_/g, ' ') + ': ' + d[x] }).join(ar ? '، ' : ', ') : (ar ? 'مفيش أرقام متاحة دلوقتي.' : 'No figures available right now.')); return true }
    var bal = /رصيد|balance|how many .*(days|leave|vacation)|(days?|leave|vacation) (do i have )?(left|remaining)|remaining (days|leave)|كام يوم|باقي.*اجاز|اجازاتي|my leave|leave balance|days left/.test(q)
    var howQ2 = /\b(how|what is|steps?)\b|ازاي|طريق|خطوات|فين اطلب|اقدم ازاي/.test(q), calQ = /calendar|تقويم|رسميه|official|holidays?\b|company event|عطله|عطلات|اجازات الشركه/.test(q)
    var leaveQ = LEAVE_WORD.test(q) && !howQ2 && !calQ
    if (/بتعملي ايه|تعملي ايه|تعمل ايه|تقدري تعملي|تقدر تعملي|تعرفي ايه|تقدري تساعدي|what can you do|how can you help|what do you do|help me\b|ساعديني|محتاج مساعده|عايز مساعده|عايزه مساعده/.test(q)) {
      await say(ar ? 'أنا نور، مديرة الموارد البشرية هنا. أقدر أشرحلك أي قسم في Z Cloud خطوة خطوة (التاسكات، البريفات، الـCRM، المبيعات، المصاريف، الإيميل، الـHR Suite)، أقولك رصيد إجازاتك وأقدملك طلب إجازة لو قلتلي النوع والتواريخ، أوريك الملخص اليومي، وأوصّلك للجهة الصح لو عندك شكوى أو اقتراح. اسألني زي ما تحب.' : 'I am NOUR, the HR manager here. I can walk you through any part of Z Cloud step by step (tasks, briefs, CRM, sales, expenses, mail, the HR Suite), tell you your leave balance and submit a leave request once you give me the type and dates, show your daily summary, and point you to the right place for a concern or an idea. Just ask.'); return true }
    if (/استقال|هستقيل|عايز استقيل|resign/.test(q)) { await say(ar ? 'ده قرار مهم، وأنا موجودة أسمعك. الاستقالة بتتقدم رسميًا لـHR من HR Requests في الـHR Suite، وبتتراجع مع مديرك والإدارة. لو حابب نتكلم الأول عن اللي مضايقك قولي.' : 'That is a big decision, and I am here to listen. A resignation is submitted to HR through HR Requests in the HR Suite and reviewed with your manager and management. If you would like to talk through what is behind it first, tell me.'); return true }
    var kb = (bal || leaveQ) ? null : kbFind(text)
    if (!kb && !bal && !leaveQ) { await loadNotes(); var nh = noteHit(q); if (nh) { L.viaKb = 1; await say((ar ? 'حسب اللي اتعلمته: ' : 'From what I was taught: ') + nh.note); return true } }
    if (!kb && !bal && !leaveQ) { await loadDbKb(); var dk = dbKbFind(q); if (dk) { L.viaKb = 1; L.fbN = 0; await say((ar ? (dk.lang_ar || dk.interpretation) : dk.interpretation) + (dk.needs_counsel ? (ar ? ' (ده مبدأ عام، والقرار القانوني بيتأكد مع المستشار.)' : ' (General guidance: confirm legal points with counsel.)') : '')); return true } }
    if (kb) { L.viaKb = 1; L.fbN = 0; await say((ar ? kb.ar : kb.en) + ' ' + VARI[ar ? 'ar' : 'en'][(L.vi = ((L.vi || 0) + 1) % 3)]); return true }
    if (leaveQ || bal) { o = L.last || await gather(); var bl = (o.ctx && o.ctx.leave_balances || []).filter(function (x) { return x.remaining != null }), ty2 = pickType(bl, q)
      var one = ty2.want && ty2.row ? [ty2.row] : bl
      L.fbN = 0
      await say((one.length ? one.map(function (x) { return x.name + ': ' + x.remaining + (ar ? ' يوم' : ' days') }).join(ar ? '، ' : ', ') + '.' : (ar ? 'مفيش رصيد مسجل.' : 'No balance recorded.')) + (ar ? ' لو عايز تقدم إجازة قولي النوع والتواريخ، مثلاً: إجازة اعتيادية من 15-12 لـ 30-12.' : ' To request leave tell me the type and dates, for example: annual leave from 15-12 to 30-12.')); return true }
    if (/راتب|مرتب|مكاف|خصم|salary|payroll|bonus|deduction|عقد|contract|عرض وظيف|offer letter|توظيف|hire|recruit|تقييم|performance review/.test(q)) { await say(ar ? 'ده شغل بيتم من تبويبات Z Cloud بصلاحياتك (الرواتب والمكافآت والعقود والتوظيف والتقييم). والقرار النهائي دايماً للإدارة. قولي تحب أفتحلك أنهي جزء.' : 'That lives in the Z Cloud tabs under your permissions (payroll, bonuses, contracts, hiring, reviews), and final decisions always stay with management. Tell me which part you want.'); return true }
    return false
  }
  function fallbackText(text) {
    var ar = /[؀-ۿ]/.test(text); L.fbN = (L.fbN || 0) + 1
    if (isDir) return ar ? 'تحت أمرك. الأوامر اللي أنفذها دلوقتي: "اتعلمي ..." (أحفظ قاعدة أو معلومة)، "اتعلمتي ايه؟" (اللي لاحظته في السيستم)، "الاجازات المستنية"، "وافقي/ارفضي على اجازة <الاسم>"، "فكريني ..." ورصيد الإجازات وشرح أي قسم. الأوامر الحرة المعقدة محتاجة تشغيل العقل الكامل (AI) وده لسه مش متفعل.' : 'At your service. Orders I can carry out now: "remember that ...", "what did you learn?", "pending leave", "approve/reject <name>’s leave", "remind me to ...", leave balances and explaining any section. Complex free-form orders need the full AI brain, which is not switched on yet.'
    if (ar) return L.fbN % 2 ? 'مش متأكدة فهمت قصدك. تقدر تسألني عن شرح أي قسم في Z Cloud (التاسكات، البريفات، الـCRM، المبيعات، المصاريف، الإيميل، الـHR Suite)، أو عن رصيد إجازاتك، أو تقولي مثلاً: إجازة اعتيادية من 15-12 لـ 30-12.' : 'لسه مش فاهمة بالظبط. جرّب تصيغها بشكل تاني، مثلاً: "ازاي أضيف تاسك؟" أو "رصيد إجازاتي" أو "ازاي أقدم مصروف؟".'
    return L.fbN % 2 ? 'I am not sure I got that. You can ask me how any part of Z Cloud works (tasks, briefs, CRM, sales, expenses, mail, the HR Suite), ask about your leave balance, or say for example: annual leave from 15-12 to 30-12.' : 'I still did not catch it. Try wording it differently, for example: "how do I add a task?", "my leave balance" or "how do I submit an expense?".'
  }

  async function handle(text) {
    if (busy) return; busy = true; stopListening(); stopSpeaking()
    addMsg('user', text); setState('thinking')
    try {
      var tok = (await sb.auth.getSession()).data.session.access_token
      var r = await fetch(C.url + '/functions/v1/nour-chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, apikey: C.anonKey }, body: JSON.stringify({ workspace_id: ws, messages: chat.filter(function (c) { return !c.sys }).slice(-20).map(function (c) { return { role: c.role, content: c.content } }) }) })
      var j = await r.json().catch(function () { return {} })
      if (r.ok && j.reply) { busy = false; await say(j.reply) }
      else if (j.error === 'brain_offline') { busy = false; chat.pop(); chat.push({ role: 'user', content: text }); L.viaKb = 0; var okL = await local(text)
        if (!okL) { logUnanswered(text); var fb = fallbackText(text), arT = /[؀-ۿ]/.test(text); logReview(text, fb, 'pending')
          await say(isDir ? fb : (arT ? 'مش متأكدة إني فهمتك صح، فمش هخمّن. بعت سؤالك للمراجعة وهرجعلك بالرد هنا وعلى الجرس. وفي الوقت ده تقدر تسألني عن أي قسم في Z Cloud أو عن رصيد إجازاتك.' : 'I am not sure I understood you correctly, so I will not guess. I sent your question for review and I will come back with the answer here and on the bell. Meanwhile you can ask me how any part of Z Cloud works, or about your leave balance.')) }
        else if (L.viaKb) logReview(text, lastNour(), 'answered')
        L.viaKb = 0 }
      else { busy = false; await say(j.message || (L.lang === 'ar' ? 'حصلت مشكلة، جرب تاني.' : 'Something went wrong, please try again.')) }
    } catch (e) { busy = false; await say(L.lang === 'ar' ? 'في مشكلة في الشبكة.' : 'Network problem.') }
    busy = false; setState('idle'); if (L.live && L.started && tab === 'chat') setTimeout(listen, 500)
  }

  // proactive: while NOUR is open she watches for new items and speaks up on her own
  function startWatch() {
    clearInterval(L.poll)
    L.poll = setInterval(async function () {
      if (EMB && !app.isConnected) { clearInterval(L.poll); stopListening(); stopSpeaking(); return }
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
    var ai = h('div', { class: 'pill bad', role: 'status', style: 'margin:6px 0;display:inline-block' }, 'NOUR is online in BASIC mode (built-in, private, no external AI). Full AI conversation: OFFLINE until a key is added.')
    main.appendChild(ai)
    ;(async function () { try { var r = await sb.functions.invoke('nour-chat', { body: { ping: true } }); if (r.data && r.data.key_present) { ai.className = 'pill warn'; ai.textContent = 'AI conversation: key present, not yet live-tested' } } catch (e) { /* stays OFFLINE */ } })()
    var wrap = h('div', { class: 'live' }), av = avatarSVG()
    var st = h('div', { id: 'nst', class: 'nst' }), list = h('div', { id: 'nlist', class: 'msgs' })
    var inp = h('textarea', { id: 'nin', dir: 'auto', placeholder: L.lang === 'ar' ? 'اكتب أو اتكلم…' : 'Type or speak…', maxlength: '2000' })
    var send = h('button', { class: 'p' }, L.lang === 'ar' ? 'إرسال' : 'Send')
    var mic = h('button', { class: 's', title: 'Mic' }, '🎙'), live = h('button', { class: 's' }, L.live ? 'Live: on' : 'Live: off'), lang = h('button', { class: 's' }, L.lang === 'ar' ? 'عربي' : 'EN'), mute = h('button', { class: 's' }, L.mute ? 'Voice: off' : 'Voice: on'), vc = h('button', { class: 's' }, L.lang === 'ar' ? 'غيّر الصوت' : 'Change voice')
    var start = h('button', { class: 'p big' }, tx().start)
    chat.forEach(function (c) { list.appendChild(h('div', { class: 'm ' + (c.role === 'user' ? 'u' : c.sys ? 'sys' : 'n'), dir: 'auto' }, c.content)) })
    function go() { var t = inp.value.trim(); if (!t) return; inp.value = ''; if (!L.started) { L.started = true; startWatch() } handle(t) }
    var dictating = false, dtimer = null
    inp.addEventListener('input', function () { if (!dictating) return; clearTimeout(dtimer); dtimer = setTimeout(function () { if (dictating && inp.value.trim()) { dictating = false; go() } }, 2500) })
    send.addEventListener('click', function () { dictating = false })
    send.addEventListener('click', go); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go() } })
    mic.addEventListener('click', function () { if (!SR) { notice(L.lang === 'ar' ? 'الميكروفون جوه التطبيق ده مش مدعوم. الحل: دوس على خانة الكتابة واستخدم زرار الميكروفون اللي في كيبورد التليفون (الكتابة الصوتية) وكلّمني، ولما تسكت ثانيتين هبعت كلامك لوحدي. في Chrome الميكروفون بيشتغل عادي.' : 'Voice input is not supported in this app. Tap the text box and use your keyboard\'s microphone key, then Send. In Chrome the mic works directly.'); dictating = true; try { document.getElementById('nin').focus() } catch (e) {} return } L.started = true; startWatch(); if (L.state === 'listening') stopListening(); else listen() })
    live.addEventListener('click', function () { L.live = !L.live; live.textContent = L.live ? 'Live: on' : 'Live: off'; if (L.live) listen(); else stopListening() })
    lang.addEventListener('click', function () { L.lang = L.lang === 'ar' ? 'en' : 'ar'; stopListening(); stopSpeaking(); render() })
    mute.addEventListener('click', function () { L.mute = !L.mute; mute.textContent = L.mute ? 'Voice: off' : 'Voice: on'; if (L.mute) stopSpeaking() })
    vc.addEventListener('click', function () {
      var c = voiceList(); if (!c.length) { addMsg('assistant', L.lang === 'ar' ? 'جهازك مفيهوش أصوات عربي. جرّب Chrome أو Edge، أو نزّل صوت عربي من إعدادات النظام.' : 'No voices for this language on this device.', true); return }
      var cur = pickVoice(), i = (c.indexOf(cur) + 1) % c.length, v = c[i]
      try { localStorage.setItem('nour_voice_' + L.lang, v.name) } catch (e) {}
      L.started = true; stopSpeaking(); setState('speaking')
      addMsg('assistant', (L.lang === 'ar' ? 'ده صوتي دلوقتي (' : 'Voice (') + v.name + ' ' + (i + 1) + '/' + c.length + ')', true)
      speakBrowser(L.lang === 'ar' ? 'أهلاً، أنا نور. تحب أكلمك بالصوت ده؟' : 'Hi, I am NOUR. Shall I use this voice?').then(function () { setState('idle') })
    })
    start.addEventListener('click', function () { L.started = true; start.parentNode.style.display = 'none'; startWatch(); briefing() })
    wrap.appendChild(av); wrap.appendChild(st)
    if (!L.started) wrap.appendChild(h('div', { class: 'center' }, start, h('div', { class: 'priv' }, 'One tap lets the browser play her voice. After that she talks on her own.')))
    wrap.appendChild(list)
    wrap.appendChild(h('div', { class: 'row ctl' }, mic, live, lang, mute, vc))
    var cap = h('div', { class: 'priv', dir: 'auto' })
    function capText() {
      var nv = voiceList().length, ar = L.lang === 'ar'
      cap.textContent = (ar ? 'الصوت: ' : 'Voice: ') + (!ttsOK() ? (ar ? 'غير مدعوم هنا' : 'not supported here') : nv ? (ar ? 'جاهز (' + nv + ' صوت)' : 'ready (' + nv + ' voices)') : (ar ? 'مفيش صوت للغة دي على الجهاز' : 'no voice for this language on this device')) + '  ·  ' + (ar ? 'الميكروفون: ' : 'Mic: ') + (SR ? (ar ? 'مدعوم' : 'supported') : (ar ? 'غير مدعوم هنا (استخدم الكتابة الصوتية من الكيبورد)' : 'not supported here (use keyboard dictation)'))
    }
    capText(); setTimeout(capText, 1500); setTimeout(capText, 4000); wrap.appendChild(cap)
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
  function noticeEN(d) { return d.handler_is_director ? 'Concerns and complaints sent through this channel are saved securely in Z Cloud and go privately to the Director (Amir). Other employees and HR administrators cannot see them. No email is sent. Information may be shared only when necessary for authorised follow-up, safety or legal obligations. We cannot promise absolute confidentiality.' : 'Concerns and complaints sent through this channel go privately to the recipient designated by the company. Other employees and HR administrators cannot see them. Information may be shared only when necessary for authorised follow-up, safety or legal obligations. We cannot promise absolute confidentiality.' }
  function noticeAR(d) { return d.handler_is_director ? 'أي شكوى أو ملاحظة بتبعتها من هنا بتتحفظ بشكل آمن في Z Cloud وبتوصل بشكل خاص لأمير (المدير). الزملاء ومسؤولي الـ HR مش بيشوفوها، ومفيش إيميل بيتبعت. المعلومات ممكن تتشارك بس لو ده ضروري للمتابعة المصرح بيها أو لحماية السلامة أو لالتزام قانوني. مش بنقدر نوعد بسرية مطلقة.' : 'أي شكوى أو ملاحظة بتبعتها من هنا بتوصل بشكل خاص للجهة اللي الشركة حددتها لاستلام الشكاوى. الزملاء ومسؤولي الـ HR مش بيشوفوها. المعلومات ممكن تتشارك بس لو ده ضروري للمتابعة المصرح بيها أو لحماية السلامة أو لالتزام قانوني. مش بنقدر نوعد بسرية مطلقة.' }
  var HELD_EN = ['What happens to a held concern', 'It is saved securely and is not sent to HR administrators or to other employees. No email is sent about it. You can follow its status under "My cases" here. When a recipient is set, the concern moves to that person, and the status here will show it.', 'You do not have to wait. You can also: speak to a trusted person outside your reporting line; contact the Labour Office or Ministry of Manpower; get independent legal advice. In an emergency or if you feel unsafe, call 122 (police) or 123 (ambulance).']
  var HELD_AR = ['إيه اللي بيحصل للشكوى المحجوزة', 'بتتحفظ بشكل آمن ومش بتتبعت لمسؤولي الـ HR ولا لأي موظف تاني، ومفيش إيميل بيتبعت عنها. تقدر تتابع حالتها من "قضاياي" هنا. أول ما يتحدد المستلم المستقل، الشكوى بتروح له وحالتها هتظهر هنا.', 'مش لازم تستنى. تقدر كمان: تكلم شخص موثوق برا خط الإدارة بتاعك، أو تتواصل مع مكتب العمل أو وزارة القوى العاملة، أو تاخد استشارة قانونية مستقلة. في حالة الطوارئ أو لو حاسس إنك مش في أمان، اتصل بـ 122 (الشرطة) أو 123 (الإسعاف).']
  function heldHelp() {
    return h('div', { class: 'held' }, h('h3', {}, HELD_EN[0]), h('p', { dir: 'auto' }, HELD_EN[1]), h('p', { dir: 'auto' }, HELD_EN[2]),
      h('h3', { dir: 'rtl' }, HELD_AR[0]), h('p', { dir: 'rtl' }, HELD_AR[1]), h('p', { dir: 'rtl' }, HELD_AR[2]))
  }
  function privacyNotice(d) {
    var box = h('div', { class: 'card notice' }, h('h3', {}, 'How your concern is handled'), h('p', { dir: 'auto' }, noticeEN(d)), h('p', { dir: 'rtl' }, noticeAR(d)))
    box.appendChild(h('p', { class: d.independent_ready ? 'mut' : 'warnline', dir: 'auto' }, d.independent_ready ? 'The complaints recipient is set up.' : 'The complaints recipient is not set up yet. A concern sent now would be held securely: nobody (not HR or other employees) could read it until a recipient is set.'))
    if (!d.independent_ready) box.appendChild(heldHelp())
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
    cats.forEach(function (c) { sel.appendChild(h('option', { value: c }, c.replace(/_/g, ' '))) })
    async function send() {
      btn.disabled = true
      var r = await sb.rpc('nour_case_open', { p_ws: ws, p_category: sel.value, p_summary: sum.value.trim(), p_urgent: urg.checked })
      btn.disabled = false; clear(out)
      if (r.error) { out.appendChild(msg('err', 'Could not open the case: ' + r.error.message.replace(/^[A-Z_]+: /, ''))); return }
      out.appendChild(msg('ok', 'Received. Case ' + r.data.code + '. ' + r.data.notice)); sum.value = ''
      setTimeout(render, 1800)
    }
    btn.addEventListener('click', function () {
      if (sum.value.trim().length < 10) { clear(out); out.appendChild(msg('err', 'Please write a little more detail.')); return }
      send()
    })
    main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Raise a concern'),
      h('label', {}, 'Type'), sel, h('label', {}, 'What happened'), sum,
      h('label', { class: 'row' }, urg, 'It is urgent or about safety'),
      h('div', { style: 'margin-top:10px' }, btn), h('div', { style: 'margin-top:10px' }, out)))
  }
  var ROUTE_TXT = { director: 'With the complaints recipient', independent: 'With the complaints recipient', held: 'Held securely: the complaints recipient is not set up yet' }
  async function myCases(main) {
    var r = await sb.from('nour_cases').select('*').eq('workspace_id', ws).eq('reporter_id', me.id).order('created_at', { ascending: false }).limit(20)
    if (r.error || !r.data.length) return
    var box = h('div', { class: 'card' }, h('h3', {}, 'My cases'), h('div', { class: 'mut' }, 'You only ever see your own cases here.'))
    for (var i = 0; i < r.data.length; i++) {
      var c = r.data[i], ev = await sb.from('nour_case_events').select('*').eq('case_id', c.id).order('at')
      var ta = h('textarea', { dir: 'auto', placeholder: 'Add a message to the case' })
      var item = h('div', { class: 'case', style: 'margin-top:10px' }, h('div', { class: 'row' }, h('b', {}, c.code), h('span', { class: 'pill warn' }, c.status), h('span', { class: 'sp' }), h('span', { class: 'mut' }, when(c.created_at))),
        h('div', { class: 'mut', dir: 'auto' }, ROUTE_TXT[c.route] || ''), c.route === 'held' ? heldHelp() : null, c.outcome ? h('div', { dir: 'auto' }, h('b', {}, 'Outcome: '), c.outcome) : null)
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

  // ---------- cases dashboard (ONLY the designated independent recipient) ----------
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
    var cs1 = (await sb.rpc('nour_complaints_status', { p_ws: ws })).data || {}
    if (cs1.test_waiting) {
      var tout = h('div', {})
      main.appendChild(h('div', { class: 'card notice' }, h('h3', {}, 'Confirm the test email'), h('div', { dir: 'auto' }, 'A test email (no complaint inside) was sent to your account address. Check that it arrived, then confirm. Confirm only if you are the company\'s designated complaints recipient. Complaints cannot be switched on until you confirm.'),
        h('div', { style: 'margin-top:8px' }, h('button', { class: 'p', disabled: cs1.test_status !== 'sent', on: { click: async function () { var x = await sb.rpc('nour_complaints_test_confirm', { p_ws: ws }); clear(tout); if (x.error) tout.appendChild(msg('err', x.error.message)); else { tout.appendChild(msg('ok', 'Confirmed.')); setTimeout(render, 900) } } } }, 'I received the test email')), h('div', { class: 'mut' }, 'Test email status: ' + (cs1.test_status || 'waiting') + (cs1.test_status === 'sent' ? '' : '. The button works once the mail service has sent it.')), h('div', {}, tout)))
    }
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
    var card = h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', {}, c.code), h('span', { class: 'pill ' + (c.priority === 'urgent' ? 'bad' : c.priority === 'high' ? 'warn' : '') }, c.priority), h('span', { class: 'pill' }, c.category.replace(/_/g, ' ')), h('span', { class: 'pill warn' }, c.status), h('span', { class: 'sp' })),
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
      var es = await sb.rpc('nour_case_email_status', { p_case: c.id }), ed = es.data || {}
      det.appendChild(h('div', { class: 'mut', style: 'margin-top:6px', dir: 'auto' }, 'Email notification to you: ' + (es.error ? 'unknown' : (ed.status === 'sent' ? 'delivered to the mail service' + (ed.sent_at ? ' ' + when(ed.sent_at) : '') : ed.status === 'failed' ? 'FAILED. ' + (ed.error || '') : ed.status === 'queued' || ed.status === 'sending' ? 'waiting to send' : 'not emailed'))))
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
      var acts = h('div', { style: 'margin-top:10px' }, h('div', { class: 'mut' }, 'Follow-up reminders for you only. Never write case details here.'))
      ;(a2.data || []).forEach(function (a) { acts.appendChild(h('div', { class: 'row', style: 'margin:4px 0' }, h('div', { class: 'sp', dir: 'auto' }, a.title + ' → ' + nm(a.assignee_id) + (a.due_date ? ' (due ' + a.due_date + ')' : '') + ' · ' + a.status),
        a.status === 'open' ? h('button', { class: 's', on: { click: async function () { var x = await sb.rpc('nour_case_action_set', { p_id: a.id, p_status: 'cancelled' }); if (x.error) alert(x.error.message); else render() } } }, 'Cancel') : null)) })
      var who = { value: me.id }
      var at = h('input', { dir: 'auto', maxlength: '200', placeholder: 'Action (do not write case details)' }), ad = h('input', { type: 'date' })
      acts.appendChild(h('div', { class: 'row', style: 'margin-top:6px' }, h('div', { class: 'sp' }, at), ad, h('button', { class: 's', on: { click: async function () { if (!who.value || !at.value.trim()) return; var x = await sb.rpc('nour_case_action_add', { p_case: c.id, p_assignee: who.value, p_title: at.value.trim(), p_due: ad.value || null }); if (x.error) alert(x.error.message); else render() } } }, 'Add reminder')))
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
    var out = h('div', {})
    async function patch(p, label) { var x = await sb.rpc('nour_set_settings', { p_ws: ws, p_patch: p }); clear(out); if (x.error) out.appendChild(msg('err', x.error.message)); else { out.appendChild(msg('ok', label + ' saved.')); var s = await sb.from('nour_settings').select('*').eq('workspace_id', ws).maybeSingle(); settings = s.data || settings; setTimeout(render, 700) } }
    main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Control'), h('div', { class: 'row' }, h('span', { class: 'pill ' + (settings.enabled && !settings.paused ? 'ok' : 'bad') }, settings.enabled ? (settings.paused ? 'Paused' : 'Running') : 'Off'), h('span', { class: 'sp' }),
      h('button', { class: settings.paused ? 'p' : 'd', on: { click: function () { patch({ paused: !settings.paused }, settings.paused ? 'Resumed' : 'Paused') } } }, settings.paused ? 'Resume NOUR' : 'Pause NOUR')),
      h('div', { style: 'margin-top:8px' }, out)))
    var cst = await sb.rpc('nour_complaints_status', { p_ws: ws }), cd = cst.data || {}, cout = h('div', {})
    function chk(ok, t) { return h('div', { class: 'row' }, h('span', { class: 'pill ' + (ok ? 'ok' : 'bad') }, ok ? 'OK' : 'Missing'), h('span', { class: 'mut' }, t)) }
    async function setAct(v) { var x = await sb.rpc('nour_complaints_set_active', { p_ws: ws, p_active: v }); clear(cout); if (x.error) cout.appendChild(msg('err', x.error.message)); else { cout.appendChild(msg('ok', v ? 'Confidential complaints are now active.' : 'Confidential complaints are switched off.')); var s2 = await sb.from('nour_settings').select('*').eq('workspace_id', ws).maybeSingle(); settings = s2.data || settings; setTimeout(render, 700) } }
    var chkd = await sb.rpc('nour_complaints_check', { p_ws: ws }), ck = chkd.data || {}

    var su = (await sb.rpc('nour_complaints_setup', { p_ws: ws })).data || {}, sx = (await sb.rpc('nour_complaint_stats', { p_ws: ws })).data || {}, rout = h('div', {}), rs = h('select', {}, h('option', { value: '' }, '— not set —'))
    Object.keys(names).forEach(function (id) { rs.appendChild(h('option', { value: id }, nm(id) + (roles[id] === 'director' ? ' (Director: complaints come to you)' : ''))) }); rs.value = su.handler_id || ''; rs.disabled = !!cd.active
    async function rcall(fn, args, okTxt) { var x = await sb.rpc(fn, args); clear(rout); if (x.error) rout.appendChild(msg('err', x.error.message)); else { rout.appendChild(msg('ok', okTxt)); setTimeout(render, 900) } }
    function rtile(n, l) { return h('div', { class: 'tile' }, h('b', {}, String(n == null ? 0 : n)), h('span', {}, l)) }
    main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Confidential complaints recipient'),
      h('div', { class: 'mut', dir: 'auto' }, 'Every employee complaint is saved in Z Cloud and goes to the recipient you choose here, with an alert on the bell. Choose your own account to receive them yourself, or another member (for example the company lawyer). HR administrators and other employees cannot read complaints. Complaints about you will also reach the recipient you choose. No email is needed. The recipient cannot be changed while the channel is active.'),
      h('label', {}, 'Recipient account'), rs,
      h('div', { style: 'margin-top:6px' }, h('button', { class: 's', disabled: !!cd.active, on: { click: function () { rcall('nour_complaints_handler_set', { p_ws: ws, p_handler: rs.value || null }, 'Recipient saved. The test confirmation was reset.') } } }, 'Save recipient')),
      h('div', { class: 'mut', style: 'margin-top:8px', dir: 'auto' }, su.configured ? 'Selected: ' + (su.handler_name || 'account') + (su.email_masked ? ' · test email goes to ' + su.email_masked : ' · this account has no email address') : 'No recipient selected. Complaints sent now would be held, readable by nobody.'),
      chk(!!su.test_confirmed, 'The recipient confirmed receiving the test email'),
      h('div', { class: 'mut', dir: 'auto' }, 'Test email status: ' + (su.test_status || 'not sent') + (su.test_error ? ' (' + su.test_error + ')' : '')),
      h('div', { style: 'margin-top:6px' }, h('button', { class: 's', disabled: !su.configured || !su.email_masked, on: { click: function () { rcall('nour_complaints_test_send', { p_ws: ws }, 'Test email queued. It contains no complaint. The recipient must confirm it in NOUR, Cases tab.') } } }, 'Send test email')),
      h('div', { class: 'mut', style: 'margin-top:10px' }, 'Counts only here. The full cases are in the Cases tab for the recipient.'),
      h('div', { class: 'tiles' }, rtile(sx.open, 'open'), rtile(sx.urgent_open, 'urgent'), rtile(sx.closed, 'closed'), rtile(sx.held_open, 'held (no recipient)'), rtile(sx.oldest_open_days, 'oldest open (days)')),
      h('div', { style: 'margin-top:8px' }, rout)))
    main.appendChild(h('div', { class: 'card' }, h('h3', {}, 'Confidential complaints'), h('div', { class: 'row' }, h('span', { class: 'pill ' + (cd.active ? 'ok' : 'bad') }, cd.active ? 'Active' : 'Not active'), h('span', { class: 'sp' }), h('button', { class: cd.active ? 'd' : 'p', on: { click: function () { setAct(!cd.active) } } }, cd.active ? 'Switch off' : 'Activate')),
      chk(!!ck.handler_set, 'Recipient selected (required to activate)'), chk(!!ck.handler_email_ok, 'Recipient account has an email address (optional: only for email copies)'),
      h('div', { class: 'mut', style: 'margin-top:6px', dir: 'auto' }, 'The channel opens as soon as a recipient is set. Employees fill in the form, the case is saved in Z Cloud, and the recipient sees it in the Cases tab and gets an alert. No email is sent unless the mail service is connected and the test email is confirmed. The recipient sees the employee name.'), h('div', { style: 'margin-top:8px' }, cout)))
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

  if (EMB) EMB.stop = function () { clearInterval(L.poll); L.live = false; L.started = false; L.mute = true; try { stopListening() } catch (e) {} try { stopSpeaking() } catch (e) {} }
  boot().catch(function (e) { fatal('Something went wrong: ' + (e && e.message || e)) })
})()
