import { createOceanPresentation } from './ocean-presentation.js';
export const ocean = createOceanPresentation();
const onPhase = event => ocean.setPhase(event.detail);
const onPulse = () => ocean.pulse();
const onOxygen = event => ocean.setOxygen(event.detail);
window.addEventListener('ocean-phase', onPhase);
window.addEventListener('ocean-pulse', onPulse);
window.addEventListener('ocean-oxygen', onOxygen);
await import('./maze-main.js');

if (import.meta.hot) import.meta.hot.dispose(() => {
  ocean.destroy();
  window.removeEventListener('ocean-phase', onPhase); window.removeEventListener('ocean-pulse', onPulse); window.removeEventListener('ocean-oxygen', onOxygen);
});
