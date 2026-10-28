// English names of the three factions whose French names are translated.
export const factionNamesEnglish = {
  'Le Cabinet': 'The Cabinet',
  'le Cabinet': 'the Cabinet',
  'Le Syndicat': 'The Syndicate',
  'le Syndicat': 'the Syndicate',
  'Seconde Chance': 'Second Chance',
};

// Also migrate older cached translations and labels assembled from French data.
export const translateFactionNames = text => text
  .replace(/\bSeconde Chance\b/gi, 'Second Chance')
  .replace(/\b(a|an) Le (Cabinet|Syndicat)\b/gi, (_, article, name) => `${article.toLowerCase() === 'an' ? 'a' : article} ${name.toLowerCase() === 'cabinet' ? 'Cabinet' : 'Syndicate'}`)
  .replace(/\b(?:the )?Le (Cabinet|Syndicat)\b/gi, (match, name, offset, source) => {
    const article = !source.slice(0, offset).trim() || /[.!?]\s*$/.test(source.slice(0, offset)) ? 'The' : 'the';
    return `${article} ${name.toLowerCase() === 'cabinet' ? 'Cabinet' : 'Syndicate'}`;
  })
  .replace(/\bSyndicat\b/g, 'Syndicate')
  .replace(/\bUnion\b/g, 'Syndicate');
