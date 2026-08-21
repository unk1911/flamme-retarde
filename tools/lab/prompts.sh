# The prompts under test. The one that shipped is AERIAL's opposite: the live
# clip is a chase cam behind a Canadair over Sibenik and it was restyled with a
# description of a cabin interior. At cfg 1.0 the positive prompt is the ONLY
# text steering there is, so that is not a cosmetic mismatch — it is the model
# being told to find wood, plaster, tile, fabric and glass in an aerial of the
# Adriatic, and spending its whole conditioning budget failing to.

# What actually shipped, kept verbatim as the control. If AERIAL does not beat
# this, the prompt was not the problem and I want to know that.
INTERIOR="photorealistic footage of a Dalmatian seaside holiday cabin interior \
and terrace in bright August afternoon light, real photographed video, natural \
sunlight through windows, real wood and plaster and tile surfaces, shallow \
depth of field, film grain, 35mm, sharp fine detail, real fabric, real glass, \
cinematic colour grade"

AERIAL="photorealistic aerial footage of a yellow Canadair CL-415 firefighting \
seaplane flying low over the Dalmatian coast near Sibenik, filmed from a \
helicopter, deep blue Adriatic sea, white limestone karst hills, dark green \
pine and maquis scrub, red-tiled roofs of a coastal town, wildfire smoke \
rising from the hills, bright August afternoon sun, atmospheric haze on the \
horizon, real photographed video, film grain, 35mm, sharp fine detail, \
cinematic colour grade"

# Same scene, but every term is a property of the CAMERA rather than of the
# world. If the render still reads as a game at correct content, the missing
# cue is photographic rather than semantic, and this separates the two.
GRAIN="aerial photograph of a yellow Canadair CL-415 firefighting seaplane over \
the Adriatic coast near Sibenik, shot on 35mm film, heavy film grain, halation \
around highlights, slight chromatic aberration, telephoto lens compression, \
shallow depth of field, handheld camera, documentary news footage, sun haze \
and lens flare, natural unsaturated colour, real photographed video"

# The fire is the entire premise of the game and every restyle so far has
# deleted it. AERIAL says "wildfire smoke rising from the hills", which is
# evidently too weak — smoke is atmosphere, and what the control frame contains
# is a field of small bright orange flames. Named explicitly, and first.
FIRE="photorealistic aerial footage of a yellow Canadair CL-415 firefighting \
seaplane over a large forest fire burning on the hills near Sibenik, Croatia, \
bright orange flames and a thick brown smoke plume rising from burning pine \
forest, filmed from a helicopter, deep blue Adriatic sea below, white \
limestone karst, red-tiled roofs of a coastal town, bright August afternoon \
sun, real photographed news video, film grain, 35mm, cinematic colour grade"

# FIRE put snow on the Dinarides in August. "White limestone karst" is the
# likely culprit — white plus mountain reads as snow to the prior, and at
# cfg 1.0 the negative prompt is inert so it cannot simply be forbidden. The
# repair has to be positive and specific: name the season, the heat, and the
# colour of bare rock in summer.
FIRE2="photorealistic aerial footage of a yellow Canadair CL-415 firefighting \
seaplane over a forest fire burning on the hills near Sibenik, Croatia, in \
high summer, orange flames and thick brown smoke rising from burning pine \
forest, bare grey limestone ridges baked in August heat, dry golden scrub, \
deep blue Adriatic sea, red-tiled roofs of a coastal town, filmed from a \
helicopter, harsh midday sun, heat haze, real photographed news video, \
film grain, 35mm, cinematic colour grade"

# ── the three scripted beats, filmed by tools/scene.mjs ──────────────────────
# One prompt per shot, which is the lesson of the 33-run matrix: at cfg 1.0 the
# positive prompt is the whole of the text conditioning, so it has to describe
# the picture that is actually in the control frames.

# R — the race off the jetty at Jadrija.
JETTY="photorealistic footage of a concrete jetty on a Dalmatian beach near \
Sibenik, Croatia, in high summer, two young women in swimsuits standing on the \
jetty, one diving into clear turquoise Adriatic water, a low green island \
across the channel, small white boats moored, bare limestone and dry golden \
scrub, bright August midday sun, real photographed holiday video, film grain, \
35mm, cinematic colour grade"

# The same beat shot as if from a drone, which the camera arc nearly is.
JETTY2="photorealistic drone footage over a stone jetty on the Adriatic coast \
near Sibenik, Croatia, crystal clear shallow turquoise water over pale sand, \
two swimmers, moored wooden boats, a green island on the horizon, high summer, \
harsh midday sun, real photographed aerial video, film grain, 35mm, cinematic \
colour grade"

# J — under the canopy, coming down over the fire.
CHUTE="photorealistic aerial footage descending under a parachute over the \
coast near Sibenik, Croatia, a forest fire burning on the far shore with \
orange flames and thick brown smoke rising from burning pine forest, bare grey \
limestone ridges baked in August heat, dry golden scrub, deep blue Adriatic \
sea and islands, red-tiled roofs of a coastal town, harsh midday sun, heat \
haze, real photographed news video, film grain, 35mm, cinematic colour grade"

# The same, written for the wider turn where the sea fills the frame.
CHUTE2="photorealistic skydiving GoPro footage high over the Dalmatian coast \
near Sibenik, Croatia, deep blue Adriatic sea and green \
islands far below, wildfire smoke drifting over dry limestone hills, red-tiled \
coastal town, high summer, brilliant midday sun, real photographed video, \
film grain, 35mm, cinematic colour grade"

# O — the walk into the laptop on the upper floor of the vikendica.
DESK="photorealistic footage of an Alienware gaming laptop open on a white \
table in a bright Dalmatian seaside apartment, the camera moving slowly in \
towards the screen, RGB backlit keyboard glowing, wide glass doors open onto a \
terrace with the deep blue Adriatic and a green island behind, a television on \
the right, white tiled floor, brilliant August afternoon light, real \
photographed video, shallow depth of field, film grain, 35mm, cinematic \
colour grade"

DESK2="photorealistic close footage of a black gaming laptop with a glowing \
RGB backlit keyboard standing open on a white table, bright sea light from \
open terrace doors behind it, real aluminium and plastic surfaces, reflections \
on the dark screen, a Croatian news channel on a television beside it, real \
photographed video, shallow depth of field, film grain, 35mm, cinematic \
colour grade"

# The three things the branch does at Jadrija, filmed by tools/scene.mjs.
BLAZE="photorealistic footage of a young woman standing on a concrete beach \
promenade engulfed in bright orange flames, fire and sparks rising off her, a \
row of whitewashed beach changing huts with coloured doors behind her, dry \
golden scrub and pine, brilliant August midday sun on the Adriatic coast, real \
photographed video, film grain, 35mm, cinematic colour grade"

KABWINE="photorealistic footage inside a small dark whitewashed beach changing \
hut on the Dalmatian coast, a young woman soaking wet standing on the concrete \
floor, a bead curtain in the doorway behind her with brilliant sunlight and \
blue Adriatic sea beyond, a folding bed against the wall, dust in the air, hard \
shafts of light, real photographed video, shallow depth of field, film grain, \
35mm, cinematic colour grade"

KABTV="photorealistic footage inside a small dark whitewashed beach changing \
hut, an old 1960s wooden valve television with rabbit-ear aerials glowing on a \
small table, a vintage bakelite radio beside it, dim warm interior, dust in the \
air, a bead curtain and bright sunlight at the door, real photographed video, \
shallow depth of field, film grain, 35mm, moody cinematic colour grade"
