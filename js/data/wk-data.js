// ─── WK 2026 data ─────────────────────────────────────────────────────────
// FIFA-codes → ISO 3166-1 alpha-2 voor flag-icons, teamdata met bingowoorden,
// groepsindeling en speelschema (groepsfase + knock-out).
//
// I18n: team-namen, bingo-woorden en wedstrijddatums worden vertaald via
// teamName() / teamWoorden() / formatMatchDate(). NL is canoniek (in WK_TEAMS),
// EN-vertalingen komen uit EN_COUNTRY_NAMES + EN_WORD_MAP hieronder.

import { getLang } from '../i18n/i18n.js';

// FIFA 3-letter codes → ISO 3166-1 alpha-2 voor flag-icons.
// Engeland & Schotland gebruiken GB-subdivisies (eigen vlag-codes).
export const FIFA_TO_ISO = {
    USA:'us', MEX:'mx', CAN:'ca', ARG:'ar', BRA:'br', URU:'uy', COL:'co',
    ECU:'ec', CHI:'cl', PAR:'py', BOL:'bo', PER:'pe', NED:'nl', BEL:'be',
    FRA:'fr', GER:'de', ESP:'es', POR:'pt', ENG:'gb-eng', ITA:'it', CRO:'hr',
    DEN:'dk', SUI:'ch', AUT:'at', POL:'pl', SCO:'gb-sct', TUR:'tr', CZE:'cz',
    ROU:'ro', SVK:'sk', ALB:'al', SVN:'si', HUN:'hu', MAR:'ma', SEN:'sn',
    CMR:'cm', CIV:'ci', EGY:'eg', NGA:'ng', GHA:'gh', AUS:'au', JPN:'jp',
    KOR:'kr', IRN:'ir', SAU:'sa', QAT:'qa', NZL:'nz', PAN:'pa', ZAF:'za',
    BIH:'ba', HAI:'ht', CUW:'cw', SWE:'se', TUN:'tn', CPV:'cv', IRQ:'iq',
    NOR:'no', JOR:'jo', ALG:'dz', COD:'cd', UZB:'uz'
};

// SVG-vlag voor een FIFA-code (fallback = voetbal-emoji).
export function flagSpan(fifaCode) {
    const iso = FIFA_TO_ISO[fifaCode];
    if (!iso) return '<span class="wk-flag-fallback">⚽</span>';
    return `<span class="fi fi-${iso}" aria-label="${fifaCode}"></span>`;
}

