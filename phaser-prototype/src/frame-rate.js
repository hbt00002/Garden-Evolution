// Phaser fixes a game's frame-rate limit when it is created, but the backdrop
// needs two speeds: calm (30 a second on a phone, to leave the main thread free
// for the controls) and full speed while the player is dragging the world
// around, when 30 looks choppy under a finger. This changes a running loop's
// limit (0 = as fast as the screen refreshes).
export function setFrameLimit(loop, fps) {
  const limited = fps > 0;
  const changed = loop.hasFpsLimit !== limited || loop.fpsLimit !== fps;
  loop.fpsLimit = fps;
  loop.hasFpsLimit = limited;
  loop._limitRate = limited ? 1000 / fps : 0;
  // Phaser picks its step function (limited or not) when the loop starts.
  if (changed && loop.running) {
    loop.sleep();
    loop.wake();
  }
}
