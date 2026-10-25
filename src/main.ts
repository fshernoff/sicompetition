// Entry point. G1 builds the simulator headless (src/world, src/sim); the page grows in G2 to G5.
const canvas = document.getElementById('yard');
if (canvas instanceof HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1f2a1f';
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText('Good Dog Daycare: the yard opens in G2.', 24, 48);
  }
}