export const WK_TEAMS = {
    'USA': { naam:'Verenigde Staten', vlag:'🇺🇸', nickname:'Stars & Stripes',
        woorden:['Pulisic','McKennie','Tyler Adams','Robinson','Turner','Stars & Stripes','Gastheerland','Washington','LA Galaxy'] },
    'MEX': { naam:'Mexico', vlag:'🇲🇽', nickname:'El Tri',
        woorden:['Edson Álvarez','Lozano','Raúl Jiménez','Montes','Chavez','El Tri','Azteca','Mexico-Stad','Club América'] },
    'CAN': { naam:'Canada', vlag:'🇨🇦', nickname:'Les Rouges',
        woorden:['Davies','David','Buchanan','Eustáquio','Larin','Les Rouges','Gastheerland','Ottawa','Toronto FC'] },
    'ARG': { naam:'Argentinië', vlag:'🇦🇷', nickname:'La Albiceleste',
        woorden:['Messi','De Paul','Julián Álvarez','Mac Allister','Enzo Fernández','La Albiceleste','Wereldkampioen','Buenos Aires','Boca Juniors'] },
    'BRA': { naam:'Brazilië', vlag:'🇧🇷', nickname:'Seleção',
        woorden:['Vinicius Jr','Matheus Cunha','Raphinha','Marquinhos','Bruno Guimarães','Seleção','Copacabana','Brasília','Flamengo'] },
    'URU': { naam:'Uruguay', vlag:'🇺🇾', nickname:'La Celeste',
        woorden:['Darwin Núñez','Valverde','Bentancur','Ronald Araújo','Olivera','La Celeste','Montevideo','Peñarol'] },
    'COL': { naam:'Colombia', vlag:'🇨🇴', nickname:'Los Cafeteros',
        woorden:['Luis Díaz','James Rodríguez','Daniel Muñoz','Lerma','Jhon Córdoba','Los Cafeteros','Bogotá','Atlético Nacional'] },
    'ECU': { naam:'Ecuador', vlag:'🇪🇨', nickname:'La Tri',
        woorden:['Valencia','Caicedo','Estupiñán','Hincapié','Willian Pacho','La Tri','Quito','LDU Quito'] },
    'CHI': { naam:'Chili', vlag:'🇨🇱', nickname:'La Roja',
        woorden:['Alexis Sánchez','Vidal','Brereton','La Roja','Medel','Pulgar','Aranguiz','Santiago','Colo-Colo'] },
    'PAR': { naam:'Paraguay', vlag:'🇵🇾', nickname:'La Albirroja',
        woorden:['Almirón','Enciso','Gustavo Gómez','Sanabria','Diego Gómez','La Albirroja','Asunción','Olimpia'] },
    'BOL': { naam:'Bolivia', vlag:'🇧🇴', nickname:'La Verde',
        woorden:['Marcelo Moreno','Arce','La Verde','Algarañaz','Justiniano','Fernández','La Paz','Bolívar'] },
    'PER': { naam:'Peru', vlag:'🇵🇪', nickname:'La Blanquirroja',
        woorden:['Guerrero','Cueva','Carrillo','La Blanquirroja','Tapia','Peña','Flores','Lima','Universitario'] },
    'NED': { naam:'Nederland', vlag:'🇳🇱', nickname:'Oranje',
        woorden:['Van Dijk','Gakpo','Frenkie de Jong','Dumfries','Reijnders','Oranje','Oranjegekte','Amsterdam','PSV'] },
    'BEL': { naam:'België', vlag:'🇧🇪', nickname:'Rode Duivels',
        woorden:['De Bruyne','Lukaku','Doku','Amadou Onana','De Winter','Rode Duivels','Brussel','Club Brugge'] },
    'FRA': { naam:'Frankrijk', vlag:'🇫🇷', nickname:'Les Bleus',
        woorden:['Mbappé','Dembélé','Tchouaméni','Rabiot','Maignan','Les Bleus','Parijs','Paris Saint-Germain'] },
    'GER': { naam:'Duitsland', vlag:'🇩🇪', nickname:'Die Mannschaft',
        woorden:['Musiala','Wirtz','Kimmich','Havertz','Neuer','Die Mannschaft','Berlin','Bayern München'] },
    'ESP': { naam:'Spanje', vlag:'🇪🇸', nickname:'La Roja',
        woorden:['Rodri','Lamine Yamal','Pedri','Dani Olmo','Nico Williams','La Roja','Madrid','Real Madrid'] },
    'POR': { naam:'Portugal', vlag:'🇵🇹', nickname:'A Seleção das Quinas',
        woorden:['Bruno Fernandes','Bernardo Silva','Rúben Dias','Leão','Cristiano Ronaldo','Seleção das Quinas','Lissabon','Sporting CP'] },
    'ENG': { naam:'Engeland', vlag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', nickname:'The Three Lions',
        woorden:['Bellingham','Kane','Saka','Eze','Declan Rice','Three Lions','Wembley','Londen','Manchester City'] },
    'ITA': { naam:'Italië', vlag:'🇮🇹', nickname:'Gli Azzurri',
        woorden:['Barella','Donnarumma','Scamacca','Gli Azzurri','Chiesa','Tonali','Pellegrini','Rome','Inter'] },
    'CRO': { naam:'Kroatië', vlag:'🇭🇷', nickname:'Vatreni',
        woorden:['Modrić','Kovačić','Gvardiol','Kramarić','Pašalić','Vatreni','Zagreb','Dinamo Zagreb'] },
    'DEN': { naam:'Denemarken', vlag:'🇩🇰', nickname:'Danish Dynamite',
        woorden:['Eriksen','Höjbjerg','Dolberg','Danish Dynamite','Schmeichel','Maehle','Wind','Kopenhagen','FC København'] },
    'SUI': { naam:'Zwitserland', vlag:'🇨🇭', nickname:'Nati',
        woorden:['Xhaka','Akanji','Freuler','Zakaria','Ndoye','Nati','Alpen','Bern','Young Boys'] },
    'AUT': { naam:'Oostenrijk', vlag:'🇦🇹', nickname:'Das Team',
        woorden:['Sabitzer','Baumgartner','Laimer','Posch','Schlager','Das Team','Wenen','RB Salzburg'] },
    'POL': { naam:'Polen', vlag:'🇵🇱', nickname:'Biało-Czerwoni',
        woorden:['Lewandowski','Zieliński','Szymański','Biało-Czerwoni','Szczęsny','Zalewski','Milik','Warschau','Legia Warschau'] },
    'SCO': { naam:'Schotland', vlag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', nickname:'The Tartan Army',
        woorden:['McTominay','Robertson','McGinn','Lewis Ferguson','Angus Gunn','Tartan Army','Hampden Park','Edinburgh','Celtic'] },
    'TUR': { naam:'Turkije', vlag:'🇹🇷', nickname:'Ay-Yıldızlılar',
        woorden:['Çalhanoğlu','Arda Güler','Kenan Yıldız','Demiral','Ferdi Kadıoğlu','Ay-Yıldızlılar','Istanbul','Ankara','Galatasaray'] },
    'CZE': { naam:'Tsjechië', vlag:'🇨🇿', nickname:'Lvi',
        woorden:['Schick','Souček','Coufal','Provod','Staněk','Lvi','Praag','Sparta Praag'] },
    'ROU': { naam:'Roemenië', vlag:'🇷🇴', nickname:'Tricolorii',
        woorden:['Ianis Hagi','Stanciu','Drăguș','Tricolorii','Alibec','Florinel Coman','Rațiu','Boekarest','FCSB'] },
    'SVK': { naam:'Slowakije', vlag:'🇸🇰', nickname:'Sokolíci',
        woorden:['Lobotka','Haraslin','Duda','Sokolíci','Skriniar','Weiss','Strelec','Bratislava','Slovan Bratislava'] },
    'ALB': { naam:'Albanië', vlag:'🇦🇱', nickname:'Shqiponjat',
        woorden:['Broja','Asllani','Bajrami','Shqiponjat','Gjasula','Ramadani','Hysaj','Tirana','KF Tirana'] },
    'SVN': { naam:'Slovenië', vlag:'🇸🇮', nickname:'Zmaji',
        woorden:['Šeško','Mlakar','Oblak','Zmaji','Stojanović','Elšnik','Verbič','Ljubljana','NK Maribor'] },
    'HUN': { naam:'Hongarije', vlag:'🇭🇺', nickname:'Aranycsapat',
        woorden:['Szoboszlai','Sallai','Nikola Milosevic','Aranycsapat','Gulácsi','Kerkez','Varga','Boedapest','Ferencváros'] },
    'MAR': { naam:'Marokko', vlag:'🇲🇦', nickname:'Atlas Leeuwen',
        woorden:['Hakimi','Brahim Díaz','El Kaabi','Ounahi','Amrabat','Atlas Leeuwen','Rabat','Raja Casablanca'] },
    'SEN': { naam:'Senegal', vlag:'🇸🇳', nickname:'Les Lions de la Téranga',
        woorden:['Sadio Mané','Koulibaly','Pape Matar Sarr','Jackson','Mendy','Lions de la Téranga','Dakar','Jaraaf'] },
    'CMR': { naam:'Kameroen', vlag:'🇨🇲', nickname:'Ontembare Leeuwen',
        woorden:['Anguissa','Choupo-Moting','Toko Ekambi','Ontembare Leeuwen','Mbeumo','Ondoa','Aboubakar','Yaoundé','Coton Sport'] },
    'CIV': { naam:'Ivoorkust', vlag:'🇨🇮', nickname:'Olifanten',
        woorden:['Haller','Kessié','Sangaré','Simon Adingra','Diomande','Olifanten','Abidjan','ASEC Mimosas'] },
    'EGY': { naam:'Egypte', vlag:'🇪🇬', nickname:'Farao\'s',
        woorden:['Salah','Marmoush','Trezeguet','Emam Ashour','El Shenawy',"Farao's",'Caïro','Al-Ahly'] },
    'NGA': { naam:'Nigeria', vlag:'🇳🇬', nickname:'Super Eagles',
        woorden:['Osimhen','Lookman','Iheanacho','Super Eagles','Aina','Chukwueze','Ndidi','Abuja','Enyimba'] },
    'GHA': { naam:'Ghana', vlag:'🇬🇭', nickname:'Black Stars',
        woorden:['Kamaldeen Sulemana','Thomas Partey','Iñaki Williams','Alexander Djiku','Semenyo','Black Stars','Accra','Asante Kotoko'] },
    'AUS': { naam:'Australië', vlag:'🇦🇺', nickname:'Socceroos',
        woorden:['Jackson Irvine','Mathew Ryan','Goodwin','Souttar','Circati','Socceroos','Sydney','Canberra','Melbourne Victory'] },
    'JPN': { naam:'Japan', vlag:'🇯🇵', nickname:'Samurai Blue',
        woorden:['Kubo','Doan','Endo','Daizen Maeda','Itakura','Samurai Blue','Tokyo','Vissel Kobe'] },
    'KOR': { naam:'Zuid-Korea', vlag:'🇰🇷', nickname:'Taeguk Warriors',
        woorden:['Son Heung-min','Lee Kang-in','Kim Min-jae','Hwang Hee-chan','Hwang In-beom','Taeguk Warriors','Seoul','Ulsan HD'] },
    'IRN': { naam:'Iran', vlag:'🇮🇷', nickname:'Team Melli',
        woorden:['Taremi','Mohebi','Jahanbakhsh','Ghoddos','Mohammadi','Team Melli','Teheran','Persepolis'] },
    'SAU': { naam:'Saoedi-Arabië', vlag:'🇸🇦', nickname:'Green Falcons',
        woorden:['Salem Al-Dawsari','Saud Abdulhamid','Al-Shehri','Kanno','Al-Owais','Green Falcons','Riad','Al-Hilal'] },
    'QAT': { naam:'Qatar', vlag:'🇶🇦', nickname:'Al-Annabi',
        woorden:['Akram Afif','Almoez Ali','Mendes','Al-Haydos','Barsham','Al-Annabi','Doha','Al-Sadd'] },
    'NZL': { naam:'Nieuw-Zeeland', vlag:'🇳🇿', nickname:'All Whites',
        woorden:['Chris Wood','Cacace','Garbett','Stamenic','Paulsen','All Whites','Auckland','Wellington','Auckland City FC'] },
    'PAN': { naam:'Panama', vlag:'🇵🇦', nickname:'Los Canaleros',
        woorden:['Carrasquilla','Fajardo','José Córdoba','Murillo','Mosquera','Los Canaleros','Panama-Stad','Tauro FC'] },
    'ZAF': { naam:'Zuid-Afrika', vlag:'🇿🇦', nickname:'Bafana Bafana',
        woorden:['Lyle Foster','Tau','Teboho Mokoena','Khuliso Mudau','Williams','Bafana Bafana','Vuvuzela','Pretoria','Mamelodi Sundowns'] },
    'BIH': { naam:'Bosnië-Herzegovina', vlag:'🇧🇦', nickname:'Zmajevi',
        woorden:['Džeko','Demirović','Dedić','Kolašinac','Hadžikadunić','Zmajevi','Sarajevo','Zrinjski Mostar'] },
    'HAI': { naam:'Haïti', vlag:'🇭🇹', nickname:'Les Grenadiers',
        woorden:['Duckens Nazon','Frantzdy Pierrot','Jeanricner Bellegarde','Arcus','Placide','Les Grenadiers','Port-au-Prince'] },
    'CUW': { naam:'Curaçao', vlag:'🇨🇼', nickname:'Los Matadors',
        woorden:['Juninho Bacuna','Jearl Margaritha','Tahith Chong','Gorré','Room','Los Matadors','Willemstad'] },
    'SWE': { naam:'Zweden', vlag:'🇸🇪', nickname:'Blågult',
        woorden:['Isak','Lucas Bergvall','Gyökeres','Elanga','Lindelöf','Blågult','Stockholm','Malmö FF'] },
    'TUN': { naam:'Tunesië', vlag:'🇹🇳', nickname:'Arenden van Carthago',
        woorden:['Laidouni','Skhiri','Talbi','Abdi','Dahmen','Arenden van Carthago','Tunis','Espérance Tunis'] },
    'CPV': { naam:'Kaapverdië', vlag:'🇨🇻', nickname:'Tubarões Azuis',
        woorden:['Ryan Mendes','Logan Costa','Jovane Cabral','Garry Rodrigues','Vozinha','Tubarões Azuis','Praia'] },
    'IRQ': { naam:'Irak', vlag:'🇮🇶', nickname:'Leeuwen van Mesopotamië',
        woorden:['Aymen Hussein','Ali Jasim','Amir Al-Ammari','Sulaka','Mohanad Ali','Leeuwen van Mesopotamië','Bagdad','Al-Shorta'] },
    'NOR': { naam:'Noorwegen', vlag:'🇳🇴', nickname:'Viking',
        woorden:['Haaland','Ødegaard','Sørloth','Berge','Ryerson','Viking','Oslo','Bodø/Glimt'] },
    'JOR': { naam:'Jordanië', vlag:'🇯🇴', nickname:'Al-Nashama',
        woorden:['Musa Al-Taamari','Yazan Al-Arab','Olwan','Al-Mardi','Abualaila','Al-Nashama','Amman','Al-Faisaly'] },
    'ALG': { naam:'Algerije', vlag:'🇩🇿', nickname:'Les Fennecs',
        woorden:['Mahrez','Bennacer','Aït-Nouri','Gouiri','Luca Zidane','Les Fennecs','Algiers','MC Alger'] },
    'COD': { naam:'Congo', vlag:'🇨🇩', nickname:'Leoparden',
        woorden:['Wissa','Chancel Mbemba','Elia','Moutoussamy','Banza','Leoparden','Kinshasa','TP Mazembe'] },
    'UZB': { naam:'Oezbekistan', vlag:'🇺🇿', nickname:'Oq Burgutlar',
        woorden:['Shomurodov','Fayzullaev','Masharipov','Ashurmatov','Khusanov','Oq Burgutlar','Tasjkent','Pakhtakor'] }
};

