/**
 * The Nationality Map (Nesil, 4 Nov; the PM's "Nationality to region" map): which sales region a student's
 * nationality goes to. Application Routing's rule "Student's nationality" reads it; a nationality that isn't mapped
 * falls to the Fallback. Only a student's nationality reads it: an RP's and a branch's region come from each
 * region's countries (Sales Regions). Nationalities can be added (a country and its region) and deleted (4 Nov,
 * later). Sample data.
 */

/** A nationality, the country it's of (as the country list names it), and its sales region ('' when not mapped). */
export type NationalityRow = { country: string; nationality: string; region: string };

/** Country, then how its people are called. Sovereign states and a few places students come from. */
const DEMONYMS =
  'Afghanistan:Afghan|Albania:Albanian|Algeria:Algerian|Andorra:Andorran|Angola:Angolan|Antigua And Barbuda:Antiguan and Barbudan|Argentina:Argentine|Armenia:Armenian|Australia:Australian|Austria:Austrian|Azerbaijan:Azerbaijani|The Bahamas:Bahamian|Bahrain:Bahraini|Bangladesh:Bangladeshi|Barbados:Barbadian|Belarus:Belarusian|Belgium:Belgian|Belize:Belizean|Benin:Beninese|Bhutan:Bhutanese|Bolivia:Bolivian|Bosnia and Herzegovina:Bosnian|Botswana:Botswanan|Brazil:Brazilian|Brunei:Bruneian|Bulgaria:Bulgarian|Burkina Faso:Burkinabé|Burundi:Burundian|Cambodia:Cambodian|Cameroon:Cameroonian|Canada:Canadian|Cape Verde:Cape Verdean|Central African Republic:Central African|Chad:Chadian|Chile:Chilean|China:Chinese|Colombia:Colombian|Comoros:Comorian|Congo:Congolese|Democratic Republic of the Congo:Congolese (DR Congo)|Costa Rica:Costa Rican|Cote D\'Ivoire (Ivory Coast):Ivorian|Croatia:Croatian|Cuba:Cuban|Cyprus:Cypriot|Czech Republic:Czech|Denmark:Danish|Djibouti:Djiboutian|Dominica:Dominican (Dominica)|Dominican Republic:Dominican|East Timor:Timorese|Ecuador:Ecuadorian|Egypt:Egyptian|El Salvador:Salvadoran|Equatorial Guinea:Equatoguinean|Eritrea:Eritrean|Estonia:Estonian|Swaziland:Swazi|Ethiopia:Ethiopian|Fiji Islands:Fijian|Finland:Finnish|France:French|Gabon:Gabonese|The Gambia:Gambian|Georgia:Georgian|Germany:German|Ghana:Ghanaian|Greece:Greek|Grenada:Grenadian|Guatemala:Guatemalan|Guinea:Guinean|Guinea-Bissau:Bissau-Guinean|Guyana:Guyanese|Haiti:Haitian|Honduras:Honduran|Hong Kong S.A.R.:Hong Konger|Hungary:Hungarian|Iceland:Icelandic|India:Indian|Indonesia:Indonesian|Iran:Iranian|Iraq:Iraqi|Ireland:Irish|Israel:Israeli|Italy:Italian|Jamaica:Jamaican|Japan:Japanese|Jordan:Jordanian|Kazakhstan:Kazakhstani|Kenya:Kenyan|Kiribati:I-Kiribati|Kosovo:Kosovar|Kuwait:Kuwaiti|Kyrgyzstan:Kyrgyzstani|Laos:Lao|Latvia:Latvian|Lebanon:Lebanese|Lesotho:Basotho|Liberia:Liberian|Libya:Libyan|Liechtenstein:Liechtensteiner|Lithuania:Lithuanian|Luxembourg:Luxembourgish|Macau S.A.R.:Macanese|Macedonia:Macedonian|Madagascar:Malagasy|Malawi:Malawian|Malaysia:Malaysian|Maldives:Maldivian|Mali:Malian|Malta:Maltese|Marshall Islands:Marshallese|Mauritania:Mauritanian|Mauritius:Mauritian|Mexico:Mexican|Micronesia:Micronesian|Moldova:Moldovan|Monaco:Monégasque|Mongolia:Mongolian|Montenegro:Montenegrin|Morocco:Moroccan|Mozambique:Mozambican|Myanmar:Burmese|Namibia:Namibian|Nauru:Nauruan|Nepal:Nepali|Netherlands:Dutch|New Zealand:New Zealander|Nicaragua:Nicaraguan|Niger:Nigerien|Nigeria:Nigerian|North Korea:North Korean|Norway:Norwegian|Oman:Omani|Pakistan:Pakistani|Palau:Palauan|Palestinian Territory Occupied:Palestinian|Panama:Panamanian|Papua new Guinea:Papua New Guinean|Paraguay:Paraguayan|Peru:Peruvian|Philippines:Filipino|Poland:Polish|Portugal:Portuguese|Qatar:Qatari|Romania:Romanian|Russia:Russian|Rwanda:Rwandan|Saint Kitts And Nevis:Kittitian|Saint Lucia:Saint Lucian|Saint Vincent And The Grenadines:Vincentian|Samoa:Samoan|San Marino:Sammarinese|Sao Tome and Principe:São Toméan|Saudi Arabia:Saudi|Senegal:Senegalese|Serbia:Serbian|Seychelles:Seychellois|Sierra Leone:Sierra Leonean|Singapore:Singaporean|Slovakia:Slovak|Slovenia:Slovenian|Solomon Islands:Solomon Islander|Somalia:Somali|South Africa:South African|South Korea:South Korean|South Sudan:South Sudanese|Spain:Spanish|Sri Lanka:Sri Lankan|Sudan:Sudanese|Suriname:Surinamese|Sweden:Swedish|Switzerland:Swiss|Syria:Syrian|Taiwan:Taiwanese|Tajikistan:Tajikistani|Tanzania:Tanzanian|Thailand:Thai|Togo:Togolese|Tonga:Tongan|Trinidad And Tobago:Trinidadian|Tunisia:Tunisian|Turkey:Turkish|Turkmenistan:Turkmen|Tuvalu:Tuvaluan|Uganda:Ugandan|Ukraine:Ukrainian|United Arab Emirates:Emirati|United Kingdom:British|United States:American|Uruguay:Uruguayan|Uzbekistan:Uzbekistani|Vanuatu:Ni-Vanuatu|Vatican City State (Holy See):Vatican|Venezuela:Venezuelan|Vietnam:Vietnamese|Yemen:Yemeni|Zambia:Zambian|Zimbabwe:Zimbabwean';

