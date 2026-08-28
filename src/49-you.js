// -----------------------------------------------------------------------------
// You, as seen in the mirror.
//
// The game is first person and has been all along, which means the one thing it
// has never had to decide is what you look like. A mirror decides it for you.
//
// So there is a body now. It is the same skinned rig the figure at the far end
// of the beach is built on — same twenty-eight bones, same face, same idle — and
// it stands where you stand, faces where you face, and is drawn in exactly one
// place: inside the reflection. It is never in the scene you are looking at,
// because it is standing in your head and the inside of a skull is not a view
// anybody wants. `mirror.guests` is the whole mechanism: visible for the length
// of the reflection pass and hidden again before the room is drawn.
//
// What makes her hers is almost entirely paint. The rig already has hair, and
// arms, and a chest — so the blue is a colour swap in the fragment shader
// rather than a wig, the vest is a mask over the trunk rather than a garment,
// the skull on the front of it is drawn with algebra rather than sampled from
// a texture this rig has no UVs for, and the sleeve down her right arm is
// three noise fields. Paint cannot clip through the body it is on, cannot fall
// out of a pose, and costs nothing in the payload.
//
// Two things are not paint, and both for the same reason: they leave her. The
// beanie stands proud of the crown and the necklace hangs off the chest, and a
// drawn one of either is a drawing on a scalp or a sternum.
//
// Nothing in this project uses a three.js light, so neither does this: the cap
// carries a two-line shader with the sun stuck to the camera. In a mirror lit
// by one window that reads as well as anything more honest would.
// -----------------------------------------------------------------------------