// Definitieve groepsindeling WK 2026 (bron: KPN/FIFA speelschema)
export const WK_GROEPEN = {
    'A': { teams: ['MEX', 'ZAF', 'KOR', 'CZE'] },
    'B': { teams: ['CAN', 'BIH', 'QAT', 'SUI'] },
    'C': { teams: ['BRA', 'MAR', 'HAI', 'SCO'] },
    'D': { teams: ['USA', 'PAR', 'AUS', 'TUR'] },
    'E': { teams: ['GER', 'CUW', 'CIV', 'ECU'] },
    'F': { teams: ['NED', 'JPN', 'SWE', 'TUN'] },
    'G': { teams: ['BEL', 'EGY', 'IRN', 'NZL'] },
    'H': { teams: ['ESP', 'CPV', 'SAU', 'URU'] },
    'I': { teams: ['FRA', 'SEN', 'IRQ', 'NOR'] },
    'J': { teams: ['AUT', 'JOR', 'ARG', 'ALG'] },
    'K': { teams: ['POR', 'COD', 'UZB', 'COL'] },
    'L': { teams: ['ENG', 'CRO', 'GHA', 'PAN'] }
};

// Echte groepsfase-wedstrijden (bron: KPN/FIFA speelschema juni 2026)
export const WK_GROEPSWEDSTRIJDEN = [
    // Groep A
    {id:'A1',fase:'Groepsfase',poule:'A',team1:'MEX',team2:'ZAF',datum:'11 jun',extra:[]},
    {id:'A2',fase:'Groepsfase',poule:'A',team1:'KOR',team2:'CZE',datum:'12 jun',extra:[]},
    {id:'A3',fase:'Groepsfase',poule:'A',team1:'CZE',team2:'ZAF',datum:'18 jun',extra:[]},
    {id:'A4',fase:'Groepsfase',poule:'A',team1:'MEX',team2:'KOR',datum:'19 jun',extra:[]},
    {id:'A5',fase:'Groepsfase',poule:'A',team1:'CZE',team2:'MEX',datum:'25 jun',extra:[]},
    {id:'A6',fase:'Groepsfase',poule:'A',team1:'ZAF',team2:'KOR',datum:'25 jun',extra:[]},
    // Groep B
    {id:'B1',fase:'Groepsfase',poule:'B',team1:'CAN',team2:'BIH',datum:'12 jun',extra:['Gastheerland Canada']},
    {id:'B2',fase:'Groepsfase',poule:'B',team1:'QAT',team2:'SUI',datum:'13 jun',extra:[]},
    {id:'B3',fase:'Groepsfase',poule:'B',team1:'SUI',team2:'BIH',datum:'18 jun',extra:[]},
    {id:'B4',fase:'Groepsfase',poule:'B',team1:'CAN',team2:'QAT',datum:'19 jun',extra:[]},
    {id:'B5',fase:'Groepsfase',poule:'B',team1:'SUI',team2:'CAN',datum:'24 jun',extra:[]},
    {id:'B6',fase:'Groepsfase',poule:'B',team1:'BIH',team2:'QAT',datum:'24 jun',extra:[]},
    // Groep C
    {id:'C1',fase:'Groepsfase',poule:'C',team1:'BRA',team2:'MAR',datum:'14 jun',extra:[]},
    {id:'C2',fase:'Groepsfase',poule:'C',team1:'HAI',team2:'SCO',datum:'14 jun',extra:[]},
    {id:'C3',fase:'Groepsfase',poule:'C',team1:'SCO',team2:'MAR',datum:'20 jun',extra:[]},
    {id:'C4',fase:'Groepsfase',poule:'C',team1:'BRA',team2:'HAI',datum:'20 jun',extra:[]},
    {id:'C5',fase:'Groepsfase',poule:'C',team1:'SCO',team2:'BRA',datum:'25 jun',extra:[]},
    {id:'C6',fase:'Groepsfase',poule:'C',team1:'MAR',team2:'HAI',datum:'25 jun',extra:[]},
    // Groep D
    {id:'D1',fase:'Groepsfase',poule:'D',team1:'USA',team2:'PAR',datum:'13 jun',extra:['Gastheerland VS']},
    {id:'D2',fase:'Groepsfase',poule:'D',team1:'AUS',team2:'TUR',datum:'14 jun',extra:[]},
    {id:'D3',fase:'Groepsfase',poule:'D',team1:'USA',team2:'AUS',datum:'19 jun',extra:[]},
    {id:'D4',fase:'Groepsfase',poule:'D',team1:'TUR',team2:'PAR',datum:'20 jun',extra:[]},
    {id:'D5',fase:'Groepsfase',poule:'D',team1:'TUR',team2:'USA',datum:'26 jun',extra:[]},
    {id:'D6',fase:'Groepsfase',poule:'D',team1:'PAR',team2:'AUS',datum:'26 jun',extra:[]},
    // Groep E
    {id:'E1',fase:'Groepsfase',poule:'E',team1:'GER',team2:'CUW',datum:'14 jun',extra:[]},
    {id:'E2',fase:'Groepsfase',poule:'E',team1:'CIV',team2:'ECU',datum:'15 jun',extra:[]},
    {id:'E3',fase:'Groepsfase',poule:'E',team1:'GER',team2:'CIV',datum:'20 jun',extra:[]},
    {id:'E4',fase:'Groepsfase',poule:'E',team1:'ECU',team2:'CUW',datum:'21 jun',extra:[]},
    {id:'E5',fase:'Groepsfase',poule:'E',team1:'ECU',team2:'GER',datum:'25 jun',extra:[]},
    {id:'E6',fase:'Groepsfase',poule:'E',team1:'CUW',team2:'CIV',datum:'25 jun',extra:[]},
    // Groep F
    {id:'F1',fase:'Groepsfase',poule:'F',team1:'NED',team2:'JPN',datum:'14 jun',extra:['Oranje op het WK']},
    {id:'F2',fase:'Groepsfase',poule:'F',team1:'SWE',team2:'TUN',datum:'15 jun',extra:[]},
    {id:'F3',fase:'Groepsfase',poule:'F',team1:'NED',team2:'SWE',datum:'20 jun',extra:[]},
    {id:'F4',fase:'Groepsfase',poule:'F',team1:'TUN',team2:'JPN',datum:'20 jun',extra:[]},
    {id:'F5',fase:'Groepsfase',poule:'F',team1:'JPN',team2:'SWE',datum:'26 jun',extra:[]},
    {id:'F6',fase:'Groepsfase',poule:'F',team1:'TUN',team2:'NED',datum:'26 jun',extra:['Oranje moet winnen']},
    // Groep G
    {id:'G1',fase:'Groepsfase',poule:'G',team1:'BEL',team2:'EGY',datum:'15 jun',extra:[]},
    {id:'G2',fase:'Groepsfase',poule:'G',team1:'IRN',team2:'NZL',datum:'16 jun',extra:[]},
    {id:'G3',fase:'Groepsfase',poule:'G',team1:'BEL',team2:'IRN',datum:'21 jun',extra:[]},
    {id:'G4',fase:'Groepsfase',poule:'G',team1:'NZL',team2:'EGY',datum:'22 jun',extra:[]},
    {id:'G5',fase:'Groepsfase',poule:'G',team1:'EGY',team2:'IRN',datum:'27 jun',extra:[]},
    {id:'G6',fase:'Groepsfase',poule:'G',team1:'NZL',team2:'BEL',datum:'27 jun',extra:[]},
    // Groep H
    {id:'H1',fase:'Groepsfase',poule:'H',team1:'ESP',team2:'CPV',datum:'15 jun',extra:[]},
    {id:'H2',fase:'Groepsfase',poule:'H',team1:'SAU',team2:'URU',datum:'16 jun',extra:[]},
    {id:'H3',fase:'Groepsfase',poule:'H',team1:'ESP',team2:'SAU',datum:'21 jun',extra:[]},
    {id:'H4',fase:'Groepsfase',poule:'H',team1:'URU',team2:'CPV',datum:'22 jun',extra:[]},
    {id:'H5',fase:'Groepsfase',poule:'H',team1:'CPV',team2:'SAU',datum:'27 jun',extra:[]},
    {id:'H6',fase:'Groepsfase',poule:'H',team1:'URU',team2:'ESP',datum:'27 jun',extra:[]},
    // Groep I
    {id:'I1',fase:'Groepsfase',poule:'I',team1:'FRA',team2:'SEN',datum:'16 jun',extra:[]},
    {id:'I2',fase:'Groepsfase',poule:'I',team1:'IRQ',team2:'NOR',datum:'17 jun',extra:[]},
    {id:'I3',fase:'Groepsfase',poule:'I',team1:'FRA',team2:'IRQ',datum:'22 jun',extra:[]},
    {id:'I4',fase:'Groepsfase',poule:'I',team1:'NOR',team2:'SEN',datum:'23 jun',extra:[]},
    {id:'I5',fase:'Groepsfase',poule:'I',team1:'NOR',team2:'FRA',datum:'26 jun',extra:[]},
    {id:'I6',fase:'Groepsfase',poule:'I',team1:'SEN',team2:'IRQ',datum:'26 jun',extra:[]},
    // Groep J
    {id:'J1',fase:'Groepsfase',poule:'J',team1:'AUT',team2:'JOR',datum:'16 jun',extra:[]},
    {id:'J2',fase:'Groepsfase',poule:'J',team1:'ARG',team2:'ALG',datum:'17 jun',extra:['Wereldkampioen Argentinië']},
    {id:'J3',fase:'Groepsfase',poule:'J',team1:'ARG',team2:'AUT',datum:'22 jun',extra:[]},
    {id:'J4',fase:'Groepsfase',poule:'J',team1:'JOR',team2:'ALG',datum:'23 jun',extra:[]},
    {id:'J5',fase:'Groepsfase',poule:'J',team1:'ALG',team2:'AUT',datum:'28 jun',extra:[]},
    {id:'J6',fase:'Groepsfase',poule:'J',team1:'JOR',team2:'ARG',datum:'28 jun',extra:[]},
    // Groep K
    {id:'K1',fase:'Groepsfase',poule:'K',team1:'POR',team2:'COD',datum:'17 jun',extra:[]},
    {id:'K2',fase:'Groepsfase',poule:'K',team1:'UZB',team2:'COL',datum:'18 jun',extra:[]},
    {id:'K3',fase:'Groepsfase',poule:'K',team1:'POR',team2:'UZB',datum:'23 jun',extra:[]},
    {id:'K4',fase:'Groepsfase',poule:'K',team1:'COL',team2:'COD',datum:'24 jun',extra:[]},
    {id:'K5',fase:'Groepsfase',poule:'K',team1:'COL',team2:'POR',datum:'28 jun',extra:[]},
    {id:'K6',fase:'Groepsfase',poule:'K',team1:'COD',team2:'UZB',datum:'28 jun',extra:[]},
    // Groep L
    {id:'L1',fase:'Groepsfase',poule:'L',team1:'ENG',team2:'CRO',datum:'17 jun',extra:[]},
    {id:'L2',fase:'Groepsfase',poule:'L',team1:'GHA',team2:'PAN',datum:'18 jun',extra:[]},
    {id:'L3',fase:'Groepsfase',poule:'L',team1:'ENG',team2:'GHA',datum:'23 jun',extra:[]},
    {id:'L4',fase:'Groepsfase',poule:'L',team1:'PAN',team2:'CRO',datum:'24 jun',extra:[]},
    {id:'L5',fase:'Groepsfase',poule:'L',team1:'PAN',team2:'ENG',datum:'27 jun',extra:[]},
    {id:'L6',fase:'Groepsfase',poule:'L',team1:'CRO',team2:'GHA',datum:'27 jun',extra:[]},
];

