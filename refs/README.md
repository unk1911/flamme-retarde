# refs/

This directory holds the reference photographs the models and the intro panels
were made from — the cathedral, the Jadrija lighthouse, St Michael's fortress,
the old town, the harbour, several photographs of Canadair CL-415s at work, and
two press photographs of the Rokići fire of 6 August 2024 (credited to HVZ and
to Hrvoje Jelavić / PIXSELL), which the `rokici` panel was painted from.

**They are not in the repository.** They are other people's photographs —
Wikimedia contributors, press and stock libraries — gathered locally to model
from. Redistributing them is not ours to do, so `.gitignore` keeps everything
here out of the public tree except this file and `refs/panels/`.

`refs/panels/` **is** committed: those are the generated intro plates, kept at
full resolution so a good one is never lost to a regeneration. The build copies
live in `build/payload/panel_*.webp`.

If you are rebuilding the panels yourself, `tools/gen_panels.py` names the
reference file each one starts from. Substitute your own photographs of the same
subjects, or drop the `ref` argument to have the panel painted from the prompt
alone.
