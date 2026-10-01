const P = {
  home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>', book:'<path d="M4 4h11a4 4 0 014 4v12H8a4 4 0 01-4-4z"/><path d="M4 16a4 4 0 014-4h11"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', megaphone:'<path d="M3 11v2a1 1 0 001 1h3l8 4V6L7 10H4a1 1 0 00-1 1z"/><path d="M19 9a4 4 0 010 6"/>',
  star:'<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>', user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
  send:'<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>', bell:'<path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 004 0"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>', plus:'<path d="M12 5v14M5 12h14"/>', check:'<path d="M5 12l5 5 9-10"/>', x:'<path d="M6 6l12 12M18 6L6 18"/>',
  alert:'<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/>'
};
export const icon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
