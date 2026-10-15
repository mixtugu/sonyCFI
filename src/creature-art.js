// Inline SVG portraits for the encyclopedia. Undiscovered entries reuse the same drawing as a
// silhouette (see .creature-art.is-hidden). Every call gets its own gradient ids, because the same
// creature can be on screen several times (encyclopedia, contact card, report) and a hidden copy's
// definitions would otherwise stop the visible one from painting.
let drawn = 0;
const stops = list => list.map(([offset, color, opacity = 1]) => `<stop offset="${offset}" stop-color="${color}"${opacity < 1 ? ` stop-opacity="${opacity}"` : ''}/>`).join('');
const linear = (id, list, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;
const radial = (id, list, cx = .5, cy = .5, r = .5, fx = cx, fy = cy) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${stops(list)}</radialGradient>`;
const eye = (x, y, r = 2.6, iris = '#0b1626') => `<circle cx="${x}" cy="${y}" r="${r * 1.35}" fill="#f4f8ff" opacity=".9"/><circle cx="${x}" cy="${y}" r="${r}" fill="${iris}"/><circle cx="${x + r * .38}" cy="${y - r * .4}" r="${r * .38}" fill="#fff"/><circle cx="${x - r * .35}" cy="${y + r * .35}" r="${r * .15}" fill="#fff" opacity=".7"/>`;
const shine = (d, opacity = .35) => `<path d="${d}" fill="#fff" opacity="${opacity}"/>`;

const ART = {
  shark: u => `<defs>${linear(u('b'), [[0, '#3c5f8c'], [.45, '#6f93bd'], [.62, '#c9d9ea'], [1, '#f4f8fc']])}${linear(u('f'), [[0, '#30507a'], [1, '#5a7fa9']])}</defs>
    <path d="M10 52 2 34q8 2 16 13Zm2 1-6 19q9-4 14-14Z" fill="url(#${u('f')})"/>
    <path d="M47 33 58 9q4 0 6 4l2 21Z" fill="url(#${u('f')})"/><path d="M80 33l6-6 2 7Z" fill="url(#${u('f')})"/>
    <path d="M14 50C30 34 54 28 78 30c15 1 28 7 37 15-7 7-20 12-36 13-24 2-47-1-65-8Z" fill="url(#${u('b')})"/>
    <path d="M56 55 44 72q12-2 22-15Z" fill="url(#${u('f')})"/><path d="M76 57l-2 9 8-8Z" fill="url(#${u('f')})"/>
    ${shine('M30 40c16-7 36-9 56-6-20 1-38 4-56 9Z', .3)}
    <g stroke="#3d5a80" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".75"><path d="M83 41q1 5 0 10M87 40q1 5 0 10M91 40q1 5 0 9"/></g>
    <path d="M103 51q6 2 11-3" stroke="#2a3b52" stroke-width="1.5" fill="none" stroke-linecap="round"/>${eye(98, 41, 2.1)}`,
  mermaid: u => `<defs>${linear(u('hair'), [[0, '#d9f3ff'], [.5, '#8fd2f2'], [1, '#4aa3d6']], 0, 0, 1, 1)}${linear(u('tail'), [[0, '#5fe0cf'], [.5, '#2fa8b6'], [1, '#1b6f96']], 0, 0, 1, 0)}${radial(u('skin'), [[0, '#ffe7d6'], [1, '#f2c3a6']], .4, .35, .7)}${linear(u('fin'), [[0, '#9ff7e6', .95], [1, '#3fc0d0', .7]], 0, 0, 1, 1)}</defs>
    <path d="M40 12c-13 3-18 20-14 37 3 12 1 22-7 30 13-2 20-11 22-22 2 9 8 15 16 16-7-9-7-21-5-33 2-16-1-30-12-28Z" fill="url(#${u('hair')})"/>
    <path d="M50 58c0 13 7 20 20 23 12 3 24 0 31-6" stroke="url(#${u('tail')})" stroke-width="13" fill="none" stroke-linecap="round"/>
    <g fill="none" stroke="#bdfcf0" stroke-width=".9" opacity=".55"><path d="M60 66q3 3 6 0M70 71q3 3 6 0M80 74q3 3 6 0M64 74q3 3 6 0M88 73q3 3 6 0"/></g>
    <path d="M99 73c6-11 16-17 21-15-3 6-5 10-4 14 4 0 4 6-1 9-6 3-12 0-16-8Z" fill="url(#${u('fin')})"/><g stroke="#e7fffa" stroke-width=".7" opacity=".6"><path d="M103 73l14-12M104 75l13-4M103 77l11 4"/></g>
    <path d="M47 34c4 5 13 5 16 0l3 22c-5 5-17 5-21 0Z" fill="url(#${u('skin')})"/>
    <path d="M46 40q4-3 8 0 4-3 8 0l-1 4q-3-2-7 0-4-2-7 0Z" fill="#f2a6c4"/>
    <circle cx="55" cy="24" r="10.5" fill="url(#${u('skin')})"/>
    <path d="M44 22c1-12 18-16 24-5-6-3-13-1-16 5-2-2-5-2-8 0Z" fill="url(#${u('hair')})"/>
    <path d="M55 26q2 1.5 4 0M61 26q2 1.5 4 0" stroke="#40303a" stroke-width="1.1" fill="none" stroke-linecap="round"/><circle cx="58" cy="30" r="1.6" fill="#f59ab0" opacity=".6"/>
    <path d="M57.5 31q1.5 1 3 0" stroke="#c0606f" stroke-width=".9" fill="none" stroke-linecap="round"/>
    <circle cx="96" cy="16" r="1.2" fill="#fff"/><circle cx="104" cy="26" r=".9" fill="#fff" opacity=".7"/>`,
  squid: u => `<defs>${linear(u('m'), [[0, '#c04a7e'], [.55, '#8b4cc4'], [1, '#5a3aa8']], 0, 0, 1, 1)}${linear(u('arm'), [[0, '#9a5ad0'], [1, '#c98ae6']])}</defs>
    <g stroke="url(#${u('arm')})" stroke-linecap="round" fill="none"><path d="M60 54c-14 12-30 16-48 12" stroke-width="3"/><path d="M83 54c14 10 24 12 34 10" stroke-width="3"/>
    <path d="M64 56c-6 13-16 21-30 24" stroke-width="4"/><path d="M69 57c-1 14-7 23-13 29" stroke-width="4.4"/><path d="M75 57c3 12 3 21 0 29" stroke-width="4.4"/><path d="M79 56c7 11 14 16 22 18" stroke-width="4"/></g>
    <g fill="#e9c2f5"><circle cx="18" cy="66" r="2.4"/><circle cx="13" cy="66" r="2"/><circle cx="111" cy="64" r="2.4"/><circle cx="116" cy="64" r="2"/></g>
    <path d="M72 4c15 6 24 22 21 38l-11 13H62L52 43c-3-17 6-32 20-39Z" fill="url(#${u('m')})"/>
    <path d="M72 4c6 0 14-2 20-1-4 6-9 11-14 13Zm0 0c-6 0-14-2-20-1 4 6 9 11 14 13Z" fill="#7a3fb8"/>
    <g fill="#f3c4e6" opacity=".55"><circle cx="70" cy="18" r="2"/><circle cx="62" cy="28" r="1.5"/><circle cx="80" cy="26" r="1.7"/><circle cx="74" cy="34" r="1.2"/><circle cx="84" cy="38" r="1.3"/></g>
    ${shine('M62 14c4-6 9-8 12-8-5 4-8 9-9 15Z', .3)}${eye(64, 45, 3.4, '#1d1033')}${eye(81, 45, 3.4, '#1d1033')}`,
  turtle: u => `<defs>${radial(u('shell'), [[0, '#8fd28e'], [.6, '#4f9a62'], [1, '#2f6a49']], .45, .4, .6)}${linear(u('skin'), [[0, '#b7e2a4'], [1, '#78b682']])}</defs>
    <path d="M70 26c8-14 24-19 33-15-6 11-19 17-33 15Z" fill="url(#${u('skin')})"/><path d="M70 70c8 14 23 16 30 12-6-10-17-14-30-12Z" fill="url(#${u('skin')})"/>
    <path d="M36 32c-9-9-20-9-25-4 7 7 16 9 25 4Zm0 30c-9 8-18 10-23 6 5-7 14-9 23-6Z" fill="url(#${u('skin')})"/>
    <g fill="#5f9c6b" opacity=".6"><circle cx="90" cy="16" r="1.4"/><circle cx="84" cy="21" r="1.2"/><circle cx="88" cy="78" r="1.3"/><circle cx="20" cy="29" r="1.1"/></g>
    <path d="M92 43c9-6 21-4 24 3-2 7-14 9-24 4Z" fill="url(#${u('skin')})"/><path d="M98 42l4 3-4 3M106 41l2 4-2 4" stroke="#6aa877" stroke-width=".9" fill="none"/>${eye(109, 44, 1.9)}
    <ellipse cx="60" cy="47" rx="35" ry="23" fill="url(#${u('shell')})"/>
    <g fill="none" stroke="#2b5c40" stroke-width="1.4" stroke-linejoin="round" opacity=".85"><path d="M60 29l10 8-4 12H54l-4-12Z"/><path d="M50 37 36 39l-2 13 12 6 8-9M70 37l14 2 2 13-12 6-8-9M46 58l6 9h16l6-9M60 29V25"/></g>
    <ellipse cx="60" cy="47" rx="35" ry="23" fill="none" stroke="#c7ecb8" stroke-width="2" opacity=".5"/>
    ${shine('M38 36c6-8 16-12 26-12-9 3-17 7-22 14Z', .3)}`,
  octopus: u => `<defs>${radial(u('head'), [[0, '#a99af5'], [.6, '#6f5ad6'], [1, '#4b3aa6']], .4, .35, .65)}${linear(u('arm'), [[0, '#6a55d0'], [1, '#8d7be8']])}</defs>
    <g stroke="url(#${u('arm')})" stroke-linecap="round" fill="none"><path d="M42 50c-10 8-20 10-28 4 4-1 6-4 4-7" stroke-width="7"/><path d="M48 55c-4 14-12 20-22 19 3-2 4-5 2-7" stroke-width="7"/><path d="M57 58c0 13-4 22-11 26" stroke-width="7"/>
    <path d="M65 58c2 12 6 20 14 22 0-3 3-5 6-4" stroke-width="7"/><path d="M73 55c5 12 13 16 22 14-1-3 1-6 4-6" stroke-width="7"/><path d="M78 50c8 6 17 6 24 0-3-1-4-4-2-6" stroke-width="7"/></g>
    <g fill="#d6cdfb"><circle cx="24" cy="57" r="1.4"/><circle cx="31" cy="72" r="1.4"/><circle cx="48" cy="80" r="1.4"/><circle cx="74" cy="78" r="1.4"/><circle cx="90" cy="68" r="1.4"/><circle cx="97" cy="54" r="1.4"/></g>
    <path d="M60 6c19 0 29 15 27 32-2 13-13 19-27 19S35 51 33 38C31 21 41 6 60 6Z" fill="url(#${u('head')})"/>
    <g fill="#c4b9fb" opacity=".6"><circle cx="56" cy="16" r="2.4"/><circle cx="69" cy="20" r="1.8"/><circle cx="46" cy="22" r="1.6"/><circle cx="74" cy="31" r="1.4"/></g>
    ${shine('M44 18c4-7 10-10 16-10-6 3-11 7-13 13Z', .35)}
    <ellipse cx="51" cy="38" rx="5" ry="5.5" fill="#f4f1ff"/><ellipse cx="69" cy="38" rx="5" ry="5.5" fill="#f4f1ff"/><rect x="48" y="37" width="6" height="2.6" rx="1.3" fill="#1d1640"/><rect x="66" y="37" width="6" height="2.6" rx="1.3" fill="#1d1640"/>
    <path d="M57 47q3 2 6 0" stroke="#2f2470" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
  lionfish: u => `<defs>${linear(u('body'), [[0, '#fff6ee'], [1, '#f1d9c8']])}${linear(u('fan'), [[0, '#e9604f', .85], [1, '#f4b39a', .5]])}<clipPath id="${u('clip')}"><path d="M30 47c10-15 35-17 52-9 9 4 17 8 24 10-7 4-15 8-24 10-18 6-41 4-52-11Z"/></clipPath></defs>
    <path d="M44 38 28 5l14 6 4-9 6 12 6-12 4 13 8-10 2 13 10-8-2 14 12-5-10 14Z" fill="url(#${u('fan')})"/>
    <g stroke="#fdf3ea" stroke-width="1.1" stroke-linecap="round"><path d="M44 38 28 5M50 36l-4-34M56 35l2-33M62 35l8-28M68 37l14-22M74 39l16-12"/></g>
    <path d="M44 54 14 76l8 2-2 7 12-6 2 8 8-11 3 8 6-14Z" fill="url(#${u('fan')})"/><g stroke="#fdf3ea" stroke-width="1" stroke-linecap="round" opacity=".9"><path d="M44 54 14 76M46 56 20 85M50 57l-18 22M54 58l-8 22"/></g>
    <path d="M30 47c10-15 35-17 52-9 9 4 17 8 24 10-7 4-15 8-24 10-18 6-41 4-52-11Z" fill="url(#${u('body')})"/>
    <g clip-path="url(#${u('clip')})" fill="#c9433b"><rect x="38" y="30" width="4.5" height="40" transform="rotate(8 40 50)"/><rect x="49" y="30" width="5" height="40" transform="rotate(8 51 50)"/><rect x="61" y="30" width="5" height="40" transform="rotate(8 63 50)"/><rect x="73" y="30" width="4.5" height="40" transform="rotate(8 75 50)"/><rect x="85" y="30" width="4" height="40" transform="rotate(8 87 50)"/><rect x="96" y="30" width="3" height="40" transform="rotate(8 97 50)"/></g>
    <path d="M30 47 15 36q2 11 0 23Z" fill="#d9584a"/><g stroke="#fdf3ea" stroke-width=".8" opacity=".8"><path d="M30 47 17 40M30 47l-13 2M30 47l-13 9"/></g>
    ${shine('M44 40c12-6 28-7 40-3-14 0-27 2-40 6Z', .35)}${eye(98, 46, 2.2, '#5a1410')}<path d="M104 51l4 1" stroke="#6b2a22" stroke-width="1.2" stroke-linecap="round"/>`,
  butterflyfish: u => `<defs>${linear(u('y'), [[0, '#ffe680'], [1, '#f2b928']], 0, 0, 1, 1)}${linear(u('w'), [[0, '#ffffff'], [1, '#e6e9ee']])}<clipPath id="${u('clip')}"><path d="M32 47C40 22 68 14 88 24c12 6 20 14 24 22-4 8-12 16-24 22-20 10-48 2-56-21Z"/></clipPath></defs>
    <path d="M58 22C64 8 80 2 98 4 84 8 74 15 70 24Z" fill="url(#${u('w')})"/><path d="M60 21C70 10 86 6 98 4" stroke="#e8ecf2" stroke-width="1.6" fill="none"/>
    <path d="M32 47 15 33q3 14 0 28Z" fill="url(#${u('y')})"/><path d="M15 33q3 14 0 28" stroke="#1d2433" stroke-width="2" fill="none"/>
    <path d="M32 47C40 22 68 14 88 24c12 6 20 14 24 22-4 8-12 16-24 22-20 10-48 2-56-21Z" fill="url(#${u('w')})"/>
    <g clip-path="url(#${u('clip')})"><path d="M30 10h22v80H30Z" fill="url(#${u('y')})"/><path d="M52 10c4 22 4 50 0 80h16c5-28 5-56 0-80Z" fill="#1d2433"/><path d="M80 10c4 22 4 50 0 80h6c4-28 4-56 0-80Z" fill="#1d2433"/><path d="M96 10v80h20V10Z" fill="url(#${u('y')})"/></g>
    <path d="M56 70c4 8 10 12 16 12-4-4-6-8-6-13Z" fill="url(#${u('y')})"/>
    ${shine('M44 34c10-10 26-14 40-11-15 2-28 6-40 13Z', .4)}${eye(99, 42, 2.4)}<path d="M108 47l7 2" stroke="#1d2433" stroke-width="2.2" stroke-linecap="round"/>`,
  clownfish: u => `<defs>${linear(u('o'), [[0, '#ffa04a'], [.55, '#f26a1f'], [1, '#d24d12']])}</defs>
    <path d="M24 47c-2-5-7-11-14-13 2 9 2 18 0 27 7-2 12-8 14-14Z" fill="url(#${u('o')})" stroke="#1d2433" stroke-width="1.6"/>
    <path d="M52 30c6-9 18-12 26-8-7 2-13 6-15 11Z" fill="url(#${u('o')})" stroke="#1d2433" stroke-width="1.6"/><path d="M56 64c4 7 12 10 18 8-5-2-8-6-9-10Z" fill="url(#${u('o')})" stroke="#1d2433" stroke-width="1.6"/>
    <path d="M24 47c10-16 34-22 56-16 14 4 24 10 30 16-6 6-16 12-30 16-22 6-46 0-56-16Z" fill="url(#${u('o')})"/>
    <g fill="#fdfdf8" stroke="#1d2433" stroke-width="1.8"><path d="M44 30c4 10 4 23 0 34 6 2 10 2 15 0 4-11 4-24 0-34-5-2-10-2-15 0Z"/><path d="M84 32c-3 8-3 20 0 28 4-1 8-4 10-6 2-6 2-12 0-16-2-2-6-5-10-6Z"/><path d="M24 47c-1-3-3-6-6-8 0 5 0 11 0 16 3-2 5-5 6-8Z"/></g>
    ${shine('M36 38c12-9 30-11 46-7-16 0-31 3-46 9Z', .35)}<path d="M96 54q5-1 9-5" stroke="#7a2a08" stroke-width="1.2" fill="none" stroke-linecap="round"/>${eye(98, 43, 2.5)}`,
  shrimp: u => `<defs>${linear(u('s'), [[0, '#ff9c7a'], [.6, '#ef5f42'], [1, '#c63c2b']], 0, 0, 1, 1)}</defs>
    <g stroke="#ef6f55" stroke-width="1.2" fill="none" stroke-linecap="round"><path d="M33 31C22 22 12 10 6 3"/><path d="M33 33C21 30 9 26 2 25"/><path d="M36 30c-4-8-6-16-6-24"/></g>
    <g stroke="#e8634a" stroke-width="1.4" stroke-linecap="round"><path d="M42 46l-5 13M49 48l-3 14M56 48l-1 14M63 47l1 13"/></g>
    <path d="M30 31c11-11 31-13 47-5 14 8 21 22 15 34-4 8-12 12-21 12l-2-8c7 0 11-4 12-8 2-8-2-16-12-20-12-6-26-2-34 4Z" fill="url(#${u('s')})"/>
    <path d="M69 72l-9 11 15-2 2 9 5-15Z" fill="url(#${u('s')})"/><path d="M60 83l15-2M75 81l2 9" stroke="#a92f20" stroke-width=".8" fill="none"/>
    <g stroke="#ffd1bf" stroke-width="1.3" fill="none" opacity=".75" stroke-linecap="round"><path d="M44 24c2 5 2 11 0 15M54 22c2 6 2 12 0 18M64 24c3 6 3 12 0 18M74 30c2 6 2 12-2 16M82 40c1 5 0 10-3 13"/></g>
    ${shine('M38 26c10-6 22-7 32-4-11 0-22 2-32 7Z', .4)}${eye(35, 33, 2.2)}`,
  jellyfish: u => `<defs>${radial(u('bell'), [[0, '#e4f0ff', .95], [.5, '#9cc0f6', .9], [1, '#6f86e6', .75]], .45, .35, .65)}${linear(u('arm'), [[0, '#c9b6ff', .9], [1, '#9f8cf0', .2]])}</defs>
    <g stroke="url(#${u('arm')})" stroke-width="1.8" fill="none" stroke-linecap="round"><path d="M32 46c-5 10 4 16-1 26s3 13 0 17"/><path d="M45 48c4 10-4 18 2 28s-2 10 0 13"/><path d="M75 48c4 10-4 18 2 28"/><path d="M88 46c5 10-4 16 0 26s-2 12 1 16"/></g>
    <path d="M48 46c-2 12 6 18 2 28 6-3 9-12 8-20Zm24 0c2 12-6 18-2 28-6-3-9-12-8-20Z" fill="#c8b4ff" opacity=".7"/>
    <path d="M54 47c3 14 1 24 6 34 5-10 3-20 6-34Z" fill="#b8a3fb" opacity=".75"/><path d="M57 50q3 14 3 26M63 50q-1 14-3 26" stroke="#efe6ff" stroke-width=".7" fill="none" opacity=".7"/>
    <path d="M22 44c0-23 17-36 38-36s38 13 38 36c-5 3-10 1-15 3-4-3-9-3-13 0-5-2-9-2-13 0-4-3-9-3-13 0-5-2-10 0-15-3Z" fill="url(#${u('bell')})"/>
    <path d="M30 42c8-6 18-8 30-8s22 2 30 8" stroke="#eef4ff" stroke-width="1" fill="none" opacity=".5"/>
    <g fill="#f3c6ff" opacity=".7"><ellipse cx="48" cy="30" rx="4" ry="3"/><ellipse cx="60" cy="27" rx="4" ry="3"/><ellipse cx="72" cy="30" rx="4" ry="3"/></g>
    ${shine('M32 30c4-11 13-17 24-18-9 4-16 10-20 19Z', .55)}`,
  seahorse: u => `<defs>${linear(u('h'), [[0, '#ffe58a'], [.6, '#f2c24e'], [1, '#d99a2b']], 0, 0, 1, 1)}</defs>
    <path d="M66 46c7 4 13 1 16-4-1 7-6 12-13 12Z" fill="#ffd97a" opacity=".85"/><g stroke="#e3a53a" stroke-width=".7" opacity=".7"><path d="M70 50l10-6M69 52l12-3"/></g>
    <path d="M60 8c11-1 18 7 16 16l18 4-17 5c-2 6-6 9-8 13 11 6 15 19 9 29-6 11-19 13-26 5-5-6-1-15 6-14-5 5-3 9 2 9 7 0 9-11 2-17-9-7-15-15-13-28C49 17 52 9 60 8Z" fill="url(#${u('h')})"/>
    <g fill="none" stroke="#d6962f" stroke-width="1.3" stroke-linecap="round"><path d="M55 22h10M53 30h11M53 38h12M56 46h10M60 54h8"/></g>
    <g fill="#d99a2b"><path d="M56 6l2-6 3 6 4-4 1 7Z"/><path d="M50 27l-5 2 5 2Zm-1 9-5 2 5 2Zm2 9-5 2 5 2Z"/></g>
    ${shine('M54 14c2-4 6-6 10-5-4 2-6 5-7 9Z', .45)}${eye(66, 18, 2.2, '#3a2408')}`,
  stonefish: u => `<defs>${radial(u('b'), [[0, '#b58e64'], [.6, '#8a6646'], [1, '#5e4430']], .45, .4, .6)}</defs>
    <path d="M20 52 7 41v23Z" fill="#7a5c3e"/><path d="M40 30l4-10 5 9 4-11 5 10 5-9 3 11" fill="#8f6a48"/>
    <path d="M18 52c0-21 21-35 47-35 25 0 41 13 43 29 2 17-14 29-43 29-28 0-47-6-47-23Z" fill="url(#${u('b')})"/>
    <g fill="#c9a47a" opacity=".85"><circle cx="38" cy="36" r="6"/><circle cx="57" cy="27" r="5"/><circle cx="77" cy="31" r="6"/><circle cx="33" cy="57" r="5"/><circle cx="53" cy="63" r="6"/><circle cx="92" cy="54" r="4"/><circle cx="70" cy="64" r="3.5"/></g>
    <g fill="#5d432c" opacity=".8"><circle cx="48" cy="45" r="3"/><circle cx="66" cy="41" r="2.4"/><circle cx="43" cy="63" r="2"/><circle cx="82" cy="45" r="1.8"/><circle cx="60" cy="54" r="1.6"/></g>
    <g fill="#e8cfae" opacity=".6"><circle cx="36" cy="34" r="1.6"/><circle cx="56" cy="25" r="1.3"/><circle cx="75" cy="29" r="1.6"/></g>
    <path d="M78 59c9-6 20-6 28-1" stroke="#3b2a1a" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M86 57l1 3M93 56v3M100 57l-1 3" stroke="#f3e6d2" stroke-width="1" stroke-linecap="round"/>
    ${eye(86, 39, 2.6, '#4a1e10')}<path d="M81 35q5-4 10 0" stroke="#5e4430" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
};
export function creatureArt(id, { hidden = false, label = '' } = {}) {
  const prefix = `cr${++drawn}`, u = name => `${prefix}-${name}`;
  return `<svg class="creature-art${hidden ? ' is-hidden' : ''}" viewBox="0 0 120 90" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${ART[id] ? ART[id](u) : ''}</svg>`;
}
