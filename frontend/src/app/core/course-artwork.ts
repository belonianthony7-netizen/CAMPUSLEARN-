import { assetById, fallbackForAsset, remoteForAsset } from './illustration-catalog';
/** Preset artwork included with the Angular app. No external image requests. */
export interface CoverPreset { id: string; label: string; }
export const COVER_PRESETS: readonly CoverPreset[] = [
  { id: 'auto', label: 'Automatique' },
  { id: 'python', label: 'Python' },
  { id: 'sql', label: 'Bases de données' },
  { id: 'research', label: 'Recherche' },
  { id: 'web', label: 'Développement Web' },
  { id: 'math', label: 'Mathématiques' },
  { id: 'business', label: 'Économie' },
  { id: 'language', label: 'Langues' },
  { id: 'science', label: 'Sciences' },
];
const ASSET_ROOT = '/assets/illustrations/';
const namedCover: Record<string,string> = {
  python:'cover-python.svg',sql:'cover-sql.svg',research:'cover-research.svg',
  web:'cover-web.svg',math:'course-math.svg',business:'course-business.svg',
  language:'course-language.svg',science:'course-science.svg',
};
function norm(value:string): string {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
export function coverFor(title:string,category:string,choice='auto'): string {
  if (choice && choice!=='auto' && namedCover[choice]) return ASSET_ROOT + namedCover[choice];
  if (choice && choice !== 'auto' && assetById(choice)) return assetById(choice)!.src;
  const t=norm(title),c=norm(category);
  if (/python/.test(t)) return ASSET_ROOT+'cover-python.svg';
  if (/\b(sql|mysql|postgresql)\b|base[s]? de donnee/.test(t)) return ASSET_ROOT+'cover-sql.svg';
  if (/recherche|methodologie|memoire|protocole/.test(t)) return ASSET_ROOT+'cover-research.svg';
  if (/developpement web|\bhtml\b|\bcss\b|javascript|angular/.test(t)) return ASSET_ROOT+'cover-web.svg';
  if (/math|algebre|statist|probabilit/.test(t)) return ASSET_ROOT+'course-math.svg';
  if (/financ|econom|market|business|compta/.test(t)) return ASSET_ROOT+'course-business.svg';
  if (/anglais|francais|swahili|langue/.test(t)) return ASSET_ROOT+'course-language.svg';
  if (/biolog|physique|chimie/.test(t)) return ASSET_ROOT+'course-science.svg';
  if (/informati|numerique|logiciel/.test(c)) return ASSET_ROOT+'course-tech.svg';
  if (/math/.test(c)) return ASSET_ROOT+'course-math.svg';
  if (/econom|financ/.test(c)) return ASSET_ROOT+'course-business.svg';
  if (/langue/.test(c)) return ASSET_ROOT+'course-language.svg';
  if (/science/.test(c)) return ASSET_ROOT+'course-science.svg';
  if (/methodolog/.test(c)) return ASSET_ROOT+'cover-research.svg';
  return ASSET_ROOT+'course-general.svg';
}

export function fallbackForCover(choice:string): string { return fallbackForAsset(choice); }
export function remoteForCover(choice:string): string {return remoteForAsset(choice);}
