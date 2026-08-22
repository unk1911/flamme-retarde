# Pour candidates. The two azimuths the solver could actually reach: the
# bottle pointing forward over a glass in front of her (az000), and the bottle
# lying across to her left with her hand out past the glass (az120).
#
# Both put the lip on the target with the grip where her fingers closed on it.
# What differs is where the arm has to be to do it, and which one reads as a
# pour from a camera rather than only in the numbers.

W_az000 = dict(WINE_LIFT, **{
    "spine02": (-14.9, 0, 1.0), "spine03": (-13.6, 0, 0.5), "chest": (1.4, 0, 0),
    "neck": (-6, 0, 0), "head": (-22, -4, 1),
    "clavicleR": (0, 0, 4),
    "armUR": (-51.9, -22.2, -11.4),
    "armLR": (-2.2 + STAND_ELBOW_UNDO, 25.9, -34),
    "handR": (55, 37.5, -48.2),
})

W_az120 = dict(WINE_LIFT, **{
    "spine02": (-3.7, 0, 1.0), "spine03": (-5.4, 0, 0.5), "chest": (-12, 0, 0),
    "neck": (-6, 0, 0), "head": (-22, -4, 1),
    "clavicleR": (0, 0, -10.1),
    "armUR": (-33.5, -32.1, -40.9),
    "armLR": (-21.9 + STAND_ELBOW_UNDO, -30.2, 4.8),
    "handR": (-40, 48.6, 55),
})
