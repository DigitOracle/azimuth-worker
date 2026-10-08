# Desk posting, phase 1 (v413)

From Kendall's own WhatsApp desk number, an Instagram post to @digitalabbotuae, from idea to numbers. Code: `src/desk_post.js` (the loop), `src/ig_desk.js` (Graph calls with the desk token), `src/desk.js` (routing; only `WA_DESK_OWNER` is answered).

## The rules the code enforces
- Nothing is posted without an explicit tap by the owner. `plan.approved === true` is set only by the Approve button; `deskIgPublish` and `deskIgPublishCarousel` refuse without it. There is no auto-post.
- Evidence: every number of two or more digits in a caption or slide must exist in the facts the writer was given (the `mkt_latest.facts` ledger), or be an identifier in the idea itself (ISO 30173, SC 10) or in our own events record. Otherwise the line is dropped and the preview card says what was left out. Developer claims are labelled "developer says"; register facts carry the register period in the SOURCE line. Numbers written in words are dropped. A figure Kendall adds with "add ..." is accepted but marked "from your message, not independently checked" on the card, with no source line in the public caption.
- No AI vendor or model name in any caption, alt text or slide text (lines containing one are removed); "Dr. Digital Abbot" becomes "Dr. Kendall Wilson, DigitAlchemy"; "Digital Alchemy" is written DigitAlchemy; in the Alchemy lane "Blocks" becomes "digital footprint". No emoji anywhere. QR codes are never generated. Satellite pictures are never used.
- Any AI-composed picture adds the plain line "Illustration." to the caption. An unedited photo Kendall sends is posted as is, with no label.

## Lanes
Every plan has a lane. `/post abbot: <idea>` or `/post alchemy: <idea>`; with no lane the desk asks "Abbot or Alchemy?" with two buttons.
- Abbot: The Digital Abbot, Kendall's persona, "Complexity Into Clarity". First person, plain construction-audience language, acronyms explained, no hype: standards decoded, BIM / digital footprint / AI governance explainers, career stories, podcast teasers.
- Alchemy: the company and platform. Third person "we", proof and outcomes: platform, data governance, DigitOracle as the engine, project proof, training, events, partnerships. Hub71: member. Never cite Arabtec.

## Commands (desk number, owner only)
| Command | What it does |
|---|---|
| `/post <idea>`, `post: <idea>`, `/post abbot: ...` | creates `postplan_<id>` (image, or carousel when the idea says carousel/steps/guide/decoded or several pictures were sent) |
| `/post 1` to `/post 5` | drafts idea n from the last `/ideas` |
| a photo with caption `post: <idea>` | uses the photo as slide 1; photos sent with no caption wait (up to 10, 1 hour) for the next `/post` |
| `/ideas` | five ideas for the week (3 Abbot, 2 Alchemy) from fixed templates plus a ledger fact; an idea needing a fact we do not hold says "needs source" |
| `/queue` | open plans with slots, next free slots, daily cap, pause state |
| `/pause`, `/resume` | KV flag `desk_post_pause`; while set nothing publishes, the tick says so once |
| `/cost` | this month's picture count and estimated spend |
| `/insights` | last 5 posts: reach, likes, saves, link; followers |
| `/post cancel <id>` | cancels a plan that is not yet posted |
| `/post retry <id>` | manual retry of a held, approved plan; reuses stored containers, refuses if already posted |
| `/ref ...` | reference photos, see below |

Reels: answered with "Reels come in phase 2".

