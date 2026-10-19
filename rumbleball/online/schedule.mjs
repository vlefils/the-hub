const format = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function parisDateTime(value) {
  const p = Object.fromEntries(format.formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function scheduledInstant(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Choisissez la date et l’heure du premier match.');
  for (const offset of ['+02:00', '+01:00']) {
    const date = new Date(value + offset);
    if (Number.isFinite(date.getTime()) && parisDateTime(date) === value) return date.toISOString();
  }
  throw new Error('Cette heure n’existe pas à Paris lors du changement d’heure. Choisissez un autre horaire.');
}
