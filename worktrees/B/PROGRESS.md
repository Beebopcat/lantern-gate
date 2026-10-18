# Agent B (battle) progress

Branch claude/wt-b, worktree /home/user/wt-B. Test server on 8103. Shots in /tmp/shots-B (not in git).

## Steps
- [x] 1. Read CLAUDE.md, BRIEF, HANDOFF, CHECKPOINT, battle.js, battle-data.js, old UI, rpg.js hookup, tests.
- [x] 2. qa/battle.rules.test.mjs (629 checks, mutation-checked) and engine fixes (see Findings).
- [x] 3. Arena UI: game/battle-ui.js + game/battle.css rewritten (diorama arena, sprite poses, Ward pips, Fray glyphs, Kindle, 8-turn strip, skills/items/targets, result screen).
- [x] 4. qa/battle.browser.test.mjs rewritten (old 44 checks kept, new UI checks added); all sections pass.
- [x] 5. Screenshots at 1280x720, 768x1024, 390x844, 844x390 looked at.
- [x] 6. Full suites run by the lead on the merged tree (engine 459, sprites 533, quest 581, battle.rules 629, battle.browser 183, classes 139, flow 123).
- [x] 7. Committed.

## Findings in battle.js / battle-data.js (fixed)
- Player-facing "focus" wording for mana in skill lists, hints, heal text (rule: mana, never focus).
- Shield Wall also set Guard, so it cut damage by 70% instead of the documented half. Now only the wall applies.
- AoE skills (Cleave, Frost Nova, Sweeping Blow) multiplied power per Kindle although their hints say "+1 sweep per Kindle". Now Kindle adds whole sweeps, so each sweep can chip Ward (consistent with Attack, Volley, Shot, Lash).
- Frost-slowed flag in the snapshot was false during the slowed round; now `>= round`.
- Turn events listed the strip after the actor had been removed from it (nobody current); now the actor leads its own strip.
- Opening `round` event carried a snapshot taken after fast foes had already acted; the replay now starts from the true opening.
- Flee skipped settle(), so no summary; flee now settles (summary for the result screen) and keeps GRACE + 3.
- Mage Attack was typed "blade" with a staff; now arcane (ranger bow, others blade).
- Act events reported Kindle spent in a field also used for the running Kindle count; renamed `spent`. Heal events: `focus` key renamed `mana`.
- Dead code / odd arithmetic cleaned (no-op splice, `*1` multipliers, hunter damage expression).
- Stagger semantics kept as the engine documents them: the foe loses its remaining turn(s) up to the end of the next round (one or two turns), takes +50%, then recovers, Ward refills and it is Steadied until it has acted.

## Final status
Done. The helper was stopped mid-way by an interruption; the lead finished it: made three browser checks robust (ranger opening hit, defeat read from the game log, reduced motion counted as requested pauses via `data-waited`), merged the branch and ran every suite. Engine contract kept: ctx.hurt, G.damage, ctx.use, seeded rng, nothing saved, settle/battleGrace.
