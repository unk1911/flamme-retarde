L0 = dict(IDLE_A, **{
    "spine02": (-3, 0, 1.0), "spine03": (-3, 0, 0.5), "chest": (-2, 0, 0),
    "neck": (0, 0, 0), "head": (-10, -4, 1),
    "clavicleR": (0, 0, -4),
    "armUR": (-22, -8, -28), "armLR": (-18 + STAND_ELBOW_UNDO, 0, -16),
    "handR": (30, 0, 0),
})
W_L0 = L0
W_L_h0 = dict(L0, **{"handR": (0, 0, 0)})
W_L_h45 = dict(L0, **{"handR": (45, 0, 0)})
W_L_e30 = dict(L0, **{"armLR": (-30 + STAND_ELBOW_UNDO, 0, -16)})
W_L_e6 = dict(L0, **{"armLR": (-6 + STAND_ELBOW_UNDO, 0, -16)})
# which knob pronates: forearm y, hand y, hand z
for _v in (-40, -20, 20, 40):
    globals()['W_fy%+d' % _v] = dict(L0, **{
        "armLR": (-18 + STAND_ELBOW_UNDO, _v, -16)})
    globals()['W_hy%+d' % _v] = dict(L0, **{"handR": (30, _v, 0)})
    globals()['W_hz%+d' % _v] = dict(L0, **{"handR": (30, 0, _v)})
