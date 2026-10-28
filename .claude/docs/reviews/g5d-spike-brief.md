# G5d pipeline spike: the brief (both spikes read this)

Repo: /Users/fred/Programming/sicompetition (branch g5d-look). Read first: `CLAUDE.md`; `.claude/docs/plans/g5d-look.md`
(D58, the checklist); `.claude/docs/reviews/g5d-directions.md` (why Floor won, and its fix list, especially rows 1 to 6).
Look at the chosen direction at full size: `Temp/direction/floor/screen.png`, `yard.png`, `scene.png`, `tile.png`, and
the generated key frame `Temp/AgentMockups/wp1-floor-key2.png` (the camera, the light and the finish to match).

## The question
Floor's art must be one consistent set: about 6 breeds × 3 poses of dogs, an adult crew member in 2 or 3 poses, the GM
(a faceted charcoal orb with one glowing amber band) in three states (getting ready, running the week, the week is over),
and the board (an isometric lawn with a fence and a small clubhouse). Two critics said generated sprites drift in camera,
light and facet density, and that the robust route is real low-poly models rendered from one locked camera and light.
Two spikes make the SAME sample by two methods; three readers then judge them side by side. Yours is one of them.

## The sample (both spikes, identical)
1. A corgi and a golden retriever, each in three poses: moving (trot), sitting, asleep (curled or lying).
2. One adult crew member (a woman in a teal polo and dark trousers, as in the key frame), standing with a leash.
3. The GM orb in three states: getting ready (band dim, a slow pulse suggested by a second faint ring), running the week
   (band bright amber), the week is over (band bright, a small upward chevron of light or a halo ring: your call, but it
   must read as "done", never as a face).
4. A piece of the board: 4 × 4 lawn tiles in a checker of two greens, one fence run along the back two edges, one corner
   of the clubhouse, square corners (no chamfer).
5. `composite.png` at 1366 × 768: the board piece filling the right ~60%, the six dog sprites, the crew and the running
   GM placed on it at the yard's scale (dogs about 60 to 100 px long), with soft contact shadows, nothing overlapping.
   Leave the left 40% light grey (the page's rail goes there).

Every sprite a separate transparent PNG (real alpha, no halo on light or dark), trimmed, with a recorded foot anchor
(the point that touches the ground) and facing (left or right). All sprites at one scale: a golden is about 1.6 × a
corgi's length; the crew member about 2.2 × a standing golden's height.

## Deliverables in your folder
`sprites/*.png`, `board.png`, `composite.png`, `anchors.json` (file → foot anchor x,y and facing), and `notes.md`:
the method step by step; how long each asset took; how a new breed or pose would be made and how long it would take;
the file sizes; what you could not get right; and your honest read of whether it clears the bar in the plan.

Check every sprite yourself with `Tools/Agent/art_qa.py` (Python with Pillow: the venv at
/private/tmp/claude-501/-Users-fred-Programming-sicompetition/9c74a94f-1bb4-4136-a87c-c77ebfa56034/scratchpad/venv/bin/python, run with -I)
and look at every crop: anatomy (one head, the legs and paws the pose shows, one tail), adult crew, no text, no halo.

Do not touch any tracked file, `package.json` or `node_modules/` at the repo root. Write only in your own folder (and,
for spike A, `Temp/AgentMockups/` through the script). Stop at the sample: this decides a method, it is not production.