const YOU = {
  // Where the camera sits above the feet. `GROUND.eye`, and if that moves this
  // moves with it or she stands on the floor with her head through the ceiling.
  eye: 1.66,
  // Her colours. Albedos, not pixels — they go through the tone mapper on the
  // way out, so they want to sit below the colour you actually want to see.
  // The cap is aubergine rather than black: in every reference of her it is a
  // dark purple slouch beanie, and read as black it stops being hers.
  hair: [0.13, 0.45, 0.70],
  // Near-black with a blue cast, off the photograph Misha sent. This was
  // aubergine on the argument that "read as black it stops being hers", and
  // the argument is sound and was applied to the wrong hat: in the reference
  // it is a very dark navy jersey, black in the shade and blue where the light
  // catches it, nothing like a purple. What keeps it from being flat black is
  // that the blue is a third as strong again as the red, which survives the
  // lighting here — it is the same trick, on the right hue.
  cap: [0.050, 0.058, 0.095],
  // The vest is not white. It is a washed-out sage-white, which is what a
  // cotton tank that has been through a Dalmatian summer twenty times is, and
  // it also stops the shirt blowing out to paper next to the porcelain.
  vest: [0.885, 0.900, 0.860],
  // And what is under it, showing at the scoop and over the shoulders.
  under: [0.055, 0.058, 0.068],
  // There is no colour here for what she changes INTO, and there was one for
  // four releases. She changes out of things — see the note over the scoop in
  // the body shader.
  // Pink through the blue. Not a tint over the whole head — three or four
  // locks taken pink, which is what a highlight is.
  pink: [0.560, 0.150, 0.330],
  // The print. Bone, and the ink it is drawn in. Named `ivory` and not `bone`
  // because `bone` on this object is already the head bone's bind position,
  // three keys down, and the later key wins: the skull came out rendered in
  // vec3(0.033, 1.586, -0.016), which is a bright green, and looked exactly
  // like a deliberate choice until you read the object.
  ivory: [0.700, 0.700, 0.688],
  print: [0.115, 0.125, 0.138],
  // The sleeve: old ink gone blue-black, red roses, green stems. Three colours
  // is enough — at two metres in a mirror a sleeve is a dark arm with warm and
  // cool inside it, and any more detail than that is detail nobody can see.
  ink: [0.070, 0.082, 0.118],
  rose: [0.360, 0.052, 0.058],
  leaf: [0.120, 0.250, 0.118],
  // The cord and the three spent cases on it.
  cord: [0.045, 0.045, 0.052],
  brass: [0.780, 0.580, 0.160],
  // Which way her right arm is. The rig faces +X and up is +Y, so her right is
  // +X × +Y = +Z. One number rather than a sed, because if the export ever
  // mirrors the rig this is the only line that has to change and the sleeve is
  // otherwise on the wrong arm in a way that is instantly obvious and easy to
  // miss until somebody looks.
  right: 1,
  // Head bone to crown, in metres, measured off the rig rather than guessed:
  // the bone sits at the base of the skull and the cap does not.
  crown: 0.163,
  // The head bone in the bind pose, measured off the rig. The hat is placed in
  // figure space, which is the space the shader thinks in; this is what
  // converts that to the head group's own frame.
  bone: [0.033, 1.586, -0.016],
  // The cap, as an ellipsoid in figure space: centre, radii, and how far it is
  // tilted back about Z. One set of numbers and not two, because the shader
  // that hides the hair underneath the hat has to describe exactly the volume
  // the hat occupies — a hat and a hole in the hair that disagree by a
  // millimetre is a seam you can see from across the room.
  // MEASURED, at the fourth time of asking about this hat. Bucket her bind
  // positions by height and read the skull: it is widest at |z| 0.092 around
  // y 1.60, is 0.078 at 1.66, runs x -0.129 to +0.176 fore and aft, and stops
  // at 1.75. Against that the old ellipsoid was 0.085 across — SEVEN
  // MILLIMETRES NARROWER THAN HER HEAD at its widest and flush with the skin
  // at the hem, which is a hat with no thickness. Nothing can be covered by a
  // surface it is already outside of, so the bob came through at both temples
  // as two hard blue slabs and no amount of moving the thing about fixed it.
  //
  // 0.101 stands it 9 mm proud at the widest, which is a knitted hat with a
  // head in it.
  //
  // AND IT IS A SLOUCH, which is the thing four passes of this object kept
  // failing to be. Misha, 28 Aug, with a photograph: "here's high resolution
  // hat... can't u make it like that?" What is in that frame is not a
  // skullcap. The hem crosses the brow, and from there the whole volume goes
  // BACK and UP — the crown is over the middle of the skull, the mass carries
  // on past the back of the head by three or four centimetres, and it hangs.
  // Every version before this was an ellipsoid the size of a head, sitting on
  // a head, which is a swimming cap.
  //
  // So it is 152 long against a skull that is 305 from brow to nape, centred
  // 20 mm behind the head bone and leaned back 23 degrees. The front-aft is
  // the number that makes the shape; the width and the height are what make
  // it fit. The brow stays outside on purpose — that is where the fringe
  // goes, and in the photograph the fringe is the whole front of her head.
  hat: { at: [0.000, 1.688, 0.000], r: [0.122, 0.086, 0.100], tilt: 0.30 },
  // The beanie's own shape, which is NOT the mask above and does not have to
  // be. See `beanie` in the body of this file: the mask is the volume of hair
  // to throw away and is therefore a skullcap, and the hat is a slouch that
  // carries on past the back of her head into air, where there is no hair to
  // throw away and nothing to agree with.
  //
  // `hem` is the height the fabric leaves the skull at, `ax` WHERE ITS AXIS
  // STANDS FORE AND AFT, `fa` how much longer it is fore-and-aft than across,
  // `lean` how far back the crown has gone by the time it gets there, and
  // `prof` the half-section as [radius, height over the hem] — the first three points of which are BELOW the hem and
  // inside her head, so the visible edge is the curve where cloth leaves
  // scalp rather than a ring drawn at a height.
  //
  // `ax` IS THE ONE THAT WAS ACTUALLY WRONG, and it took eight releases to
  // look at it, because it was never a number — it was a zero nobody had
  // written down. The lathe axis sat at x = 0 because that is where a lathe
  // goes if you do not think about it, and a head is not centred there: bucket
  // her bind positions by height across the band this hat occupies and the
  // braincase centres at +0.035, running -0.116 to +0.161 at the hem and
  // -0.069 to +0.128 near the crown. So the hat was standing 35 mm behind the
  // skull it was on, and the lean took the crown 14 mm further back again.
  //
  // Every symptom followed from that one offset. The mass overhanging the nape
  // — which is what read as a bag, then as an afro cap, then as a beret — was
  // the hat hanging off the back of her head. The bare band of forehead under
  // the front edge was the same 49 mm missing from the other end. Eight passes
  // went into the PROFILE, which was never the thing: no half-section put in
  // the wrong place is going to fit.
  //
  // THE RADIUS IS LATERAL AND THE OVAL DOES THE LENGTH, and getting that
  // backwards is what made the first slouch read, in Misha's words, like the
  // hat you wear over an afro. A lathe radius of 0.105 with `fa` at 1.30 gives
  // 105 mm across a skull that measures 77 — twenty-eight millimetres of air
  // on each side, which is a tam. The same envelope comes out fitted at 0.091
  // and 1.42: 14 mm proud laterally, 13 mm proud at the nape over a braincase
  // that is 130 long against 77 wide, which is the oval a head actually is.
  // The give is all in the crown and the shear now, which is where a beanie
  // keeps it.
  beanie: {
    hem: 1.690, ax: 0.030, fa: 1.42, lean: -0.08,
    prof: [
      [0.040, -0.072], [0.072, -0.042], [0.089, -0.016],
      [0.095, 0.004], [0.094, 0.020], [0.090, 0.036],
      [0.082, 0.052], [0.071, 0.066], [0.056, 0.078],
      [0.038, 0.088], [0.020, 0.094], [0.000, 0.098],
    ],
  },
  // A trim, if she ends up facing off-square. The rig's own forward is +X —
  // see `rigYaw` in 43-jadrija.js, which is the one place that says so — and
  // the yaw below is built for that, so this wants to be zero.
  face: 0,

  // ── the mask ──────────────────────────────────────────────────────────────
  //
  // She had one all along and you could never see it: 62-mask.js draws the
  // inside of a dive mask as an overlay across the whole screen, which is
  // exactly right when you are behind it and is nothing at all when the camera
  // is not. So there is a second one, and this is the outside of it — worn on
  // the head, in figure space, the same way the beanie is.
  //
  // Fitted to the rig rather than eyeballed, off the face anchors the skin
  // exports: the eye sits at (0.131, 1.623, ±0.033) with a radius of 15 mm,
  // and the skull's front face at brow height is x = 0.160. So a mask that
  // seals round both eyes is about 15 cm across, 9 cm tall, and its glass
  // stands a couple of centimetres proud of the cheek — which is what the
  // numbers below are.
  mask: {
    lens: [0.150, 1.628, 0], lensR: [0.016, 0.036, 0.068],
    skirt: [0.126, 1.626, 0], skirtR: [0.044, 0.048, 0.076],
    strap: 0.102, strapT: 0.0090, strapAt: 1.639,
  },
  // Black silicone, and glass that is not clear. A dive mask photographs as a
  // dark hole with one hard highlight on it — the lens is a mirror pointed at
  // whatever is in front of her, and what is in front of her at Jadrija is
  // sky. Rendered as a pale blue with a tight specular rather than as
  // transparency, which would show the inside of her skull.
  glass: [0.150, 0.230, 0.265],
  rubber: [0.045, 0.048, 0.056],
};

/**
 * Build the body, and the hair and hat that make it hers.
 *
 * Returns null if the skin is not in the payload, which is the same thing the
 * beach figure does — the game is playable without a face in the mirror.
 */