/** Europe, Latin America and the Caribbean: the sample maps their students to Latin America and Europe. */
const LATAM_EUROPE = new Set(
  'Albania|Andorra|Austria|Belarus|Belgium|Bosnia and Herzegovina|Bulgaria|Croatia|Cyprus|Czech Republic|Denmark|Estonia|Finland|France|Germany|Greece|Hungary|Iceland|Ireland|Italy|Kosovo|Latvia|Liechtenstein|Lithuania|Luxembourg|Macedonia|Malta|Moldova|Monaco|Montenegro|Netherlands|Norway|Poland|Portugal|Romania|San Marino|Serbia|Slovakia|Slovenia|Spain|Sweden|Switzerland|Ukraine|United Kingdom|Vatican City State (Holy See)|Antigua And Barbuda|Argentina|The Bahamas|Barbados|Belize|Bolivia|Brazil|Chile|Colombia|Costa Rica|Cuba|Dominica|Dominican Republic|Ecuador|El Salvador|Grenada|Guatemala|Guyana|Haiti|Honduras|Jamaica|Mexico|Nicaragua|Panama|Paraguay|Peru|Saint Kitts And Nevis|Saint Lucia|Saint Vincent And The Grenadines|Suriname|Trinidad And Tobago|Uruguay|Venezuela'.split('|'),
);
/** Not mapped in the sample, so they fall to the Fallback (the Gulf: GSP hasn't given it a region yet). */
const UNMAPPED = new Set(['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman']);

/** The sample map: a country in a sales region's countries goes there; then Europe and Latin America; the rest to Rest of world. */
export function sampleNationalities(regions: { name: string; countries: string[] }[]): NationalityRow[] {
  const regionOf = new Map(regions.flatMap((r) => r.countries.map((c) => [c, r.name] as const)));
  return DEMONYMS.split('|')
    .map((pair) => {
      const [country, nationality] = pair.split(':');
      const region = UNMAPPED.has(country) ? '' : (regionOf.get(country) ?? (LATAM_EUROPE.has(country) ? 'Latin America and Europe' : 'Rest of world'));
      return { country, nationality, region };
    })
    .sort((a, b) => a.nationality.localeCompare(b.nationality));
}

const OF = new Map(DEMONYMS.split('|').map((pair) => pair.split(':') as [string, string]));
/** How a country's people are called; the country's own name where the list doesn't say (4 Nov: Add Nationality). */
export const nationalityOf = (country: string) => OF.get(country) ?? country;

/** Country to region, as routing reads it ('' or missing: not mapped). */
export const nationalityRegions = (rows: NationalityRow[]): Record<string, string> => Object.fromEntries(rows.map((r) => [r.country, r.region]));
