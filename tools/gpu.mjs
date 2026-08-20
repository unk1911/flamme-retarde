// The graphics card, under WSL, for a headless Chrome.
//
// Shared by shoot.mjs and record.mjs because the trick is not obvious and one
// copy of the explanation is enough.
//
// WSL does expose the host GPU. Not as /dev/dri, which is what every graphics
// stack on Linux looks for and what is missing here — as /dev/dxg, with
// Direct3D 12 over the top of it, and Mesa ships a Gallium driver that speaks
// exactly that. tools/blender/blender.sh worked this out first and sets the
// same two variables; what is different for a browser is that Chrome does not
// use system GL at all by default. It goes through ANGLE, and ANGLE's default
// backend is its own software rasteriser, so the environment alone changes
// nothing. `--use-angle=gl` is what makes ANGLE fall through to Mesa, and
// therefore to the card. Not vulkan, not egl: those find nothing here.
//
// Measured on this project at 1920x1080, one frame:
//
//     SwiftShader     30 s
//     D3D12, RTX 4090  0.30 s
//
// which is the difference between a ten-second clip being three hours and
// being a hundred seconds, and between a screenshot being something you think
// twice about asking for and something you take after every edit.
//
// Everything degrades. With no /dev/dxg and no d3d12 driver this leaves the
// environment alone and passes SwiftShader's flags, which is what both tools
// did before and what a machine without a card will still do.

import { existsSync } from 'node:fs';

/** Whether this machine can put a headless Chrome on a real GPU. */
export function haveGpu() {
  return existsSync('/dev/dxg')
    && existsSync('/usr/lib/x86_64-linux-gnu/dri/d3d12_dri.so');
}

/**
 * Chrome's GL flags and the environment to launch it in.
 *
 * `force` of 'gpu' or 'swiftshader' overrides the detection, which is how the
 * two are compared when a rendering difference is suspected.
 */
export function gpuLaunch(force = null) {
  const gpu = force === 'gpu' || (force !== 'swiftshader' && haveGpu());
  if (!gpu) {
    return {
      using: 'swiftshader',
      args: ['--enable-unsafe-swiftshader', '--use-gl=angle',
        '--use-angle=swiftshader'],
      env: process.env,
    };
  }
  return {
    using: 'gpu',
    args: ['--use-gl=angle', '--use-angle=gl'],
    env: {
      ...process.env,
      GALLIUM_DRIVER: 'd3d12',
      LD_LIBRARY_PATH: '/usr/lib/wsl/lib'
        + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : ''),
      // A substring match against the adapter description. On a laptop with
      // switchable graphics D3D12 enumerates every adapter Windows has and
      // Mesa takes the first, which is the integrated one; with no match it
      // falls back to the first anyway, so an all-Intel or all-AMD box is no
      // worse off for this being here.
      MESA_D3D12_DEFAULT_ADAPTER_NAME:
        process.env.MESA_D3D12_DEFAULT_ADAPTER_NAME || 'NVIDIA',
    },
  };
}

/** What the page says it is rendering on — for a one-line report. */
export const RENDERER_JS = `(() => {
  const c = document.createElement('canvas');
  const g = c.getContext('webgl2');
  if (!g) return 'no webgl2';
  const d = g.getExtension('WEBGL_debug_renderer_info');
  return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER);
})()`;
