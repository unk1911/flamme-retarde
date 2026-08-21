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
