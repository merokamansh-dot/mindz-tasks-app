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
    var t = [['chat', 'Ask NOUR'], ['me', 'My HR'], ['concern', 'Confidential']]
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

  // ---------- chat ----------
  function vChat(main) {
    var box = h('div', { class: 'chat' }), list = h('div', { class: 'msgs' }), ta = h('textarea', { placeholder: 'اسألني عن إجازاتك أو أي حاجة في الـ HR… / Ask about leave, policies, or a concern', dir: 'auto', maxlength: '4000' }), send = h('button', { class: 'p' }, 'Send')
    if (!chat.length) list.appendChild(msg('m sys', 'I can show your leave balances, add follow-ups, explain policy (flagging anything unverified) and open a confidential case if you ask me to.'))
    chat.forEach(function (c) { list.appendChild(h('div', { class: 'm ' + (c.role === 'user' ? 'u' : c.sys ? 'sys' : 'n'), dir: 'auto' }, c.content)) })
    async function go() {
      var t = ta.value.trim(); if (!t || busy) return
      busy = true; send.disabled = true; ta.value = ''
      chat.push({ role: 'user', content: t }); render2()
      try {
        var tok = (await sb.auth.getSession()).data.session.access_token
        var r = await fetch(C.url + '/functions/v1/nour-chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, apikey: C.anonKey }, body: JSON.stringify({ workspace_id: ws, messages: chat.filter(function (c) { return !c.sys }).map(function (c) { return { role: c.role, content: c.content } }) }) })
        var j = await r.json().catch(function () { return {} })
        if (r.ok && j.reply) chat.push({ role: 'assistant', content: j.reply })
        else if (j.error === 'brain_offline') chat.push({ role: 'assistant', sys: true, content: "NOUR's AI brain is not connected yet (key pending). The other tabs work now." })
        else chat.push({ role: 'assistant', sys: true, content: j.message || ('NOUR could not answer (' + (j.error || r.status) + ').') })
      } catch (e) { chat.push({ role: 'assistant', sys: true, content: 'Network problem. Please try again.' }) }
      busy = false; render2()
    }
    function render2() { if (tab === 'chat') render() }
    send.addEventListener('click', go)
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go() } })
    box.appendChild(list); box.appendChild(h('div', { class: 'compose' }, ta, send))
    box.appendChild(h('div', { class: 'priv' }, 'Chats are not stored. Actions NOUR takes are logged.'))
    main.appendChild(box); setTimeout(function () { list.scrollTop = list.scrollHeight }, 0)
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
  function vConcern(main) {
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