export const WK_KNOCKOUT_WEDSTRIJDEN = [
    { id:'R32-1',  fase:'Ronde van 32', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Ronde van 32'] },
    { id:'R32-2',  fase:'Ronde van 32', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Ronde van 32'] },
    { id:'R32-3',  fase:'Ronde van 32', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Ronde van 32'] },
    { id:'R32-4',  fase:'Ronde van 32', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Ronde van 32'] },
    { id:'R32-5',  fase:'Ronde van 32', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Ronde van 32'] },
    { id:'R32-6',  fase:'Ronde van 32', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Ronde van 32'] },
    { id:'R32-7',  fase:'Ronde van 32', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Ronde van 32'] },
    { id:'R32-8',  fase:'Ronde van 32', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Ronde van 32'] },
    { id:'R32-9',  fase:'Ronde van 32', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Ronde van 32'] },
    { id:'R32-10', fase:'Ronde van 32', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Ronde van 32'] },
    { id:'R32-11', fase:'Ronde van 32', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Ronde van 32'] },
    { id:'R32-12', fase:'Ronde van 32', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Ronde van 32'] },
    { id:'R32-13', fase:'Ronde van 32', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Ronde van 32'] },
    { id:'R32-14', fase:'Ronde van 32', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Ronde van 32'] },
    { id:'R32-15', fase:'Ronde van 32', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Ronde van 32'] },
    { id:'R32-16', fase:'Ronde van 32', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Ronde van 32'] },
    { id:'R16-1',  fase:'Achtste finale', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Achtste finale','Knock-out'] },
    { id:'R16-2',  fase:'Achtste finale', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Achtste finale','Knock-out'] },
    { id:'R16-3',  fase:'Achtste finale', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Achtste finale','Knock-out'] },
    { id:'R16-4',  fase:'Achtste finale', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Achtste finale','Knock-out'] },
    { id:'R16-5',  fase:'Achtste finale', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Achtste finale','Knock-out'] },
    { id:'R16-6',  fase:'Achtste finale', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Achtste finale','Knock-out'] },
    { id:'R16-7',  fase:'Achtste finale', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Achtste finale','Knock-out'] },
    { id:'R16-8',  fase:'Achtste finale', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Achtste finale','Knock-out'] },
    { id:'QF-1',   fase:'Kwartfinale', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Kwartfinale','Knock-out'] },
    { id:'QF-2',   fase:'Kwartfinale', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Kwartfinale','Knock-out'] },
    { id:'QF-3',   fase:'Kwartfinale', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Kwartfinale','Knock-out'] },
    { id:'QF-4',   fase:'Kwartfinale', team1:'TBD', team2:'TBD', datum:'', stad:'', extra:['Kwartfinale','Knock-out'] },
    { id:'SF-1',   fase:'Halve finale', team1:'TBD', team2:'TBD', datum:'19 jul 2026', stad:'New York/New Jersey', extra:['Halve finale','Knock-out','MetLife Stadium'] },
    { id:'SF-2',   fase:'Halve finale', team1:'TBD', team2:'TBD', datum:'22 jul 2026', stad:'Dallas', extra:['Halve finale','Knock-out','AT&T Stadium'] },
    { id:'3P',     fase:'3e/4e plaats', team1:'TBD', team2:'TBD', datum:'25 jul 2026', stad:'Miami', extra:['Troostfinale','Knock-out','Hard Rock Stadium'] },
    { id:'FIN',    fase:'Finale', team1:'TBD', team2:'TBD', datum:'19 jul 2026', stad:'New York/New Jersey', extra:['Finale','WK-eindstrijd','MetLife Stadium','Winnaar WK 2026'] },
];

// ─── i18n: Engelse vertalingen voor teamdata en datums ────────────────────
// EN_COUNTRY_NAMES: alleen waar NL en EN verschillen. Codes die ontbreken
// vallen terug op WK_TEAMS[code].naam (bv. "Mexico" is in beide talen gelijk).
export const EN_COUNTRY_NAMES = {
    USA: "United States",
    ARG: "Argentina",
    BRA: "Brazil",
    CHI: "Chile",
    NED: "Netherlands",
    BEL: "Belgium",
    FRA: "France",
    GER: "Germany",
    ESP: "Spain",
    ENG: "England",
    ITA: "Italy",
    CRO: "Croatia",
    DEN: "Denmark",
    SUI: "Switzerland",
    AUT: "Austria",
    POL: "Poland",
    SCO: "Scotland",
    TUR: "Türkiye",
    CZE: "Czechia",
    ROU: "Romania",
    SVK: "Slovakia",
    ALB: "Albania",
    SVN: "Slovenia",
    HUN: "Hungary",
    MAR: "Morocco",
    CMR: "Cameroon",
    CIV: "Ivory Coast",
    EGY: "Egypt",
    AUS: "Australia",
    KOR: "South Korea",
    SAU: "Saudi Arabia",
    NZL: "New Zealand",
    ZAF: "South Africa",
    BIH: "Bosnia and Herzegovina",
    HAI: "Haiti",
    CUW: "Curaçao",
    SWE: "Sweden",
    TUN: "Tunisia",
    CPV: "Cape Verde",
    IRQ: "Iraq",
    NOR: "Norway",
    JOR: "Jordan",
    ALG: "Algeria",
    COD: "DR Congo",
    UZB: "Uzbekistan",
};

// EN_WORD_MAP: woord-voor-woord vertaalmap voor bingo-termen.
// Spelersnamen, clubs en bijnamen zijn eigennamen → niet vertaald (zelfde in beide talen).
// Alleen begrippen, steden en specifieke nicknames die echt verschillen.
export const EN_WORD_MAP = {
    // Concepten
    "Gastheerland":           "Host country",
    "Wereldkampioen":          "World champion",
    "Oranjegekte":             "Orange fever",
    // Samengestelde extra-termen (hele-string-match; los vertaalde woorden volstaan niet)
    "Gastheerland Canada":      "Host country Canada",
    "Gastheerland VS":          "Host country USA",
    "Wereldkampioen Argentinië":"World champions Argentina",
    "Oranje op het WK":         "Oranje at the World Cup",
    "Oranje moet winnen":       "Oranje must win",
    // Knock-out-fases (als bingoterm via match.extra; los van EN_FASE_MAP voor schema-labels)
    "Ronde van 32":             "Round of 32",
    "Achtste finale":           "Round of 16",
    "Kwartfinale":              "Quarter-final",
    "Halve finale":             "Semi-final",
    "Troostfinale":             "Third-place play-off",
    "Finale":                   "Final",
    "WK-eindstrijd":            "World Cup final",
    "Winnaar WK 2026":          "World Cup 2026 winner",
    // Nicknames met NL bewoordingen
    "Rode Duivels":            "Red Devils",
    "Atlas Leeuwen":           "Atlas Lions",
    "Ontembare Leeuwen":       "Indomitable Lions",
    "Olifanten":               "Elephants",
    "Arenden van Carthago":    "Eagles of Carthage",
    "Leeuwen van Mesopotamië": "Lions of Mesopotamia",
    "Farao's":                 "Pharaohs",
    // Steden / hoofdsteden met NL-spelling
    "Mexico-Stad":             "Mexico City",
    "Praag":                   "Prague",
    "Boekarest":               "Bucharest",
    "Boedapest":               "Budapest",
    "Caïro":                   "Cairo",
    "Tasjkent":                "Tashkent",
    "Lissabon":                "Lisbon",
    "Londen":                  "London",
    "Parijs":                  "Paris",
    "Brussel":                 "Brussels",
    "Warschau":                "Warsaw",
    "Wenen":                   "Vienna",
    "Kopenhagen":              "Copenhagen",
    "Riad":                    "Riyadh",
    "Teheran":                 "Tehran",
    "Bagdad":                  "Baghdad",
    "Sparta Praag":            "Sparta Prague",
    "Legia Warschau":          "Legia Warsaw",
    // Algemene voetbal-termen (WK_VOETBAL_TERMEN in app.js)
    "Gele kaart":              "Yellow card",
    "Rode kaart":              "Red card",
    "Buitenspel":              "Offside",
    "Strafschop":              "Penalty",
    "VAR-check":               "VAR check",
    "Vrije trap":              "Free kick",
    "Voorzet":                 "Cross",
    "Schitterend schot":       "Stunning shot",
    "Keeper redt":             "Goalkeeper save",
    "Op en neer":              "End-to-end",
    "Wissel":                  "Substitution",
    "Afgekeurd":               "Disallowed",
    "Uittrap":                 "Goal kick",
    "Inworp":                  "Throw-in",
    "Fluitconcert":            "Boos",
    "Redding":                 "Save",
    "Eigen doelpunt":          "Own goal",
    "Paal":                    "Post",
    "laat":                    "late",
    "Naar de grond":           "Goes down",
    "In de muur":              "Off the wall",
    "Kopduel":                 "Header duel",
    "Schwalbe":                "Dive",
    "Zijlijn":                 "Sideline",
    "Pijnlijk":                "Painful",
    "Slotfase":                "Closing stages",
    "Eenrichtingsverkeer":     "One-way traffic",
    "Balverlies":              "Loss of possession",
    "Lange bal":               "Long ball",
    "buitenkant voet":         "outside of foot",
    "korte hoek":              "near post",
    "vuisten":                 "punches",
    "achterlijn":              "goal line",
    "kruising":                "top corner",
    "poule":                   "group",
    "debutant":                "debut",
    "verrassing":              "surprise",
    // 'Corner', 'Tackle', 'Counter', 'sliding', 'rebound', 'knockout' → zelfde in beide talen
};

// Vertaalt een enkel bingo-woord (gebruikt door getWordPool voor general pool / match.extra).
// Spelersnamen / clubs / bijnamen die geen entry hebben blijven ongewijzigd.
export function translateWord(word) {
    if (getLang() !== 'en') return word;
    return EN_WORD_MAP[word] || word;
}

// Helper: check of een woord een algemene voetbal-term is (NL óf EN-versie).
// Gebruikt door wkTermWeight om general pool minder zwaar te wegen.
export function isVoetbalTerm(word, voetbalTermenNL) {
    if (voetbalTermenNL.includes(word)) return true;
    // EN-versie: vergelijk tegen vertaalde versie van elke NL-term.
    return voetbalTermenNL.some(nl => (EN_WORD_MAP[nl] || nl) === word);
}

// ─── Helpers: taal-afhankelijke getters ───────────────────────────────────
export function teamName(code) {
    const t = WK_TEAMS[code];
    if (!t) return code;
    if (getLang() === 'en' && EN_COUNTRY_NAMES[code]) return EN_COUNTRY_NAMES[code];
    return t.naam;
}

export function teamWoorden(code) {
    const t = WK_TEAMS[code];
    if (!t) return [];
    if (getLang() !== 'en') return t.woorden;
    return t.woorden.map(w => EN_WORD_MAP[w] || w);
}

export function teamNickname(code) {
    const t = WK_TEAMS[code];
    if (!t) return '';
    if (getLang() !== 'en') return t.nickname;
    return EN_WORD_MAP[t.nickname] || t.nickname;
}

// ─── Datum-formatter: NL "11 jun" / "19 jul 2026" → EN "Jun 11" / "Jul 19, 2026"
const NL_TO_EN_MONTHS = {
    jan: 'Jan', feb: 'Feb', mrt: 'Mar', apr: 'Apr', mei: 'May', jun: 'Jun',
    jul: 'Jul', aug: 'Aug', sep: 'Sep', okt: 'Oct', nov: 'Nov', dec: 'Dec'
};

const EN_FASE_MAP = {
    'Groepsfase':     'Group stage',
    'Achtste finale': 'Round of 16',
    'Kwartfinale':    'Quarter-final',
    'Halve finale':   'Semi-final',
    'Finale':         'Final',
    '3e/4e plaats':   '3rd/4th place',
    'Ronde van 32':   'Round of 32',
};

export function matchFase(fase) {
    if (!fase) return '';
    if (getLang() !== 'en') return fase;
    return EN_FASE_MAP[fase] || fase;
}

export function formatMatchDate(datum) {
    if (!datum) return '';
    if (getLang() !== 'en') return datum;
    // Verwacht formaat: "DD mmm" of "DD mmm YYYY"
    const m = String(datum).trim().match(/^(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?$/);
    if (!m) return datum;  // onbekend formaat → laat ongewijzigd
    const day  = parseInt(m[1], 10);
    const enMo = NL_TO_EN_MONTHS[m[2].toLowerCase()] || m[2];
    const year = m[3];
    return year ? `${enMo} ${day}, ${year}` : `${enMo} ${day}`;
}
