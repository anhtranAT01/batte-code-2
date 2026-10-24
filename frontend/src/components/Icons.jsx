import React from 'react';

const paths = {
  leaderboard: <><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v2a4 4 0 0 0 4 4"/><path d="M17 6h3v2a4 4 0 0 1-4 4"/></>,
  pvp: <><path d="m6 3 12 18"/><path d="m18 3-5.2 9"/><path d="m6 21 5.2-9"/><path d="M4 3h4M16 3h4"/></>,
  boss: <><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M9 9h.01M15 9h.01M8 14h8M12 2v3"/></>,
  tournament: <><path d="M6 3h12v5c0 5-2.7 8-6 8s-6-3-6-8V3Z"/><path d="M8 21h8M12 16v5M6 6H3v2c0 2 1.3 3.5 3.5 4M18 6h3v2c0 2-1.3 3.5-3.5 4"/></>,
  rules: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v18H6.5A2.5 2.5 0 0 0 4 23V5.5ZM20 5.5A2.5 2.5 0 0 0 17.5 3H13v18h4.5A2.5 2.5 0 0 1 20 23V5.5Z"/></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
  bots: <><rect x="4" y="6" width="16" height="13" rx="3"/><path d="M12 3v3M8 11h.01M16 11h.01M8 15h8"/></>,
  admin: <><path d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7l-8-4Z"/><path d="m9 12 2 2 4-4"/></>,
  chat: <path d="M21 13a7 7 0 0 1-7 7H6l-4 2 1.3-4A9 9 0 1 1 21 13Z"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></>,
  moon: <path d="M20.4 15.5A8.5 8.5 0 0 1 8.5 3.6 8.5 8.5 0 1 0 20.4 15.5Z"/>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></>,
  login: <><path d="m14 8 4 4-4 4M18 12H7"/><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/></>,
};

export default function Icon({ name, size = 18, className = '' }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name] || paths.rules}</svg>;
}