async function buildYou(scene) {
  // The rig arrives with hair on it — real geometry, over the skull and down
  // to the nape — baked one exact brown, (0.129, 0.094, 0.071). So she does
  // not need hair built for her; she needs the hair she has dyed. Which is
  // three lines in the fragment shader and looks like hair, because it is.
  //
  // Matched on colour rather than position, and the nearest other colour on
  // the head is the lashes at 0.10 away, so the window is wide enough to be
  // exact and narrow enough to leave her eyebrows alone. The height gate is
  // belt and braces: whatever else on her is that brown, it is not her head.
  // Dressed or changed. One uniform, because the difference between the two
  // is a hem and a colour — see the note on `hem` in the body below. Ramped
  // rather than switched by the caller if it ever wants to; the changing hut
  // does not, because the change happens behind a screen with the picture
  // faded to black and there is nothing to see it move.
  const uSwim = { value: 0 };

  // HER OWN MESH, and not the one Baye and the race swimmer are built from.
  //
  // Misha, 28 Aug: "make the facial shape/features more like this pic somehow",
  // with a cosplay photograph of the character. The base this figure shipped on
  // is the MakeHuman neutral — soft and round, because it is the average of
  // everybody — and the face in that photograph is angular: high cheekbones
  // with hollows under them, a narrow chin, a straight narrow nose, a long
  // face. All of that is a weighted sum of MakeHuman face targets, which is
  // what CHLOE in tools/blender/mh_morph.py now is.
  //
  // It had to be a second bake rather than a morph of the shared one, because
  // `human_skin_fr3d` is also Baye in 43-jadrija.js and the swimmer in
  // 61-chase.js, and giving a fire performer at a bathing station somebody
  // else's face is not a fix. 571 KB against a 25 MB build.
  //
  // FACE TARGETS ONLY. Her body is the same vertices it always was, and it has
  // to be: everything she wears is paint on a height threshold — the vest hem
  // at 0.995, the sleeve at 0.900, the brief between 0.815 and 0.962 — and a
  // body morph moves every one of them off the woman they were measured on.
  const fig = await loadSkin('chloe_skin_fr3d', {
    spec: 0.09,
    specPower: 24,
    face: true,
    uniforms: { uSwim },
    // Declared out here because the body is spliced into main() and GLSL ES 1.0
    // will not take a function inside a function. Everything below is used by
    // the sleeve and the print and by nothing else on this figure.
    decl: `
      uniform float uSwim;
      float youHash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }
      float youNoise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        vec4 a = vec4(youHash(i), youHash(i + vec3(1.0, 0.0, 0.0)),
                      youHash(i + vec3(0.0, 1.0, 0.0)),
                      youHash(i + vec3(1.0, 1.0, 0.0)));
        vec4 b = vec4(youHash(i + vec3(0.0, 0.0, 1.0)),
                      youHash(i + vec3(1.0, 0.0, 1.0)),
                      youHash(i + vec3(0.0, 1.0, 1.0)),
                      youHash(i + vec3(1.0, 1.0, 1.0)));
        vec4 m = mix(a, b, f.z);
        vec2 n = mix(m.xz, m.yw, f.x);
        return mix(n.x, n.y, f.y);
      }
      float youFbm(vec3 p) {
        return 0.57 * youNoise(p)
             + 0.30 * youNoise(p * 2.13 + 11.7)
             + 0.13 * youNoise(p * 4.31 + 3.10);
      }
      // An ellipse with a soft edge, which is what almost everything in the
      // print is made of.
      float youBlob(vec2 p, vec2 c, vec2 r) {
        return 1.0 - smoothstep(0.86, 1.0, length((p - c) / r));
      }
    `,
    body: `
      vec3 vcol = vVCol;
      {
        float dye = 1.0 - smoothstep(0.020, 0.055,
          distance(vcol, vec3(0.129, 0.094, 0.071)));
        dye *= smoothstep(1.34, 1.42, vLocal.y);

        // And the hair under the hat is not drawn at all.
        //
        // This is the part three passes of moving the cap around could never
        // fix. The rig's hair is a bob and the skull is inside it, so a beanie
        // sized to the skull sits *within* the hair and the hair draws over
        // its front — which reads as a cap slipping off the back of her head,
        // and is in fact a cap buried in it. Making the cap big enough to
        // swallow a bob makes a bucket.
        //
        // So the hair inside the cap's volume is discarded, which is what a
        // game does with a scalp under a helmet. The test is the same
        // ellipsoid the hat is, at 99 per cent, in the same space: vLocal
        // is the undisplaced bind position and the hat is rigid on the head
        // bone, so the two cannot drift apart. What is left is the fringe and
        // the nape, both outside it, which is exactly what should be showing.
        {
          vec3 d = vLocal - vec3(${YOU.hat.at.map((n) => n.toFixed(4)).join(', ')});
          vec2 u = vec2(d.x * ${Math.cos(-YOU.hat.tilt).toFixed(5)}
                      - d.y * ${Math.sin(-YOU.hat.tilt).toFixed(5)},
                        d.x * ${Math.sin(-YOU.hat.tilt).toFixed(5)}
                      + d.y * ${Math.cos(-YOU.hat.tilt).toFixed(5)});
          vec3 q = vec3(u, d.z) / vec3(${YOU.hat.r.map((n) => (n * 0.99).toFixed(5)).join(', ')});
          if (dye > 0.5 && dot(q, q) < 1.0) discard;
        }

        vcol = mix(vcol, vec3(${YOU.hair.map((n) => n.toFixed(3)).join(', ')}),
          dye);

        // And the pink through it.
        //
        // On the angle round the skull and not on height, which is the whole
        // difference between highlights and dip-dye: a lock that is pink is
        // pink from root to tip, and the ones either side of it are not. Seven
        // periods round the head puts four or five of them on the visible side
        // at a lock's width each, which is what she has.
        //
        // Broken up by a little noise so the edges of each lock are not a
        // curve. A hard-edged stripe of magenta on a blue bob reads as paint.
        {
          float lock = sin(atan(vLocal.z, vLocal.x - 0.033) * 6.0 + 0.9)
            * 0.5 + 0.5;
          lock = smoothstep(0.86, 0.995, lock)
            * (0.55 + 0.45 * youNoise(vLocal * 52.0));
          vcol = mix(vcol,
            vec3(${YOU.pink.map((n) => n.toFixed(3)).join(', ')}),
            dye * lock * 0.80);
        }

        // And the white vest. Painted rather than modelled, for the same
        // reason the hair is dyed rather than built: the geometry for it is
        // already there and a garment that is a mask over the body it is on
        // cannot clip through that body, which a modelled one would every
        // time she moved.
        //
        // Chest or bicep, told apart on one axis: her arms hang at 20 cm and
        // more across her, and no part of her trunk is out past 15. Nothing
        // fore-and-aft is tested at all, which is the point — the first cut of
        // this used a cross-section ellipse and her bust bulged straight out
        // through the front of it, so the vest came out a strip of sternum.
        float trunk = 1.0 - smoothstep(0.150, 0.186, abs(vLocal.z));
        // Scooped at the front and only at the front — a neckline that drops
        // all the way round is not a vest, it is a tube.
        float front = smoothstep(0.020, 0.105, vLocal.x)
          * (1.0 - smoothstep(0.030, 0.105, abs(vLocal.z)));
        float neck = mix(1.450, 1.372, front);
        // The hem. A constant, and it stopped being one for four releases
        // while this file tried to turn the tank into a swimming costume when
        // she changes. See the note over the scoop for why it does not now.
        float hem = 0.995;
        //
        // AND THE WHOLE OF IT COMES OFF WHEN SHE CHANGES. That is the change:
        // the hip wrap is geometry and leaves through wear(), the tank is
        // paint and leaves through here, and what is left is her. Misha asked
        // for exactly that on 25 Aug — "if we walk in with clothes we leave
        // without" — and four releases were spent instead building a swimming
        // costume nobody asked for, then arguing with its hem, then its print,
        // then the cut of its leg. He said "some weird blue-green thing on me"
        // three times and every time it was read as a complaint about the
        // shape of the thing rather than about there being a thing. It is the
        // Jadrija bathing station in August; the beach is full of people this
        // file already draws with less on than this.
        float scoop = trunk
          * smoothstep(hem, hem + 0.025, vLocal.y)
          * (1.0 - smoothstep(neck, neck + 0.012, vLocal.y))
          * (1.0 - uSwim);
        float vest = scoop;
        // Two straps over the shoulders, on a fixed height band rather than
        // one that follows the neckline — hang them off the scoop and the
        // scoop fills in behind them as a bib.
        float band = smoothstep(0.052, 0.066, abs(vLocal.z))
          * (1.0 - smoothstep(0.130, 0.146, abs(vLocal.z)))
          * (1.0 - smoothstep(0.090, 0.125, abs(vLocal.x - 0.010)));
        // The straps come off with the vest. A bandeau with two shoulder
        // straps still floating above it — which is what leaving them on
        // looks like, because they are a band in HEIGHT and the raised hem
        // does not touch them — is not a swimsuit, it is a bug.
        vest = max(vest, band
          * smoothstep(1.405, 1.425, vLocal.y)
          * (1.0 - smoothstep(1.468, 1.486, vLocal.y))
          * (1.0 - uSwim));
        vcol = mix(vcol,
          vec3(${YOU.vest.map((n) => n.toFixed(3)).join(', ')}), vest);

        // What is under it, showing where the vest stops: a dark edge round
        // the scoop, and a narrower dark strap inboard of each white one.
        //
        // The scoop edge is hung off the scoop term and deliberately not off
        // the whole vest, which is the scoop and the straps together, because
        // a 7 mm band in *height* lands on the top of a shoulder — which is a
        // horizontal surface — as a patch several centimetres across. Which is
        // also why it is cut off past 10 cm from the midline: the scoop's own
        // edge runs out on to the same flat shoulder and put a black bar with
        // square corners across each collarbone.
        vcol = mix(vcol,
          vec3(${YOU.under.map((n) => n.toFixed(3)).join(', ')}),
          scoop * smoothstep(neck - 0.013, neck - 0.006, vLocal.y)
            * (1.0 - smoothstep(0.082, 0.108, abs(vLocal.z))) * 0.92);
        // There is a second dark strap inboard of each white one in the
        // reference, and it is not here. It was, for one build: the straps are
        // a band in height and the top of a shoulder is horizontal, so a strap
        // narrowed in z and cut in y came out as a black rectangle with square
        // corners lying across each collarbone. Two straps you cannot see is a
        // better picture than two rectangles you can.

        // ------------------------------------------------------------- print
        //
        // The skull.
        //
        // Drawn rather than sampled, because a texture would want a UV set
        // this rig does not carry and a 256-square PNG in the payload for one
        // shirt is a poor trade against forty lines of algebra. Everything
        // below is in a plane on the front of her chest: P.x across, P.y up,
        // both in metres, origin between the eye sockets.
        //
        // It is deliberately graphic rather than illustrative. In a mirror,
        // three metres away, at a third of the canvas resolution, what carries
        // is the silhouette — a spiked halo, a pale skull, two black holes and
        // a ribbon under it. Anything finer than that is grey mush, so the
        // detail that exists is the detail that survives.
        {
          vec2 P = vec2(vLocal.z, vLocal.y - 1.176);
          // And it comes off with the tank it is printed on. The mask is the
          // vest term, which is the garment whichever garment that is, so
          // without it the swimsuit carries her band skull across the bust —
          // same graphic on both is the clearest possible statement that
          // neither is cloth. Nobody has this printed on their swimming
          // costume either.
          float on = vest
            * smoothstep(0.028, 0.060, vLocal.x)
            * (1.0 - smoothstep(0.104, 0.132, abs(vLocal.z)));
          vec3 pc = vec3(0.0);
          float pa = 0.0;

          // Nine rays out of the crown. The k below is the distance to the
          // nearest ray axis, 0 on it and 1 between two, so a length that
          // falls off with it is a triangle, with no trigonometric spike.
          {
            vec2 S = P - vec2(0.0, 0.004);
            float k = abs(fract(atan(S.x, max(S.y, 0.0004)) / 0.3665 + 0.5)
              - 0.5) * 2.0;
            float len = 0.098 - 0.040 * k;
            float m = (1.0 - smoothstep(len - 0.003, len, length(S)))
              * step(-0.006, S.y);
            pa = max(pa, m);
            pc = mix(pc, vec3(${YOU.print.map((n) => n.toFixed(3)).join(', ')}),
              m);
          }

          // Cranium and jaw, as two overlapping ellipses. A skull is a ball
          // with a smaller ball hung off the bottom front of it and that is
          // very nearly all a skull is at this size.
          float sk = max(youBlob(P, vec2(0.0, 0.006), vec2(0.056, 0.049)),
                         youBlob(P, vec2(0.0, -0.043), vec2(0.038, 0.035)));
          pa = max(pa, sk);
          pc = mix(pc, vec3(${YOU.ivory.map((n) => n.toFixed(3)).join(', ')}),
            sk);

          // The holes. Sockets mirrored on abs(P.x), the nasal aperture, and a
          // tooth line made of gaps rather than teeth — the dark is the space
          // between them, which is the only part of a mouth this size reads.
          float teeth = (1.0 - smoothstep(0.027, 0.032, abs(P.x)))
            * smoothstep(-0.057, -0.053, P.y)
            * (1.0 - smoothstep(-0.035, -0.031, P.y))
            * (1.0 - smoothstep(0.10, 0.36, abs(sin(P.x * 240.0))));
          float dark = max(max(
            youBlob(vec2(abs(P.x), P.y), vec2(0.022, 0.010),
              vec2(0.0165, 0.0145)),
            youBlob(P, vec2(0.0, -0.014), vec2(0.008, 0.013))), teeth);
          pc = mix(pc, vec3(${YOU.print.map((n) => n.toFixed(3)).join(', ')}),
            dark * sk);

          // And the ribbon under it, with a script line in it. The same wave
          // is added to both edges of the band so it curls as one ribbon
          // rather than tapering.
          float w = 0.006 * sin(P.x * 44.0);
          float ban = (1.0 - smoothstep(0.058, 0.065, abs(P.x)))
            * smoothstep(-0.101, -0.097, P.y + w)
            * (1.0 - smoothstep(-0.079, -0.075, P.y + w));
          pa = max(pa, ban);
          pc = mix(pc, vec3(${YOU.print.map((n) => n.toFixed(3)).join(', ')}),
            ban);
          pc = mix(pc, vec3(0.880, 0.890, 0.865), ban
            * (1.0 - smoothstep(0.0012, 0.0028, abs(P.y + w + 0.087
                - 0.0034 * sin(P.x * 155.0))))
            * (1.0 - smoothstep(0.044, 0.051, abs(P.x))));

          vcol = mix(vcol, pc, pa * on);
        }
      }

      // ------------------------------------------------------------- sleeve
      //
      // The right arm, from the deltoid to the knuckles.
      //
      // Three noise fields at three scales: one decides what is inked at all,
      // one puts roses in it, one puts leaves between them. It is not a design
      // — there is no drawing in here anybody could name — but a full sleeve
      // seen at a distance *is* a dark arm with red and green inside it and a
      // little bare skin left in the gaps, and that is what this is.
      //
      // Gated on side rather than on a bone weight because the paint has to
      // stay on the arm when the arm moves, and vLocal is the bind pose: the
      // ink is stuck to her skin, not to the space her arm happened to be in.
      {
        float side = vLocal.z * ${YOU.right.toFixed(1)};
        // 0.900 and not 0.720, and the 180 mm is why it has to be measured
        // rather than reasoned about.
        //
        // vLocal is the BIND pose and in the bind pose her arms are out, not
        // hanging: bucket her vertices by height and the body reaches z 0.22
        // at y 0.78, 0.20 at 0.86 and only 0.18 from 0.90 up, while the arm
        // does not exist below 0.96 at all and is out at 0.34 to 0.52 above
        // it. So a threshold of 0.19 catches the OUTER HIP AND THIGH
        // everywhere below y 0.86, and the old lower bound of 0.72 handed it
        // the whole of that. A tattoo sleeve down her leg.
        //
        // It hid behind the hip wrap for as long as there was one. Misha found
        // it the moment the wrap stopped being replaced by a painted garment
        // — "it looks like paint job from the tattoo that somehow imprints on
        // the right leg", which is exactly what it is — and I looked straight
        // at the gate a release earlier and talked myself out of it with a
        // guess at the numbers instead of reading them off the mesh.
        //
        // 0.900 clears the last body vertex over 0.19 by four centimetres and
        // costs the sleeve nothing: the lowest thing on her hand is at 0.96.
        float arm = smoothstep(0.180, 0.202, side)
          * smoothstep(0.900, 0.945, vLocal.y)
          * (1.0 - smoothstep(1.398, 1.452, vLocal.y));
        if (arm > 0.002) {
          float f = youFbm(vLocal * 30.0);
          float g = youFbm(vLocal * 19.0 + 5.3);
          float h = youFbm(vLocal * 44.0 + 17.1);
          // Fill, and then the contours through it. The first pass had fill
          // only and came out camouflage: soft-edged dark patches on a bare
          // arm, which is a bruise. What makes ink look like ink is that it
          // has a line round it, so the level set of a second field at a
          // different scale is drawn as a 2 mm stroke and laid over the top.
          float ink = smoothstep(0.360, 0.520, f);
          float line = 1.0 - smoothstep(0.012, 0.032, abs(g - 0.520));
          float rose = smoothstep(0.600, 0.700, g)
            * smoothstep(0.400, 0.560, h);
          float leaf = smoothstep(0.560, 0.660, h) * (1.0 - rose);
          vec3 tat = vec3(${YOU.ink.map((n) => n.toFixed(3)).join(', ')});
          tat = mix(tat, vec3(${YOU.rose.map((n) => n.toFixed(3)).join(', ')}),
            rose * ink);
          tat = mix(tat, vec3(${YOU.leaf.map((n) => n.toFixed(3)).join(', ')}),
            leaf * ink);
          vcol = mix(vcol, tat, arm * min(1.0, max(ink, line * 0.85)) * 0.93);
        }
      }
      base *= vcol;
    `,
  });
  if (!fig) return null;

  fig.play('idle', { fade: 0 });
  const mesh = fig.mesh;
  mesh.visible = false;
  scene.add(mesh);

  // A flat-ish shade with the sun stuck to the camera. `normalMatrix` is view
  // space, so the highlight follows the eye — which for a thing only ever seen
  // in a mirror, from one side, in one small room, is indistinguishable from
  // the real thing and costs two lines.
  const shade = (rgb, spec = 0, power = 34) => new THREE.ShaderMaterial({
    uniforms: {
      tint: { value: new THREE.Vector3(...rgb) },
      hot: { value: new THREE.Vector2(spec, power) },
    },
    vertexShader: `
      varying vec3 vN;
      void main() {
        vN = normalMatrix * normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 tint;
      uniform vec2 hot;
      varying vec3 vN;
      void main() {
        vec3 n = normalize(vN);
        float k = 0.52 + 0.48 * clamp(
          dot(n, normalize(vec3(0.32, 0.78, 0.54))), 0.0, 1.0);
        // The eye is down −Z in view space, so the half vector between it and
        // the fixed key is a constant and the highlight is one pow. Which is
        // all brass needs to stop being orange plastic.
        float s = hot.x * pow(clamp(
          dot(n, normalize(vec3(0.32, 0.78, 1.54))), 0.0, 1.0), hot.y);
        gl_FragColor = vec4(tint * k + s, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const capMat = shade(YOU.cap);

  // The necklace: a long cord round her neck with three spent cases hanging
  // off the bottom of it.
  //
  // This is the one thing on her that had to be geometry. The dye job, the
  // vest, the print and the sleeve are all paint on skin she already has, and
  // paint cannot leave the body — but a necklace is exactly the thing that
  // does, hanging clear of the chest and catching a highlight off its own
  // curvature, and a painted one is a drawing of a necklace on a sternum.
  //
  // A child of the figure and not of a bone. The hat needed the head bone
  // because a head turns forty degrees to look at you; a chest in an idle
  // moves a couple of millimetres, and a necklace that follows it exactly and
  // one that does not are the same picture.
  //
  // The cord runs down from the nape, out round the collarbones, and meets
  // itself at a point 12 cm proud of the spine at bust height. Seven control
  // points and a Catmull-Rom through them, because the shape that matters is
  // the drape and a drape is a curve.
  const chain = new THREE.Group();
  mesh.add(chain);
  chain.add(new THREE.Mesh(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.045, 1.495, -0.028),
      new THREE.Vector3(0.030, 1.474, -0.070),
      new THREE.Vector3(0.112, 1.404, -0.056),
      new THREE.Vector3(0.148, 1.352, -0.026),
      new THREE.Vector3(0.158, 1.322, 0.000),
      new THREE.Vector3(0.148, 1.352, 0.026),
      new THREE.Vector3(0.112, 1.404, 0.056),
      new THREE.Vector3(0.030, 1.474, 0.070),
      new THREE.Vector3(-0.045, 1.495, 0.028),
    ]), 52, 0.0023, 5, false), shade(YOU.cord)));

  // Three of them, fanned. 9 mm case, 5 mm mouth, tip down — a pistol round
  // rather than a rifle one, which is what she wears and also what fits: a
  // 7.62 at this scale is a finger hanging off her collarbone.
  const brassMat = shade(YOU.brass, 0.42, 40);
  for (let i = -1; i <= 1; i++) {
    const shell = new THREE.Group();
    shell.position.set(0.1565 - Math.abs(i) * 0.0035, 1.3185, i * 0.0115);
    shell.rotation.x = -i * 0.20;
    chain.add(shell);
    const cse = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0052, 0.0052, 0.0185, 10), brassMat);
    cse.position.y = -0.0093;
    shell.add(cse);
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.0052, 0.0098, 10), brassMat);
    tip.position.y = -0.0234;
    tip.rotation.x = Math.PI;
    shell.add(tip);
  }

  // Everything hangs off one group so the head bone only has to be read once a
  // frame and the whole lot inherits the body's yaw for free. The group sits at
  // the head bone, which is at the base of the skull — `YOU.crown` is the rest
  // of the way up, and getting that wrong is what put the first cap of this
  // over her ears like a pair of headphones.
  const head = new THREE.Group();
  mesh.add(head);

  // The beanie.
  //
  // Fitted, in the end, rather than eyeballed — three passes of moving a
  // sphere around by hand all put it somewhere on the back of her head, and
  // the reason was never the sphere. It was that nobody had measured the head.
  //
  // Sliced every 2 cm in the rig's own frame (+X is the way she faces, the
  // head bone is at (0.033, 1.586, -0.016)):
  //
  //     y      x from   x to    |z| to
  //     1.66   -0.116   0.160   0.078
  //     1.68   -0.095   0.154   0.076
  //     1.70   -0.090   0.144   0.070
  //     1.72   -0.069   0.127   0.057
  //     1.74    0.033   0.100   0.037
  //
  // Two things in that table. The head is 27 cm front to back at brow height,
  // because the rig's bob is swept forward — it is a long low skull, not a
  // ball, and a round cap either misses the back of it or stands off the
  // sides. And it leans: the crown at 1.74 is centred on x = 0.066, the mass
  // at 1.66 on x = 0.022, so the axis runs forward as it rises. A cap on a
  // vertical axis is wrong at one end whatever you do with it.
  //
  // Which is why every earlier attempt failed the same way. Each one was a
  // sphere roughly the size of the *skull*, and the skull is inside a bob —
  // so its front half sat inside the hair, the hair drew over it, and only the
  // back came out. It looked like a cap pushed off her head. It was a cap
  // buried in her head.
  //
  // So the numbers below are solved, not chosen: the smallest ellipsoid that
  // contains the crown and the whole back of the hair, with the fringe and the
  // brow left outside on purpose because that is where a fringe goes. It comes
  // out 24 by 17 by 16, tilted 17° back, sitting 3 cm proud at the crown —
  // which is slack, and a slouch beanie is slack.
  //
  // It is a whole ellipsoid and not a cut one. Everything below the hairline
  // is inside her head and never drawn, so the hem is the intersection curve
  // between hat and hair, which is a better line than any theta cut.
  const H = YOU.hat;
  const B = YOU.beanie;

  // A SLOUCH IS NOT AN ELLIPSOID, and four passes of this object went into
  // finding that out the long way. An ellipsoid centred on a head can hug it
  // or it can balloon past it; it cannot do both, because the same surface has
  // to be near the skull at the hem and a long way from it at the crown. Every
  // version of this hat was therefore either a swimming cap or — once it was
  // given enough length to slouch — a beret sitting on top of her, floating,
  // with a band of forehead under it. Misha sent a photograph and asked "can't
  // u make it like that", and what is in that photograph is a tube of jersey
  // gathered at the crown: tight where it leaves the brow, swelling over the
  // skull, and carrying up and BACK into air behind her head.
  //
  // So it is a lathe of that half-section, ovalled fore-and-aft to the shape
  // of a head, and then SHEARED — every vertex moved back in proportion to how
  // far up it is. The shear is the slouch and it is the whole trick: the hem
  // does not move at all, so the fit is untouched, while the crown goes back
  // 79 mm by the time it gets there.
  //
  // And it is decoupled from `YOU.hat`, which is now only the mask. Those two
  // used to be one ellipsoid on the argument that a hat and a hole in the hair
  // that disagree leave hair standing in the air — true, but the requirement
  // is one-way. The mask has to contain every hair the hat covers; it does not
  // have to BE the hat. The hair stops at the skull, so the mask is a skullcap
  // and the four centimetres of slouch behind her head are over nothing.
  const hat = new THREE.Group();
  head.add(hat);
  let capMesh = null;

  /**
   * Build the beanie, and rebuild it on demand.
   *
   * A function rather than a block because this shape has now taken seven
   * releases to land and every one of them was a full rebuild of the page to
   * look at one number. `__fr.jad.youHat({ fa: 1.5, lean: -0.1 })` re-lathes
   * it in place, so the next person to disagree with it — including Misha,
   * who is the reason it exists — can dial it in the console in seconds and
   * hand back four numbers instead of a screenshot.
   */
  function beanie(o = {}) {
    const b = { ...B, ...o };
    hat.position.set((b.ax || 0) - YOU.bone[0], b.hem - YOU.bone[1],
      0 - YOU.bone[2]);
    if (capMesh) { hat.remove(capMesh); capMesh.geometry.dispose(); }
    const pts = b.prof.map(([r, y]) => new THREE.Vector2(r, y));
    const geo = new THREE.LatheGeometry(pts, 40);
    const a = geo.attributes.position;
    for (let i = 0; i < a.count; i++) {
      // Oval first, then shear. The other order leans it and then stretches
      // the lean, which is a hat falling off sideways.
      a.setX(i, a.getX(i) * b.fa + b.lean * Math.max(0, a.getY(i)));
    }
    geo.computeVertexNormals();
    capMesh = new THREE.Mesh(geo, capMat);
    hat.add(capMesh);
    return { hem: b.hem, ax: b.ax, fa: b.fa, lean: b.lean, prof: b.prof };
  }
  beanie();

  // There were four locks of hair here as well — flat tapered cones down each
  // side of her face and two across the forehead — on the theory that the
  // rig's bob has no long pieces and the long pieces are what you recognise.
  //
  // They are gone, for two reasons. They were threaded through her: `out` was
  // 9.0 cm at the temple and 9.4 at the front, and the head is 9.2 to the side
  // and about 13 to the front, so every one of them started inside the skull
  // and came out through an ear or a cheek. And pushing them clear does not
  // save them — at this size a flat cone beside a face is a plastic card, not
  // hair, and there were four of them in pale cyan against a deep blue bob.
  //
  // The bob is the right shape anyway. Chloe's hair is short, choppy and swept
  // forward, which is what the rig has and what the dye job makes blue.
  // Nothing needed adding to it.
  // ── the dive mask ─────────────────────────────────────────────────────────
  //
  // Built the same way as the beanie and hung off the same head group, so it
  // turns with the skull rather than with the shoulders. Three pieces, which
  // is all a mask is at any distance you will ever see this one from: the
  // skirt that seals to her face, the glass in front of it, and the strap
  // round the back of her head.
  //
  // Hidden until somebody asks for it, and when it goes on the beanie comes
  // off. Not a clipping dodge — the strap and the turn-up do overlap — but
  // because nobody swims two hundred metres in a wool hat, and the hat coming
  // off is the beat that says she is going in.
  const M = YOU.mask;
  const glassMat = shade(YOU.glass, 0.72, 60);
  const rubMat = shade(YOU.rubber, 0.16, 26);
  const mask = new THREE.Group();
  mask.visible = false;
  head.add(mask);

  const fitted = (g, at3, r3v, mat) => {
    const m = new THREE.Mesh(g, mat);
    m.position.set(at3[0] - YOU.bone[0], at3[1] - YOU.bone[1], at3[2] - YOU.bone[2]);
    m.scale.set(r3v[0], r3v[1], r3v[2]);
    mask.add(m);
    return m;
  };
  // Unit spheres, scaled: one geometry, three shapes, and the scale is the
  // radii straight out of the table above.
  const unit = new THREE.SphereGeometry(1, 20, 14);
  fitted(unit, M.skirt, M.skirtR, rubMat);
  fitted(unit, M.lens, M.lensR, glassMat);
  // The strap, and it is two stubs rather than a band round her head.
  //
  // The band was tried first and it was the wrong instrument. A torus big
  // enough to clear a skull that is 27 cm front to back stands proud of the
  // temples by three or four centimetres, which at any distance you actually
  // see this from reads as a halo rather than as elastic — and the part of it
  // that would have made it read right, the part behind her head, is the part
  // no camera in this game is ever behind. What is left is the two centimetres
  // either side of the skirt where the strap leaves it, which is the only bit
  // of a mask strap anybody looks at from the front anyway.
  for (const sgn of [-1, 1]) {
    const stub = new THREE.Mesh(unit, rubMat);
    stub.position.set(M.skirt[0] - 0.030 - YOU.bone[0],
      M.strapAt - YOU.bone[1], sgn * M.skirtR[2] * 0.86 - YOU.bone[2]);
    stub.scale.set(0.030, 0.011, 0.016);
    mask.add(stub);
  }

  const hi = fig.boneIndex('head');
  const at = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  const dir = new THREE.Vector3();

  // Who is driving her.
  //
  // Null means the mirror does, which is what she was built for: stand where
  // the camera is, face where it faces, and be visible for exactly the length
  // of the reflection pass. Anything else means a script has taken her — the
  // dive off the jetty, or the camera that swings round behind her in the
  // water — and then her position, her heading and her attitude are all told
  // to her rather than derived, and she is a real object in the real scene.
  let drive = null;

  /** Stand her where you are standing, facing where you are facing. */
  let frozen = false;

  function tick(dt, camera) {
    fig.update(dt);
    if (fig.faceTick) fig.faceTick(dt);
    if (hi >= 0) {
      fig.boneAt(hi, at);
      head.position.copy(at);
      // And turn it with the skull, which this did not do — the hat was pinned
      // to the head bone's *position* and left square to the body, so the
      // moment she looked at anything the cap stayed where her face had been.
      // In the mirror that is a beanie hanging off the back of her head at
      // forty degrees, which is exactly what it looked like. Everything under
      // `head` — the dome, the brim, all four locks of hair — is written as an
      // offset from the head bone in the bind pose, so the delta since bind is
      // the whole correction.
      fig.boneTurn(hi, turn);
      head.quaternion.copy(turn);
    }
    if (drive) {
      mesh.position.set(drive.at[0], drive.at[1], drive.at[2]);
      // YZX: yaw about world up first, then pitch about her own lateral axis,
      // then roll about her own forward. Any other order and a swimmer who is
      // both turning and going head-down comes out corkscrewed — the pitch has
      // to happen in the frame the yaw left her in, which is what putting Y
      // outermost means.
      mesh.rotation.set(drive.roll || 0, drive.yaw + YOU.face,
        drive.pitch || 0, 'YZX');
      mesh.updateMatrixWorld();
      return;
    }
    if (frozen) return;
    camera.getWorldDirection(dir);
    mesh.position.set(camera.position.x,
      camera.position.y - YOU.eye, camera.position.z);
    // An object at rotation.y = θ points its local +X at (cos θ, 0, −sin θ),
    // and the rig's forward is +X, so the z of where you are looking is the
    // one that gets negated. Yawing it as though the rig faced −Z, which is
    // what this used to do, stands her at a right angle to you.
    mesh.rotation.y = Math.atan2(-dir.z, dir.x) + YOU.face;
    mesh.updateMatrixWorld();
  }

  return {
    mesh,
    fig,
    tick,
    /** Re-lathe the beanie from the console. See `beanie`. */
    beanie,
    /** Debug: draw her in the room, and stop her following the camera. */
    show: (v) => { mesh.visible = !!v; return mesh.visible; },
    /**
     * Changed for the water, or dressed.
     *
     * The name is left over from when this swapped one painted garment for
     * another. It takes the painted one OFF; the geometry half of the same
     * change is `wear`, and `setDressed` in 90-app.js calls the pair.
     */
    swim: (v) => { uSwim.value = v ? 1 : 0; return uSwim.value; },
    freeze: (v) => { frozen = !!v; return frozen; },
    /**
     * Take her off the camera and put her somewhere.
     *
     * `o` is { at: [x, y, z], yaw, pitch, roll, clip, mask, seen } and every
     * field is optional after the first two. Pass null to hand her back to the
     * mirror, which also hides her — a body that is left standing in the scene
     * after the shot that wanted it is a body standing in the sea.
     */
    drive: (o) => {
      if (!o) {
        drive = null;
        mesh.visible = false;
        mask.visible = false;
        hat.visible = true;
        chain.visible = true;
        return null;
      }
      drive = o;
      mesh.visible = o.seen !== false;
      if (o.mask != null) { mask.visible = !!o.mask; hat.visible = !o.mask; }
      // The cord comes off in the water, and that is a fix and not a costume
      // note: it is a child of the figure rather than of a bone, hung for a
      // body that is standing up, and on a swimmer it sails out sideways from
      // the sternum like a length of wire. Nobody swims two hundred metres in
      // a necklace either.
      chain.visible = !o.wet;
      if (o.clip && fig.playing() !== o.clip) {
        fig.play(o.clip, { fade: o.fade == null ? 0.20 : o.fade });
      }
      if (o.speed != null && fig.state) fig.state.speed = o.speed;
      return drive;
    },
    /** Is a script holding her, and what is she doing? */
    driven: () => (drive ? { clip: fig.playing(), mask: mask.visible,
      at: drive.at.map((v) => +v.toFixed(2)) } : null),
    stats: () => ({ tris: fig.tris, head: hi,
      at: [+mesh.position.x.toFixed(1), +mesh.position.y.toFixed(2),
        +mesh.position.z.toFixed(1)],
      yaw: +mesh.rotation.y.toFixed(2), visible: mesh.visible }),
  };
}
