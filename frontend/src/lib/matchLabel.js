export function matchLabel(match) {
  const number = String(match?.match_number ?? match?.matchNumber ?? '');
  return /^[1-9]\d*$/.test(number) ? `#${number.padStart(3,'0')}` : 'Chưa cấp số';
}

export function matchesMatchNumber(match,query) {
  const value = query.trim().replace(/^#/,'');
  if (!/^\d+$/.test(value)) return false;
  return value.replace(/^0+(?=\d)/,'') === String(match?.match_number ?? match?.matchNumber ?? '');
}
