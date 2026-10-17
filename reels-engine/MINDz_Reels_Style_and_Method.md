# MINDz AI Reels Series — Locked Style & Method
Approved by Amir on 17 Oct 2026 after reviewing Episodes 01–03. Use this for every new episode so the series stays one universe.

## 1. What the series is
Short (20–35 s) vertical Reels that combine **comedy, cinematic storytelling and one marketing idea**. Each episode works on its own and without sound. Entertainment or real value comes first, MINDz comes last.

## 2. Style rules (do not drift)
| Element | Rule |
|---|---|
| Palette | Navy world #020818 → #081F3E → #0D5FB3, cyan #00FBFC as the "signal", brand yellow #FCFF59 only for alerts and punchlines. White text. No other brand colours. Loud off-brand colours only inside a "noise" scene (e.g. the Ep 02 marketplace), then desaturated when the story turns. |
| Signature | Volumetric light beam from the top + cyan horizon/floor line. Appears in every episode and on the end card. |
| Mascot | The official brain mascot only. 4 official poses (standing, wave, thinking, cheering) + the HD standing cut-out for close-ups. Acting comes from pose swaps, squash/stretch, hops, rotation, sweat drops. Never redraw or alter it. It is a guest, not in every shot. |
| Logo | Composited from the supplied file on the end card only. Never regenerated. |
| Type | Cairo (brand font), 800–900 weight. Arabic subtitles burned in, inside a dark rounded pill at y≈1385. |
| Language | Egyptian Arabic for on-screen text and voice-over. English only for names and tags (e.g. "Content", "Final_FINAL"). |
| Humour | Situational, never at a real person or client. No real employees, clients, brands or logos. No invented statistics. Education content is labelled "رسم توضيحي — مش أرقام حقيقية" when illustrative. |
| Claims | Never imply branding or views guarantee sales. Always say that the objective decides the metric. |
| Safe zone | Key content inside y = 250–1500 of 1920. |
| End card | Logo, one human line, mindz-agency.com, info@mindz-agency.com. No WhatsApp. CTA = share / save / "ابعتلنا Inbox". |
| Loop | Last 0.55 s dissolves back into frame 1. |
| Sound | Original synthesised music + SFX only (no third-party audio). Escalation = accelerating pulse + riser. The joke or lesson lands on a **hard cut to silence**, then a sting on the end card. Loudness ≈ −14 to −16 LUFS. |

## 3. Episode structure that worked
1. **Hook in the first second** (recognisable situation or a counter already running).
2. **Escalation** with a visible counter/HUD so the absurdity is measurable.
3. **Hard cut to silence** (the "freeze").
4. **Turn / reveal** (mascot or a quiet scene).
5. **Takeaway line**, end card, loop.
Titles of the three delivered: Just One Small Change · The Invisible Brand · Views Don't Pay the Bills.

## 4. Production method (what is actually built)
Not generative video. Each episode is a deterministic **canvas animation** (`draw(t)` is a pure function of time), rendered frame by frame at 1080×1920 / 30 fps and muxed with synthesised audio.

Files (source is saved in the GitHub branch `social-assets`, folder `reels-engine/`):
- `engine.js` — shared helpers: easing, text (RTL Arabic), mascot, bubbles, stickies, subtitles, end card, vignette/grain, camera shake.
- `ep1.js`, `ep2.js`, `ep3.js` — one scene file per episode. Each sets `DUR`, `SUBS` (subtitle/VO lines with times; `hide:true` hides a line on screen but keeps it in the SRT), and `EVENTS` (sound cues with times).
- `render.py` — `python3 render.py epN` renders `out/epN_silent.mp4`; `python3 render.py epN stills 3 7.5 12` renders preview PNGs.
- `meta.py` — dumps SUBS/EVENTS to `out/epN_meta.json`.
- `sfxlib.py` — synth SFX/music helpers, mixer, and `mux()` (loudnorm to −14 LUFS, AAC 224k, 48 kHz).
- `audio_epN.py` — builds the audio for one episode from its events.
Pipeline for a new episode: copy `ep3.js` → `ep4.js`, write the scene and SUBS/EVENTS → `render.py ep4 stills …` to check frames → `meta.py ep4` → copy an `audio_ep*.py` and adapt → `render.py ep4` → `mux()` → QA.

Assets: `assets/mas_{hips,wave,think,cheer}.png` (cut from the official pose sheet), `mas_hipsHD.png`, `logo.png`, `Cairo.ttf`.

## 5. QA checklist (run on the exported MP4)
- ffprobe: 1080×1920, 30 fps, H.264 yuv420p, AAC 48 kHz stereo, duration within the brief.
- blackdetect: only intentional black (the silence beat).
- ebur128: ≈ −14 to −16 LUFS.
- Contact-sheet of 12+ frames: text clipping, overlaps (subtitle vs. on-screen text), duplicate text (hide the subtitle when the same line is big on screen), mascot never covering the key object.
- Check the file you deliver, not the preview.

## 6. Open items
- **Voice-over** not recorded yet. Egyptian voices exist in the ElevenLabs connector (Tamer, Mahmoud Soliman, Gamal). Needs Amir's OK because it spends credits.
- **Two reference Reels** (instagram.com/reel/DcrOEkgI7QE, /DcD-xxpqVCr) not analysed — Instagram blocks access. Need MP4s or screen recordings.
- Audio checked by measurement, not by listening.
- Nothing is scheduled or published without Amir's approval.
- If a generative video route is ever connected (Weave or the full ElevenLabs connector), the episode files contain prompts for it. Credits need explicit approval.
