# INDEX NINE: portable B3 suspense workflow

This fork adds a repeatable B3 route for original 8–9 minute suspense stories. The canonical instructions are in [`skills/directing-stickman-videos/references/b3-suspense-series.md`](../skills/directing-stickman-videos/references/b3-suspense-series.md); the renderer, validators, voice and cover helpers are in the same Skill directory. The original project's other styles remain available. The first three case numbers and public post receipts are in [`examples/index-nine/series-registry.json`](../examples/index-nine/series-registry.json).

## Run in a new local environment

Install Node.js 20+, FFmpeg/ffprobe with H.264/AAC and `drawtext`, Python 3, Pillow and `faster-whisper` (for voice alignment). A machine must have enough disk for the source media and rendered video. Extract the Skill release ZIP or use this repository's `skills/directing-stickman-videos` directory, then run `npm ci` and `npm run doctor` there. Each episode source ZIP has one self-contained directory with `project.json` and relative media paths. Google Kore TTS needs `GEMINI_API_KEY` only when generating a **new** paid voice; the archived episodes already include their narration. New stories start with a local placeholder voice.

```sh
node scripts/b3-series-registry.mjs summary /path/to/series-registry.json
node scripts/autopilot.mjs validate /path/to/INDEX_NINE_FILE002/project.json
node scripts/b3-series-check.mjs /path/to/INDEX_NINE_FILE002/project.json
node scripts/autopilot.mjs preview /path/to/INDEX_NINE_FILE002/project.json --seconds 20
```

The Skill's `npm test` passed 225 tests. FILE 002 and 003 each passed `validate`, `b3-series-check` and a newly rendered, fully decoded 20-second preview from fresh ZIP extractions. These are technical checks; dramatic performance, mix and cover still require viewing and listening.

## Story and visual direction

Begin with a recognizable everyday errand, a relationship or obligation, and one early contradiction. Each chapter moves through character goal, observed clue, visible action, cost and next decision. Escalate the personal stakes, not only the anomaly's rules. Use the approved solid pictogram people, gray and white props, case ID on every story shot, 7–9 meaningful chapter boxes, restrained red clues, light bound to physical sources, continuous faint TV snow and short faults at plot turns. Keep the heavy opening fault and the reusable cat archivist ending. The separate 3:4 cover must be checked at profile-grid size.

## Repair and publish

Record every recurring prop's states in `prop-continuity.json`; do not cover a vanished item with a dark rectangle. Rebuild only the affected shot clips. A voice swap with unchanged captions may copy the picture stream. When caption timings change, `b3-align-narration.py` realigns actual speech and `b3-caption-audio-remux.py` reuses scene pixels while redrawing the caption band and rebuilding the mix from a single verified voice. Do not order new paid TTS because a mixed soundtrack merely sounds doubled; audition the dry voice first.

The two later videos were published to TikTok with Buffer and their custom 3:4 covers were then uploaded separately through TikTok Studio's post editor. Buffer's video composer offered a frame offset, not a custom image. The Studio route is `Posts → Edit → Edit cover → remove default frame image → Upload cover image → Save cover → Save post`; verify the actual grid thumbnail and distinguish any cover review state from a public video receipt. Verify the live interface before every run.

## Release assets

The `index-nine-b3-v1` release carries the Skill ZIP, three full films, three portable source ZIPs, FILE 002/003 3:4 covers, the registry and publish notes. The large MP4 and source archives are release assets rather than Git blobs so a normal clone stays usable. FILE 001 uses the selected Helena voice; FILE 002 and 003 use Google Kore. The branch and release do **not** prove unattended execution inside Dot or another agent host; that host must pass the same fresh-environment checks and supply local rendering plus connected publishing access.
