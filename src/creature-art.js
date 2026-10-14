// Inline SVG portraits for the encyclopedia. Undiscovered entries reuse the same drawing as a
// silhouette (see .creature-art.is-hidden in maze.css).
const eye = (x, y, r = 2.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#0b1626"/><circle cx="${x + r * .35}" cy="${y - r * .35}" r="${r * .35}" fill="#fff"/>`;
const ART = {
  shark: `<path d="M8 50c14-14 40-22 64-20 14 1 28 6 40 14-10 8-26 12-42 12-24 0-44-2-62-6Z" fill="#6f8fb2"/>
    <path d="M14 52c22 6 52 8 74 4 10-2 18-6 24-12-4 10-18 18-36 20-22 2-44-2-62-12Z" fill="#e9f1f8"/>
    <path d="M50 31 60 10l10 22Z" fill="#5b7a9e"/><path d="M8 50 2 34l14 12Zm0 0-4 18 14-14Z" fill="#5b7a9e"/>
    <path d="M58 56 50 70l18-12Z" fill="#5b7a9e"/>${eye(92, 40, 2.4)}<path d="M80 44v8m4-9v8m4-9v8" stroke="#4b6788" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M98 50q6 2 12-2" stroke="#33475f" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  mermaid: `<path d="M44 14c-14 2-20 18-16 40 2 10 0 20-6 26 10-2 16-10 18-20 2 10 8 14 14 14-6-8-6-18-4-30 2-14 0-28-6-30Z" fill="#9fd4f2"/>
    <circle cx="52" cy="24" r="10" fill="#f6d5c0"/><path d="M42 22c2-10 16-14 22-4-6-2-12 0-14 6-2-2-6-3-8-2Z" fill="#bfe6ff"/>
    ${eye(55, 25, 1.4)}<path d="M46 34c4 4 12 4 14 0l2 20c-4 4-14 4-18 0Z" fill="#f6d5c0"/>
    <path d="M46 40h16" stroke="#7fd6c8" stroke-width="4" stroke-linecap="round"/>
    <path d="M46 54c0 12 6 18 18 22 12 4 24 2 32-4" stroke="#3fb0a8" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M94 72l14-14-2 12 12 2-16 6Z" fill="#62d1c2"/><path d="M50 62c6 6 16 10 28 10" stroke="#a5f0e2" stroke-width="1.6" fill="none" opacity=".7"/>`,
  squid: `<path d="M70 6c14 6 24 20 22 36l-12 12H62L52 42c-2-16 6-30 18-36Z" fill="#8f6cd6"/>
    <path d="M70 6l16-2-6 14Zm0 0L56 2l6 14Z" fill="#7454bf"/>
    ${eye(66, 40, 3.4)}${eye(80, 40, 3.4)}
    <g stroke="#9b79e0" stroke-width="3.4" fill="none" stroke-linecap="round"><path d="M60 52c-10 10-20 14-34 12"/><path d="M64 54c-6 14-16 22-30 24"/><path d="M70 54c0 14-6 24-14 30"/><path d="M76 54c4 12 4 22 0 30"/><path d="M82 52c8 10 18 14 30 14"/></g>
    <g fill="#c8b6f2"><circle cx="72" cy="20" r="1.6"/><circle cx="64" cy="28" r="1.4"/><circle cx="80" cy="26" r="1.4"/></g>`,
  turtle: `<ellipse cx="58" cy="48" rx="34" ry="22" fill="#4d9a6c"/>
    <path d="M58 30l10 8-4 12H52l-4-12Zm-22 10 12-2 4 12-10 8-8-8Zm44 0-12-2-4 12 10 8 8-8Z" fill="#6fbf86" stroke="#2f6e4a" stroke-width="1.2"/>
    <path d="M92 44c8-4 18-2 20 4-2 6-12 8-20 4Z" fill="#9ccf8e"/>${eye(104, 46, 1.8)}
    <path d="M70 28c8-14 22-18 30-14-6 10-18 16-30 14Zm0 40c8 14 22 16 28 12-6-10-16-14-28-12ZM34 32c-8-8-18-8-22-4 6 6 14 8 22 4Zm0 32c-8 8-16 10-20 6 4-6 12-8 20-6Z" fill="#8ec685"/>`,
  octopus: `<path d="M60 8c18 0 28 14 26 30-2 12-12 18-26 18S36 50 34 38C32 22 42 8 60 8Z" fill="#6b5fd3"/>
    ${eye(52, 34, 4)}${eye(68, 34, 4)}
    <g stroke="#6b5fd3" stroke-width="6" fill="none" stroke-linecap="round"><path d="M42 52c-8 8-16 10-24 6"/><path d="M48 56c-4 12-12 18-20 18"/><path d="M56 58c0 12-4 22-10 26"/><path d="M64 58c2 12 6 20 12 24"/><path d="M72 56c4 12 12 16 20 16"/><path d="M78 52c8 6 16 6 24 2"/></g>
    <g fill="#a99ff0"><circle cx="58" cy="18" r="2"/><circle cx="70" cy="22" r="1.6"/><circle cx="46" cy="22" r="1.6"/></g>`,
  lionfish: `<g stroke="#e9e1d8" stroke-width="1.4" stroke-linecap="round"><path d="M46 36 30 6M52 34 44 4M58 34l2-30M64 34l10-28M70 36l16-24M42 50 18 70M48 56 34 84M58 58l-2 26M66 56l12 24"/></g>
    <g fill="#d9544d" opacity=".75"><path d="M46 36 30 6l12 4Zm6-2L44 4l10 2Zm6 0 2-30 6 6Zm6 0 10-28 2 10Zm6 2 16-24-2 12ZM42 50 18 70l6-14Zm6 6L34 84l2-16Zm10 2-2 26-6-16Zm8-2 12 24-12-12Z"/></g>
    <path d="M34 46c10-14 34-16 50-8 10 4 18 8 24 10-6 4-14 8-24 10-18 6-40 4-50-12Z" fill="#f2e6dc"/>
    <g stroke="#c4413b" stroke-width="3.4"><path d="M46 38v20M56 35v26M66 35v26M76 37v22M86 40v16"/></g>
    ${eye(98, 46, 2.2)}<path d="M34 46 20 36v22Z" fill="#d9544d"/>`,
  butterflyfish: `<path d="M30 46C38 22 66 14 86 24c12 6 20 14 24 22-4 8-12 16-24 22-20 10-48 2-56-22Z" fill="#f5d34f"/>
    <path d="M50 20c6 16 6 36 0 52l14 2c6-18 6-38 0-56Z" fill="#1d2433"/><path d="M76 20c4 16 4 36 0 52l8-2c4-16 4-32 0-48Z" fill="#f4f4ef"/>
    <path d="M30 46 14 32v28Z" fill="#f5d34f"/><path d="M60 16c8-8 18-10 24-8-6 4-12 10-14 16Z" fill="#f4f4ef"/>
    ${eye(98, 42, 2.4)}<path d="M106 48l8 2" stroke="#1d2433" stroke-width="2" stroke-linecap="round"/>`,
  clownfish: `<path d="M24 46c10-16 34-22 56-16 14 4 24 10 30 16-6 6-16 12-30 16-22 6-46 0-56-16Z" fill="#f2792f"/>
    <g fill="#fbfbf6" stroke="#1d2433" stroke-width="1.8"><path d="M44 30c4 10 4 22 0 32 6 2 10 2 14 0 4-10 4-22 0-32-4-2-10-2-14 0Z"/><path d="M84 32c-3 8-3 20 0 28 4-1 8-4 10-6 2-6 2-12 0-16-2-2-6-5-10-6Z"/><path d="M24 46c-2-4-6-10-12-12v24c6-2 10-8 12-12Z"/></g>
    ${eye(98, 43, 2.4)}<path d="M58 30c4-8 14-10 20-6-6 2-12 4-14 8Z" fill="#f2792f" stroke="#1d2433" stroke-width="1.4"/>`,
  shrimp: `<g fill="#ef6f55" stroke="#c44a3a" stroke-width="1.2"><path d="M30 30c10-10 30-12 46-4 14 8 20 22 14 34-4 8-12 12-20 12l-2-8c6 0 10-4 12-8 2-8-2-16-12-20-12-6-26-2-34 4Z"/><path d="M68 72l-8 10 14-2 2 10 4-14Z"/></g>
    <g stroke="#f7a48c" stroke-width="1.2" fill="none"><path d="M44 24c2 4 2 10 0 14M54 22c2 6 2 12 0 18M64 24c3 6 3 12 0 18M74 30c2 6 2 12-2 16"/></g>
    <g stroke="#ef6f55" stroke-width="1.4" fill="none" stroke-linecap="round"><path d="M30 30C20 22 10 10 6 4M32 32C20 30 8 26 2 24M40 44l-4 14M48 46l-2 14M56 46v14"/></g>${eye(34, 32, 2)}`,
  jellyfish: `<path d="M24 42c0-22 16-34 36-34s36 12 36 34c-8 4-16 2-24 4-8-4-16-4-24 0-8-2-16 0-24-4Z" fill="#8fb6f2" opacity=".9"/>
    <path d="M34 30c4-10 14-16 26-16" stroke="#e1edff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>
    <g stroke="#a9a3f2" stroke-width="2.2" fill="none" stroke-linecap="round"><path d="M34 46c-4 10 4 16 0 26s2 14 0 16"/><path d="M48 48c4 10-4 18 2 28"/><path d="M60 48c-2 12 4 18 0 30"/><path d="M72 48c4 10-4 18 2 28"/><path d="M86 46c4 10-4 16 0 26"/></g>
    <path d="M44 46c4 14 12 22 16 30 4-8 12-16 16-30" fill="#c4b8f6" opacity=".55"/>`,
  seahorse: `<path d="M62 10c10 0 16 8 14 16l16 4-16 4c-2 6-6 8-8 12 10 6 14 18 8 28-6 10-18 12-24 4-4-6 0-14 6-12-4 4-2 8 2 8 6 0 8-10 2-16-8-6-14-14-12-26 2-12 6-22 12-22Z" fill="#f0cf6b"/>
    <path d="M52 34l-8 4 8 2m-6 6-8 4 8 2" stroke="#d8a93c" stroke-width="2" fill="none" stroke-linejoin="round"/>
    <g stroke="#d8a93c" stroke-width="1.6"><path d="M58 30h8M56 38h10M56 46h10M60 54h10"/></g>${eye(66, 18, 2.2)}
    <path d="M58 8l2-6 4 6 4-4v8" fill="#f0cf6b" stroke="#d8a93c" stroke-width="1.2"/>`,
  stonefish: `<path d="M18 52c0-20 20-34 46-34 24 0 40 12 42 28 2 16-14 28-42 28-28 0-46-6-46-22Z" fill="#8a6a4a"/>
    <g fill="#a98761"><circle cx="40" cy="34" r="6"/><circle cx="58" cy="26" r="5"/><circle cx="76" cy="30" r="6"/><circle cx="34" cy="56" r="5"/><circle cx="54" cy="62" r="6"/><circle cx="90" cy="52" r="4"/></g>
    <g fill="#6d5137"><circle cx="48" cy="44" r="3"/><circle cx="68" cy="40" r="2.4"/><circle cx="44" cy="62" r="2"/></g>
    ${eye(84, 38, 3)}<path d="M76 56c8-4 18-4 26 0" stroke="#3b2a1a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M18 52 6 42v22Z" fill="#7a5c3e"/>`,
};
export function creatureArt(id, { hidden = false, label = '' } = {}) {
  return `<svg class="creature-art${hidden ? ' is-hidden' : ''}" viewBox="0 0 120 90" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${ART[id] || ''}</svg>`;
}