## The flow
1. Draft. The caption is written by the existing text helper (`claudeText`, Sonnet) from the idea, the lane voice and the fact ledger: hook, 2 to 4 lines, 3 to 5 hashtags, SOURCE line per figure. The evidence checks above run; untraceable figures are dropped.
2. Pictures, per slide, in this order: a picture Kendall sent; our own render (`img_render_<slug>`, slide 1, when the idea names a project that has one; JPEG only); a generated picture. Generated pictures are requested as JPEG at 1024x1024 (portrait 2:3 falls outside Instagram's 4:5 limit) and served through `/ig_media/<id>` (KV `igm_<id>`, 14 days). A PNG sent by Kendall is refused with a plain reason: send it as a photo.
3. Preview: slide 1 picture, the card (exact caption, evidence, what was left out, slide list, picture sources, music mode), and buttons Approve | Edit | Skip.
4. Improve: Edit puts the plan in `editing`; any free text is an instruction: shorter, punchier, more formal, add <fact>, remove <x>, swap image <n>, another background, Arabic version (caption only, card says "draft translation, please check"). Only the affected part is re-drafted, the checks re-run, history stored, a new preview sent. Max 10 rounds. A photo sent while editing replaces slide n.
5. Approve asks "Post now, or next slot (Mon/Wed/Sat 17:00 Dubai)?". Then status `scheduled`. Unapproved drafts expire after 3 days (approved plans keep 14 days to be scheduled).
6. Publish (the existing minute tick, `deskPostTick`): single image via container, poll, publish; carousel via child containers (`is_carousel_item`), parent (`media_type=CAROUSEL`, `children`, caption), poll, publish. Permalink via `GET /{media-id}?fields=permalink`. Success: "Posted <id>: <link>". One post per tick. Container ids are written to the plan the moment they exist, so a retry never makes a second container or a second post.
7. After: media id stored on the plan and in `desk_ig_media`; every 3 hours (same cron slot as her pull, `:17` on hours divisible by 3) `deskPostPull` reads followers and reach/likes/saved for desk-posted media.

## Carousel slides
Max 8 slides: slide 1 hook, 3 to 6 body slides (one fact or step each, small source line), last slide "What to do next" with the short legal line (`(c) 2026 DigitAlchemy(R) Tech Limited, ADGM No. 35004, All rights reserved, contact@digitalabbot.io`). Each slide is rendered by the image model from one locked prompt built deterministically from the slide spec (cream #FBF7EC, teal #0A4F4A, gold #C5A56A, "Render EXACTLY this text"). Code draws nothing. After generation the picture is read back by a vision call and compared with the expected text (normalised, 90 percent of words). Mismatch: regenerate, up to 2 more times, then the slide is flagged "text check failed, please look" on the preview. If no vision key exists the flag is "text not checked". The ADGM seal is not placed on API slides (it cannot be generated safely); add it by hand if wanted.

## People in pictures
- Default: no person. Carousel slides never contain a person.
- Abbot lane = Kendall. His likeness comes only from reference photos he uploads. Send a photo with the caption `ref: <tag>` or `/ref add <tag>` (tags: headshot, three-quarter, full-length, speaking, site, formal, casual). Stored as `desk_ref_<n>` `{tag, key, added, approved:true, source:"owner upload"}` with the bytes at `desk_refimg_<n>`. The reply is "Reference saved: <tag> (<n> total). Aim for 8 to 12: ..." with the checklist (front-facing neutral, three-quarter left and right, full-length, speaking, on site, formal and casual, good light, only him, no children or other people, no logos).
- `/ref list` (count by tag), `/ref remove <n>`, `/ref purge` (confirm button, deletes every desk reference and nothing of Najjuko's).
- A single-image Abbot post with at least 3 references is made through the images edits endpoint with 2 or 3 references (best-matching tag first, different angles): same face, build and apparent age, no body or age alteration, only him, no other identifiable real person, no medical or financial endorsement scene, no logos or text. Fewer than 3 references: a no-person image, and the card says references are needed.
- The Alchemy lane stays no-person unless the idea says "with Kendall".
- Najjuko's references (`img_style_*`) are never read on the desk. Stock-avatar references are for the podcast character only.
- Privacy: references live only in KV under `desk_ref*` keys, are never put on `/ig_media`, never served publicly, never written to text logs.

## Music (design only)
`plan.music = {mode: none | bed | manual}`, default `none` (captions and narration). Instagram's API cannot attach library or trending audio. `bed` means a licensed background track mixed in by us (phase 2, reels). `manual` means the finished reel is sent to Kendall's phone so he adds the song in the app. No code beyond the field in phase 1.

## KV keys (`MEETINGS`)
`postplan_<id>` (plan, 45 days), `postplan_index`, `desk_post_editing` (id being edited), `desk_post_pendimg`, `desk_post_pause`, `desk_post_pause_told`, `desk_ideas`, `desk_costs_<yyyymm>` `{count, est_usd}`, `desk_posts_day_<yyyy-mm-dd>` (Dubai date), `desk_ig_media`, `desk_ig_account`, `desk_ref_index`, `desk_ref_<n>`, `desk_refimg_<n>`, `igm_<id>` / `igm_ct_<id>` (pictures, existing route). Existing and unchanged: `ig_auth_desk`.
Plan record: `{id, status, lane, idea, type, caption, slides:[{img_key, alt, src, flag}], slot, created, expires_at, history[], rounds, music, approved, approved_at, containers, media_id, permalink, held_reason, evidence[], dropped[]}`. Status: draft, editing, approving, scheduled, publishing, posted, held, expired, cancelled, skipped.

## Caps and settings
- `IG_DAILY_CAP` (default 3 posts a day, Dubai date). Over the cap a plan moves to the next slot; a fourth is never posted that day.
- `IMG_MONTHLY_CAP_USD` (default 20). At the cap no picture is made; Kendall is told.
- `DESK_IMG_QUALITY` low|medium|high (default medium). The spend counter uses `IMG_COST_EST` (0.02 / 0.07 / 0.19 USD). These are planning ESTIMATES, not prices; the provider's docs gave no per-image price on 8 Oct 2026. Correct them from the first invoice.
- Model: `SCENE_MODEL` (same as the morning pictures), else `gpt-image-1`.
- Instagram allows 100 API-published posts per 24 hours; the daily cap of 3 is far inside that.

## Failure handling
Any failure sets the plan to `held` with the plain reason and sends ONE message. There is no automatic retry. Nothing publishes when `desk_post_pause` is set, when the desk token is missing or expired, or when `content_publish` is not in the permissions. A plan stuck in `publishing` for 10 minutes is held with "look at the Instagram feed before retrying". `/post retry <id>` is the only retry and it is Kendall's.

## Rollback
`/pause` stops publishing at once. `IG_AUTOPOST` is not a flag this loop reads: absent means off, and posting needs both the desk token (`ig_auth_desk` with `content_publish`) and an approval on each post, so there is nothing to switch off beyond `/pause`. To remove the feature, redeploy v412: no existing record is changed.

## What Kendall must do
Nothing new. The desk number, the owner variable and the Instagram desk link already exist (v404/v409). He sends reference photos when he wants his own likeness in Abbot pictures.

## Phase 2 / not built
Reels and music, Facebook Page cross-post, weekly analytics digest, loading the 12 Najjesty calendar posts, composing the ADGM seal on slides, click-to-WhatsApp links.
