// -----------------------------------------------------------------------------
// Language.
//
// The game was written in Croatian first, because that is where it happens, and
// that turned out to be the wrong default: most people who open it cannot read
// the radio. So English is the default now and Croatian is one of three, chosen
// in the settings panel.
//
// Everything the player can read goes through here. Static markup carries
// data-i18n / data-i18n-html attributes and is rewritten in place; anything
// generated in JavaScript asks for T('some.key'). Switching language mid-flight
// has to be seamless, so nothing caches a translated string — the HUD is redrawn
// every sixteenth of a second anyway, and the rest re-renders on the language
// change event.
// -----------------------------------------------------------------------------

const LANGS = ['en', 'hr', 'fr'];
const LANG_LABEL = { en: 'EN', hr: 'HR', fr: 'FR' };

const STRINGS = {

  // ── en ────────────────────────────────────────────────────────────────────
  en: {
    'lang.name': 'English',

    // loading
    'load.warm': 'warming the engines',
    'load.unpack': 'unpacking Šibenik',
    'load.karst': 'unrolling the karst',
    'load.cover': 'sorting pine from limestone',
    'load.town': 'reading the old town',
    'load.wind': 'the bura is the wrong wind for this',
    'load.sky': 'raising the sky',
    'load.cascade': 'lighting the cascade',
    'load.terrain': 'laying the karst',
    'load.sea': 'filling the Adriatic',
    'load.stone': 'setting the stone of St James',
    'load.city': 'raising the old town',
    'load.streets': 'laying the streets and pushing the boats out',
    'load.fuel': 'counting the fuel',
    'load.maquis': 'planting the maquis',
    'load.plane': 'rolling out the Canadair',
    'load.brief': 'briefing the other three',
    'load.engines': 'spooling the turboprops',
    'load.projector': 'threading the projector',
    'load.ready': 'four aircraft, one afternoon',
    'load.failed': 'failed: ',

    // title screen
    'veil.eyebrow': 'Šibenik · Dalmatia · 6 August 2024',
    'veil.sub': 'a Canadair over the Adriatic',
    'veil.blurb': 'A cluster bomblet left in the karst since the war has cooked '
      + 'off in the August heat. The hillside above <b>Jadrija</b> is alight and '
      + 'the <i>lebić</i> is pushing it at the old town. You are one of four.',
    'veil.enter': 'Take off',
    'veil.watch': 'Watch the intro',
    'veil.hint': 'mouse or arrows to fly &nbsp;·&nbsp; W/S throttle &nbsp;·&nbsp; '
      + 'SPACE scoops &nbsp;·&nbsp; F drops<br><b>Z</b> levels the wings '
      + '&nbsp;·&nbsp; <b>T</b> autopilot &nbsp;·&nbsp; <b>M</b> settings',
    'veil.hintTouch': 'drag anywhere on the left to fly &nbsp;·&nbsp; throttle on '
      + 'the right<br>SCOOP and DROP are <b>held</b>, not tapped',
    'veil.credit': 'terrain &amp; town derived from OpenStreetMap &amp; public elevation data',
    'veil.klapa': 'klapa at Donje Selo &copy; Draceane, CC BY-SA 4.0 — trimmed &amp; levelled &#8599;',
    'veil.src': 'source on GitHub &#8599;',

    // HUD
    'hud.elapsed': 'elapsed',
    'hud.score': 'score',
    'hud.fire': 'fire',
    'hud.city': 'Šibenik',
    'hud.kmh': 'km/h',
    'hud.agl': 'm agl',
    'hud.hdg': 'hdg',
    'hud.ms': 'm/s',
    'hud.litres': 'litres',
    'hud.compass': 'NESW',

    // the tank
    'tank.full': 'full — drop it',
    'tank.hold': 'hold SPACE',
    'tank.holdTouch': 'hold SCOOP',
    'tank.prompt': 'SPACE to scoop',
    'tank.promptTouch': 'SCOOP to fill',

    // why the probes will not bite
    'scoop.full': 'tank full',
    'scoop.notWater': 'not over water',
    'scoop.tooHigh': 'too high',
    'scoop.tooSlow': 'too slow',
    'scoop.tooFast': 'too fast',
    'scoop.bank': 'wings level',
    'scoop.noRun': 'no run ahead',

    // warnings
    'warn.stall': 'stall',
    'warn.vne': 'overspeed',
    'warn.pullUp': 'pull up',
    'warn.sink': 'sink rate',
    'warn.terrain': 'terrain',
    'warn.tankFull': 'tank full',

    // autopilot
    'ap.label': 'autopilot',
    'ap.levelling': 'levelling',
    'ap.engaged': 'autopilot engaged',
    'ap.off': 'autopilot off',
    'ap.toFire': 'to the fire',
    'ap.overFire': 'over the fire — press F',
    'ap.overFireTouch': 'over the fire — DROP',
    'ap.onWater': 'on the water — hold SPACE',
    'ap.onWaterTouch': 'on the water — hold SCOOP',
    'ap.approach': 'on the approach',
    'ap.lining': 'lining up on the water',

    // the other three
    'wing.toWater': 'to water',
    'wing.scoop': 'scooping',
    'wing.toFire': 'to fire',
    'wing.drop': 'dropping',

    // callsigns
    'call.1': 'WING 1',
    'call.2': 'WING 2',
    'call.3': 'WING 3',
    'call.4': 'WING 4',
    'call.lookout': 'LOOKOUT',
    'call.rokici': 'ROKIĆI',

    // radio
    'radio.start': 'The bomblet went off above Jadrija. Let\'s go.',
    'radio.scooping': 'taking on water.',
    'radio.dropping': 'dropping!',
    'radio.spot': 'A spark has jumped the channel — it\'s alight by the town!',
    'toast.spot': 'spot fire near the old town',

    // the airfield, and the ground rescue
    'radio.rokiciSpot': 'Embers coming down on us here. We have no crew and no pump.',
    'radio.rokiciBurning': 'It\'s on the apron. We have people alight — anyone, please.',
    'radio.crewAlight': 'He\'s burning! Somebody get him down!',
    'radio.crewSafe': 'He\'s out. He\'s out. Thank you.',
    'radio.crewLost': 'We\'ve lost him. God.',
    'toast.rokici': 'Rokići taking embers',
    'toast.crewSafe': 'crew member out',
    'toast.onFoot': 'on foot — hold the branch open',
    'toast.cheat': 'skipped to Rokići — the aeroplane is behind you',
    'toast.cheatJad': 'skipped to Jadrija — she is up the promenade, and the aeroplane is gone',
    'toast.eject': 'out — wait for the canopy',
    'toast.ejectLow': 'out, and far too low for it',
    'toast.ejectNo': 'not from here — you have to be flying',
    'toast.planeGone': 'she went in',
    'toast.walkedAway': 'down, and on your feet — the fire is that way',
    'chute.agl': 'm below',
    'chute.vs': 'm/s down',
    'chute.wait': 'wait for it',
    'chute.steer': '← → turn · ↑ dive for distance · ↓ hold off',
    'chute.water': 'water below — turn for land if you can',
    'chute.stalled': 'canopy stalled — let go',
    'toast.boarded': 'back aboard',

    'ground.alight': 'alight',
    'ground.crew': 'crew burning',
    'ground.saved': 'brought out',
    'ground.reserve': '{n} l left in the aircraft',
    'ground.filling': 'filling from the aircraft',
    'ground.dry': 'pump dry — walk back to the aircraft',
    'ground.dryTouch': 'pump dry — go back to the aircraft',
    'ground.empty': 'the aircraft is dry too',
    'ground.board': 'E to climb back in',
    'ground.boardTouch': 'IN to climb back in',
    'ground.disembark': '<b>E</b> to get out and fight it on foot',
    'ground.disembarkTouch': '<b>OUT</b> to fight it on foot',

    // end screen
    'over.crashed': 'You went in.',
    'over.won': 'The fire is out.',
    'over.lost': 'The city is burning.',
    'over.crashedSub': 'The Adriatic is not a runway. The fire is still burning.',
    'over.crashedLand': 'Twelve tonnes into the karst. The fire is still burning.',
    'over.wonSub': 'The last of it is out. Šibenik is still standing, and the stone '
      + 'of St James never felt the heat.',
    'over.lostSub': 'It got into the old town. Eight hundred years of it, and it '
      + 'went in an afternoon.',
    'over.chute': 'Down under silk.',
    'over.chuteSub': 'You walked away from it. Six tonnes of water and a '
      + 'serviceable aeroplane did not, and the fire is still burning.',
    'over.chuteSea': 'Fished out of the channel.',
    'over.chuteSeaSub': 'Out of the water inside ten minutes — the lookout had '
      + 'your position before you hit it. The aeroplane is gone and the fire is '
      + 'still burning.',
    'over.chuteHard': 'Too low for it.',
    'over.chuteHardSub': 'The canopy never finished opening. That key needs '
      + 'height, and in a dive it needs rather a lot of it.',
    'over.time': 'time',
    'over.dropped': 'dropped',
    'over.onTarget': 'on target',
    'over.burnt': 'burnt',
    'over.intact': 'city intact',
    'over.rescued': 'crew brought out',
    'over.apron': 'apron saved',
    'over.score': 'score',
    'over.again': 'Fly again',

    // settings
    'set.title': 'settings',
    'set.lang': 'language',
    'set.sens': 'mouse sensitivity',
    'set.assist': 'stability assist',
    'set.trees': 'vegetation',
    'set.props': 'traffic and boats',
    'set.birds': 'birds',
    'set.fov': 'field of view',
    'set.exposure': 'exposure',
    'set.volume': 'volume',
    'set.off': 'off',
    'set.foot': 'M closes · Z levels · T autopilot · P pauses · 0 skips to Rokići · 9 to Jadrija',
    'set.footGround': 'M closes · WASD walks · arrows turn · SHIFT runs · SPACE opens the branch · E climbs back in',
    'set.footTouch': 'tap SET to close',

    // pause
    'pause.eyebrow': 'the fire is waiting',
    'pause.title': 'Paused',
    'pause.alight': 'alight',
    'pause.resume': 'Resume',
    'pause.hint': '<kbd>P</kbd> or <kbd>Esc</kbd> to go back',
    'pause.hintTouch': 'tap anywhere to go back',

    // touch controls
    'touch.jet': 'WATER',
    'touch.run': 'RUN',
    'touch.in': 'IN',
    'touch.out': 'OUT',
    'touch.scoop': 'SCOOP',
    'touch.drop': 'DROP',
    'touch.thr': 'thr',
    'touch.ap': 'AP',
    'touch.lvl': 'LVL',
    'touch.cam': 'CAM',
    'touch.set': 'SET',
    'touch.pause': 'II',
    'touch.rotate': 'Turn your device sideways.',
    'touch.rotateSub': 'This one wants a horizon.',

    // the cinematic
    'cine.skip': 'skip &rsaquo;&rsaquo;',
    'cine.war': 'Dalmatia. The war years.<br><em>Šibenik is shelled for three of them.</em>',
    'cine.orkan': 'Cluster shells open above the hills behind the town and let go '
      + 'of <em>288 bomblets</em> at a time.',
    'cine.jingle': 'In Croatia they are called <em>zvončići</em> — little bells — '
      + 'for the sound they made coming down.',
    'cine.duds': 'Croatia has been clearing them ever since.<br>'
      + '<em>About one in twenty never went off.</em>',
    'cine.summers': 'They stayed where they fell.<br>'
      + '<em>Thirty summers of thyme and rockrose grew over them.</em>',
    'cine.today': '6 August 2024, ten to one in the afternoon. The pine wood at '
      + 'Rokići catches, above the coast road.',
    'cine.ignition': 'It has been lying in the sun since before you were born.',
    'cine.ordnance': 'Twenty minutes later the hillside starts going off.<br>'
      + '<em>The crews cannot get in under it.</em>',
    'cine.launch': 'Which leaves the air.<br>Four Canadairs, one afternoon.<br>'
      + '<em>Be faster than it.</em>',
  },

  // ── hr ────────────────────────────────────────────────────────────────────
  hr: {
    'lang.name': 'Hrvatski',

    'load.warm': 'grijem motore',
    'load.unpack': 'raspakiravam Šibenik',
    'load.karst': 'razmotavam krš',
    'load.cover': 'razdvajam bor od vapnenca',
    'load.town': 'čitam stari grad',
    'load.wind': 'bura je krivi vjetar za ovo',
    'load.sky': 'dižem nebo',
    'load.cascade': 'palim sjene',
    'load.terrain': 'polažem krš',
    'load.sea': 'punim Jadran',
    'load.stone': 'slažem kamen svetog Jakova',
    'load.city': 'dižem stari grad',
    'load.streets': 'polažem ulice i porinjavam brodice',
    'load.fuel': 'brojim gorivi materijal',
    'load.maquis': 'sadim makiju',
    'load.plane': 'izvlačim Canadair',
    'load.brief': 'brifiram ostalu trojicu',
    'load.engines': 'pokrećem turboelise',
    'load.projector': 'namještam projektor',
    'load.ready': 'četiri zrakoplova, jedno popodne',
    'load.failed': 'greška: ',

    'veil.eyebrow': 'Šibenik · Dalmacija · 6. kolovoza 2024.',
    'veil.sub': 'Canadair iznad Jadrana',
    'veil.blurb': 'Kasetna bombica koja od rata leži u kršu eksplodirala je na '
      + 'kolovoškoj vrućini. Brdo iznad <b>Jadrije</b> gori, a <i>lebić</i> ga '
      + 'gura prema starom gradu. Ti si jedan od četvorice.',
    'veil.enter': 'Polijetanje',
    'veil.watch': 'Pogledaj uvod',
    'veil.hint': 'miš ili strelice za let &nbsp;·&nbsp; W/S gas &nbsp;·&nbsp; '
      + 'SPACE zahvaća &nbsp;·&nbsp; F izbacuje<br><b>Z</b> poravnava krila '
      + '&nbsp;·&nbsp; <b>T</b> autopilot &nbsp;·&nbsp; <b>M</b> postavke',
    'veil.hintTouch': 'povuci bilo gdje lijevo za let &nbsp;·&nbsp; gas je desno<br>'
      + 'ZAHVAT i IZBACI se <b>drže</b>, ne tapkaju',
    'veil.credit': 'teren i grad izvedeni iz OpenStreetMapa i javnih podataka o visinama',
    'veil.klapa': 'klapa u Donjem Selu &copy; Draceane, CC BY-SA 4.0 — skraćeno i ujednačeno &#8599;',
    'veil.src': 'izvorni kod na GitHubu &#8599;',

    'hud.elapsed': 'proteklo',
    'hud.score': 'bodovi',
    'hud.fire': 'požar',
    'hud.city': 'Šibenik',
    'hud.kmh': 'km/h',
    'hud.agl': 'm iznad tla',
    'hud.hdg': 'kurs',
    'hud.ms': 'm/s',
    'hud.litres': 'litara',
    'hud.compass': 'SIJZ',

    'tank.full': 'puno — izbaci',
    'tank.hold': 'drži SPACE',
    'tank.holdTouch': 'drži ZAHVAT',
    'tank.prompt': 'SPACE zahvaća',
    'tank.promptTouch': 'ZAHVAT puni',

    'scoop.full': 'spremnik pun',
    'scoop.notWater': 'nisi iznad vode',
    'scoop.tooHigh': 'previsoko',
    'scoop.tooSlow': 'presporo',
    'scoop.tooFast': 'prebrzo',
    'scoop.bank': 'poravnaj krila',
    'scoop.noRun': 'nema slobodne staze',

    'warn.stall': 'slom uzgona',
    'warn.vne': 'prekoračena brzina',
    'warn.pullUp': 'diži se',
    'warn.sink': 'brzina propadanja',
    'warn.terrain': 'teren',
    'warn.tankFull': 'spremnik pun',

    'ap.label': 'autopilot',
    'ap.levelling': 'poravnavam',
    'ap.engaged': 'autopilot uključen',
    'ap.off': 'autopilot isključen',
    'ap.toFire': 'prema požaru',
    'ap.overFire': 'iznad požara — pritisni F',
    'ap.overFireTouch': 'iznad požara — IZBACI',
    'ap.onWater': 'na vodi — drži SPACE',
    'ap.onWaterTouch': 'na vodi — drži ZAHVAT',
    'ap.approach': 'na prilazu',
    'ap.lining': 'poravnavam se na vodu',

    'wing.toWater': 'na vodu',
    'wing.scoop': 'zahvaća',
    'wing.toFire': 'na požar',
    'wing.drop': 'izbacuje',

    'call.1': 'KRILO 1',
    'call.2': 'KRILO 2',
    'call.3': 'KRILO 3',
    'call.4': 'KRILO 4',
    'call.lookout': 'OSMATRAČ',
    'call.rokici': 'ROKIĆI',

    'radio.start': 'Bomba je puknula iznad Jadrije. Idemo.',
    'radio.scooping': 'zahvaćam vodu.',
    'radio.dropping': 'izbacujem!',
    'radio.spot': 'Iskra je preskočila kanal — gori kod grada!',
    'toast.spot': 'novo žarište kraj starog grada',

    'radio.rokiciSpot': 'Padaju nam žeravice. Nemamo posade ni pumpe.',
    'radio.rokiciBurning': 'Gori na platformi. Ljudi gore — bilo tko, molim vas.',
    'radio.crewAlight': 'Gori! Netko neka ga obori!',
    'radio.crewSafe': 'Ugašen je. Ugašen je. Hvala vam.',
    'radio.crewLost': 'Izgubili smo ga. Bože.',
    'toast.rokici': 'na Rokiće padaju žeravice',
    'toast.crewSafe': 'čovjek je ugašen',
    'toast.onFoot': 'pješice — drži mlaznicu otvorenu',
    'toast.cheat': 'skok na Rokiće — avion ti je iza leđa',
    'toast.cheatJad': 'skok na Jadriju — ona je gore uz rivu, a aviona više nema',
    'toast.eject': 'vani si — čekaj kupolu',
    'toast.ejectLow': 'vani si, i daleko prenisko za to',
    'toast.ejectNo': 'ne odavde — moraš biti u zraku',
    'toast.planeGone': 'pala je',
    'toast.walkedAway': 'dolje si, i na nogama — požar je onamo',
    'chute.agl': 'm ispod',
    'chute.vs': 'm/s dolje',
    'chute.wait': 'čekaj',
    'chute.steer': '← → skreni · ↑ obruši za daljinu · ↓ koči',
    'chute.water': 'more ispod — skreni prema kopnu',
    'chute.stalled': 'kupola je u slomu — pusti',
    'toast.boarded': 'natrag u avionu',

    'ground.alight': 'gori',
    'ground.crew': 'ljudi gore',
    'ground.saved': 'izvučeno',
    'ground.reserve': 'još {n} l u avionu',
    'ground.filling': 'punim iz aviona',
    'ground.dry': 'pumpa je prazna — vrati se do aviona',
    'ground.dryTouch': 'pumpa je prazna — vrati se do aviona',
    'ground.empty': 'i avion je prazan',
    'ground.board': 'E za povratak u avion',
    'ground.boardTouch': 'U za povratak u avion',
    'ground.disembark': '<b>E</b> za izlazak i gašenje pješice',
    'ground.disembarkTouch': '<b>VAN</b> za gašenje pješice',

    'over.crashed': 'Pao si.',
    'over.won': 'Vatra je ugašena.',
    'over.lost': 'Grad gori.',
    'over.crashedSub': 'Jadran nije pista. Požar i dalje gori.',
    'over.crashedLand': 'Dvanaest tona u kršu. Požar i dalje gori.',
    'over.wonSub': 'Ugasio si i posljednje. Šibenik još stoji, a kamen svetog '
      + 'Jakova nije osjetio vrućinu.',
    'over.lostSub': 'Ušlo je u stari grad. Osamsto godina, i nestalo je u jedno popodne.',
    'over.chute': 'Spustio si se na svili.',
    'over.chuteSub': 'Ti si prošao. Šest tona vode i ispravan avion nisu, a požar '
      + 'i dalje gori.',
    'over.chuteSea': 'Izvučen iz kanala.',
    'over.chuteSeaSub': 'Iz vode za manje od deset minuta — motritelj je imao '
      + 'tvoju poziciju prije nego si pao. Aviona nema, a požar i dalje gori.',
    'over.chuteHard': 'Prenisko za to.',
    'over.chuteHardSub': 'Kupola se nije stigla otvoriti. Toj tipki treba visina, '
      + 'a u obrušavanju treba je poprilično.',
    'over.time': 'vrijeme',
    'over.dropped': 'izbačeno',
    'over.onTarget': 'na cilju',
    'over.burnt': 'izgorjelo',
    'over.intact': 'grad očuvan',
    'over.rescued': 'izvučeno ljudi',
    'over.apron': 'spašeno na platformi',
    'over.score': 'bodovi',
    'over.again': 'Leti opet',

    'set.title': 'postavke',
    'set.lang': 'jezik',
    'set.sens': 'osjetljivost miša',
    'set.assist': 'pomoć pri stabilizaciji',
    'set.trees': 'raslinje',
    'set.props': 'promet i brodice',
    'set.birds': 'ptice',
    'set.fov': 'vidno polje',
    'set.exposure': 'ekspozicija',
    'set.volume': 'glasnoća',
    'set.off': 'isključeno',
    'set.foot': 'M zatvara · Z poravnava · T autopilot · P pauza · 0 skok na Rokiće · 9 na Jadriju',
    'set.footGround': 'M zatvara · WASD hod · strelice okret · SHIFT trk · RAZMAK mlaz · E natrag u avion',
    'set.footTouch': 'dodirni POST za zatvaranje',

    'pause.eyebrow': 'vatra čeka',
    'pause.title': 'Pauza',
    'pause.alight': 'gori',
    'pause.resume': 'Nastavi',
    'pause.hint': '<kbd>P</kbd> ili <kbd>Esc</kbd> za povratak',
    'pause.hintTouch': 'dodirni bilo gdje za povratak',

    'touch.jet': 'VODA',
    'touch.run': 'TRČI',
    'touch.in': 'U AVION',
    'touch.out': 'VAN',
    'touch.scoop': 'ZAHVAT',
    'touch.drop': 'IZBACI',
    'touch.thr': 'gas',
    'touch.ap': 'AP',
    'touch.lvl': 'RAV',
    'touch.cam': 'KAM',
    'touch.set': 'POST',
    'touch.pause': 'II',
    'touch.rotate': 'Okreni uređaj vodoravno.',
    'touch.rotateSub': 'Ovome treba horizont.',

    'cine.skip': 'preskoči &rsaquo;&rsaquo;',
    'cine.war': 'Dalmacija. Ratne godine.<br><em>Šibenik je granatiran tri godine.</em>',
    'cine.orkan': 'Kasetne granate otvaraju se iznad brda iza grada i ispuštaju '
      + 'po <em>288 bombica</em> odjednom.',
    'cine.jingle': 'U Hrvatskoj ih zovu <em>zvončići</em>, po zvuku koji su '
      + 'proizvodili dok su padali.',
    'cine.duds': 'Hrvatska ih razminirava od tada.<br>'
      + '<em>Otprilike svaka dvadeseta nikad nije eksplodirala.</em>',
    'cine.summers': 'Ostale su ležati ondje gdje su pale.<br>'
      + '<em>Trideset ljeta majčine dušice i bušina naraslo je preko njih.</em>',
    'cine.today': '6. kolovoza 2024., deset do jedan popodne. Borova šuma na '
      + 'Rokićima, iznad magistrale, hvata vatru.',
    'cine.ignition': 'Leži na suncu otkad se ti nisi ni rodio.',
    'cine.ordnance': 'Dvadesetak minuta poslije brdo počinje odlijetati u zrak.<br>'
      + '<em>Ekipe ne mogu pod njega.</em>',
    'cine.launch': 'Ostaje zrak.<br>Četiri kanadera, jedno popodne.<br>'
      + '<em>Budi brži od nje.</em>',
  },

  // ── fr ────────────────────────────────────────────────────────────────────
  fr: {
    'lang.name': 'Français',

    'load.warm': 'mise en chauffe des moteurs',
    'load.unpack': 'déballage de Šibenik',
    'load.karst': 'déroulement du karst',
    'load.cover': 'tri du pin et du calcaire',
    'load.town': 'lecture de la vieille ville',
    'load.wind': 'la bura est le mauvais vent pour ça',
    'load.sky': 'levée du ciel',
    'load.cascade': 'allumage des ombres',
    'load.terrain': 'pose du karst',
    'load.sea': 'remplissage de l\'Adriatique',
    'load.stone': 'pose de la pierre de Saint-Jacques',
    'load.city': 'levée de la vieille ville',
    'load.streets': 'tracé des rues et mise à l’eau des barques',
    'load.fuel': 'comptage du combustible',
    'load.maquis': 'plantation du maquis',
    'load.plane': 'sortie du Canadair',
    'load.brief': 'briefing des trois autres',
    'load.engines': 'lancement des turbopropulseurs',
    'load.projector': 'chargement du projecteur',
    'load.ready': 'quatre avions, un après-midi',
    'load.failed': 'échec : ',

    'veil.eyebrow': 'Šibenik · Dalmatie · 6 août 2024',
    'veil.sub': 'un Canadair au-dessus de l\'Adriatique',
    'veil.blurb': 'Une sous-munition oubliée dans le karst depuis la guerre a '
      + 'explosé sous la chaleur d\'août. La colline au-dessus de <b>Jadrija</b> '
      + 'brûle, et le <i>lebić</i> la pousse vers la vieille ville. Vous êtes '
      + 'l\'un des quatre.',
    'veil.enter': 'Décollage',
    'veil.watch': 'Voir l\'intro',
    'veil.hint': 'souris ou flèches pour voler &nbsp;·&nbsp; W/S gaz &nbsp;·&nbsp; '
      + 'ESPACE écope &nbsp;·&nbsp; F largue<br><b>Z</b> remet les ailes à plat '
      + '&nbsp;·&nbsp; <b>T</b> pilote auto &nbsp;·&nbsp; <b>M</b> réglages',
    'veil.hintTouch': 'glissez à gauche pour voler &nbsp;·&nbsp; gaz à droite<br>'
      + 'ÉCOPER et LARGUER se <b>maintiennent</b> enfoncés',
    'veil.credit': 'relief et ville dérivés d\'OpenStreetMap et de données altimétriques publiques',
    'veil.klapa': 'klapa à Donje Selo &copy; Draceane, CC BY-SA 4.0 — coupée et égalisée &#8599;',
    'veil.src': 'code source sur GitHub &#8599;',

    'hud.elapsed': 'écoulé',
    'hud.score': 'score',
    'hud.fire': 'feu',
    'hud.city': 'Šibenik',
    'hud.kmh': 'km/h',
    'hud.agl': 'm sol',
    'hud.hdg': 'cap',
    'hud.ms': 'm/s',
    'hud.litres': 'litres',
    'hud.compass': 'NESO',

    'tank.full': 'plein — larguez',
    'tank.hold': 'maintenez ESPACE',
    'tank.holdTouch': 'maintenez ÉCOPER',
    'tank.prompt': 'ESPACE pour écoper',
    'tank.promptTouch': 'ÉCOPER pour remplir',

    'scoop.full': 'réservoir plein',
    'scoop.notWater': 'pas au-dessus de l\'eau',
    'scoop.tooHigh': 'trop haut',
    'scoop.tooSlow': 'trop lent',
    'scoop.tooFast': 'trop rapide',
    'scoop.bank': 'ailes à plat',
    'scoop.noRun': 'pas de plan d\'eau devant',

    'warn.stall': 'décrochage',
    'warn.vne': 'survitesse',
    'warn.pullUp': 'remontez',
    'warn.sink': 'taux de chute',
    'warn.terrain': 'relief',
    'warn.tankFull': 'réservoir plein',

    'ap.label': 'pilote auto',
    'ap.levelling': 'mise à plat',
    'ap.engaged': 'pilote auto engagé',
    'ap.off': 'pilote auto coupé',
    'ap.toFire': 'vers le feu',
    'ap.overFire': 'au-dessus du feu — appuyez sur F',
    'ap.overFireTouch': 'au-dessus du feu — LARGUER',
    'ap.onWater': 'sur l\'eau — maintenez ESPACE',
    'ap.onWaterTouch': 'sur l\'eau — maintenez ÉCOPER',
    'ap.approach': 'en approche',
    'ap.lining': 'alignement sur l\'eau',

    'wing.toWater': 'vers l\'eau',
    'wing.scoop': 'écope',
    'wing.toFire': 'vers le feu',
    'wing.drop': 'largue',

    'call.1': 'AILE 1',
    'call.2': 'AILE 2',
    'call.3': 'AILE 3',
    'call.4': 'AILE 4',
    'call.lookout': 'GUETTEUR',
    'call.rokici': 'ROKIĆI',

    'radio.start': 'La bombette a sauté au-dessus de Jadrija. On y va.',
    'radio.scooping': 'je fais le plein.',
    'radio.dropping': 'je largue !',
    'radio.spot': 'Une braise a franchi le chenal — ça brûle près de la ville !',
    'toast.spot': 'départ de feu près de la vieille ville',

    'radio.rokiciSpot': 'Des braises nous tombent dessus. Ni équipe ni pompe ici.',
    'radio.rokiciBurning': 'Ça brûle sur l\'aire. Des hommes ont pris feu — n\'importe qui, pitié.',
    'radio.crewAlight': 'Il brûle ! Que quelqu\'un le mette à terre !',
    'radio.crewSafe': 'Il est éteint. Il est éteint. Merci.',
    'radio.crewLost': 'On l\'a perdu. Mon Dieu.',
    'toast.rokici': 'des braises tombent sur Rokići',
    'toast.crewSafe': 'un homme éteint',
    'toast.onFoot': 'à pied — garde la lance ouverte',
    'toast.cheat': 'raccourci vers Rokići — l\'avion est derrière vous',
    'toast.cheatJad': 'raccourci vers Jadrija — elle est plus haut sur la promenade, et l\'avion n\'est plus là',
    'toast.eject': 'dehors — attends la voile',
    'toast.ejectLow': 'dehors, et bien trop bas pour ça',
    'toast.ejectNo': 'pas d\'ici — il faut être en vol',
    'toast.planeGone': 'elle est tombée',
    'toast.walkedAway': 'au sol, et debout — le feu est par là',
    'chute.agl': 'm dessous',
    'chute.vs': 'm/s de chute',
    'chute.wait': 'attends',
    'chute.steer': '← → vire · ↑ pique pour aller loin · ↓ retiens',
    'chute.water': 'de l\'eau dessous — vire vers la terre',
    'chute.stalled': 'voile décrochée — relâche',
    'toast.boarded': 'de retour à bord',

    'ground.alight': 'en feu',
    'ground.crew': 'hommes en feu',
    'ground.saved': 'sortis',
    'ground.reserve': 'encore {n} l dans l\'avion',
    'ground.filling': 'remplissage depuis l\'avion',
    'ground.dry': 'pompe à sec — retourne à l\'avion',
    'ground.dryTouch': 'pompe à sec — retourne à l\'avion',
    'ground.empty': 'l\'avion aussi est à sec',
    'ground.board': 'E pour remonter à bord',
    'ground.boardTouch': 'BORD pour remonter',
    'ground.disembark': '<b>E</b> pour descendre et lutter à pied',
    'ground.disembarkTouch': '<b>PIED</b> pour lutter à pied',

    'over.crashed': 'Vous êtes tombé.',
    'over.won': 'Le feu est éteint.',
    'over.lost': 'La ville brûle.',
    'over.crashedSub': 'L\'Adriatique n\'est pas une piste. Le feu brûle toujours.',
    'over.crashedLand': 'Douze tonnes dans le karst. Le feu brûle toujours.',
    'over.wonSub': 'Le dernier foyer est noyé. Šibenik tient toujours debout, et '
      + 'la pierre de Saint-Jacques n\'a jamais senti la chaleur.',
    'over.lostSub': 'Le feu est entré dans la vieille ville. Huit cents ans, '
      + 'partis en un après-midi.',
    'over.chute': 'Posé sous la voile.',
    'over.chuteSub': 'Vous êtes indemne. Six tonnes d\'eau et un avion en état de '
      + 'vol ne le sont pas, et le feu brûle toujours.',
    'over.chuteSea': 'Repêché dans le chenal.',
    'over.chuteSeaSub': 'Sorti de l\'eau en moins de dix minutes — le guetteur avait '
      + 'votre position avant que vous ne touchiez. L\'avion est perdu et le feu '
      + 'brûle toujours.',
    'over.chuteHard': 'Trop bas pour ça.',
    'over.chuteHardSub': 'La voile n\'a pas fini de s\'ouvrir. Cette touche demande '
      + 'de la hauteur, et en piqué elle en demande beaucoup.',
    'over.time': 'temps',
    'over.dropped': 'largué',
    'over.onTarget': 'au but',
    'over.burnt': 'brûlé',
    'over.intact': 'ville intacte',
    'over.rescued': 'hommes sortis',
    'over.apron': 'aire sauvée',
    'over.score': 'score',
    'over.again': 'Revoler',

    'set.title': 'réglages',
    'set.lang': 'langue',
    'set.sens': 'sensibilité souris',
    'set.assist': 'aide au pilotage',
    'set.trees': 'végétation',
    'set.props': 'circulation et bateaux',
    'set.birds': 'oiseaux',
    'set.fov': 'champ de vision',
    'set.exposure': 'exposition',
    'set.volume': 'volume',
    'set.off': 'désactivée',
    'set.foot': 'M ferme · Z met à plat · T pilote auto · P pause · 0 saut vers Rokići · 9 vers Jadrija',
    'set.footGround': 'M ferme · WASD marche · flèches tournent · MAJ course · ESPACE ouvre la lance · E remonte à bord',
    'set.footTouch': 'touchez RÉGL pour fermer',

    'pause.eyebrow': 'le feu attend',
    'pause.title': 'En pause',
    'pause.alight': 'en feu',
    'pause.resume': 'Reprendre',
    'pause.hint': '<kbd>P</kbd> ou <kbd>Échap</kbd> pour revenir',
    'pause.hintTouch': 'touchez n’importe où pour revenir',

    'touch.jet': 'EAU',
    'touch.run': 'COURIR',
    'touch.in': 'BORD',
    'touch.out': 'PIED',
    'touch.scoop': 'ÉCOPER',
    'touch.drop': 'LARGUER',
    'touch.thr': 'gaz',
    'touch.ap': 'PA',
    'touch.lvl': 'PLAT',
    'touch.cam': 'CAM',
    'touch.set': 'RÉGL',
    'touch.pause': 'II',
    'touch.rotate': 'Tournez votre appareil.',
    'touch.rotateSub': 'Celui-ci veut un horizon.',

    'cine.skip': 'passer &rsaquo;&rsaquo;',
    'cine.war': 'La Dalmatie. Les années de guerre.<br>'
      + '<em>Šibenik est bombardée pendant trois d\'entre elles.</em>',
    'cine.orkan': 'Des obus à sous-munitions s\'ouvrent au-dessus des collines '
      + 'derrière la ville et lâchent <em>288 bombettes</em> à la fois.',
    'cine.jingle': 'En Croatie on les appelle <em>zvončići</em> — petites '
      + 'clochettes — pour le bruit qu\'elles faisaient en tombant.',
    'cine.duds': 'La Croatie les démine depuis.<br>'
      + '<em>Environ une sur vingt n\'a jamais explosé.</em>',
    'cine.summers': 'Elles sont restées là où elles étaient tombées.<br>'
      + '<em>Trente étés de thym et de ciste ont poussé par-dessus.</em>',
    'cine.today': '6 août 2024, une heure moins dix. La pinède de Rokići, '
      + 'au-dessus de la route côtière, prend feu.',
    'cine.ignition': 'Elle est là, au soleil, depuis avant votre naissance.',
    'cine.ordnance': 'Vingt minutes plus tard, la colline se met à sauter.<br>'
      + '<em>Les équipes ne peuvent pas passer dessous.</em>',
    'cine.launch': 'Restent les airs.<br>Quatre Canadairs, un après-midi.<br>'
      + '<em>Soyez plus rapide que lui.</em>',
  },
};

/** The language actually in force. English unless asked otherwise. */
let LANG = 'en';

/**
 * Pick a starting language: whatever was chosen last time, else the browser's
 * preference if we speak it, else English. Deliberately *not* a hard match on
 * navigator.language — "hr-BA" and "fr-CA" want Croatian and French too.
 */
(function initLang() {
  let saved = null;
  try { saved = localStorage.getItem('fr.lang'); } catch (e) { /* private mode */ }
  if (saved && LANGS.includes(saved)) { LANG = saved; return; }
  for (const tag of (navigator.languages || [navigator.language || ''])) {
    const two = String(tag).slice(0, 2).toLowerCase();
    if (LANGS.includes(two)) { LANG = two; return; }
  }
})();

/** Translate. Falls back through English to the key itself, so a missing
    string shows up as a visible key rather than as an empty box. */
function T(key) {
  const l = STRINGS[LANG];
  if (l && l[key] != null) return l[key];
  const e = STRINGS.en;
  return (e && e[key] != null) ? e[key] : key;
}

/** Whichever of two keys suits the input device — the prompts have to name a
    key on a keyboard and a button on a phone, and they are not the same word. */
const TK = (key, touchKey) => T(IS_TOUCH ? touchKey : key);

const langListeners = [];
/** Register something that has to be redrawn when the language changes. */
function onLangChange(fn) { langListeners.push(fn); }

/** Rewrite every marked-up node in the document. */
function applyLang() {
  document.documentElement.lang = LANG;
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = T(el.getAttribute('data-i18n'));
  }
  for (const el of document.querySelectorAll('[data-i18n-html]')) {
    el.innerHTML = T(el.getAttribute('data-i18n-html'));
  }
  for (const fn of langListeners) {
    try { fn(LANG); } catch (e) { console.error(e); }
  }
}

function setLang(l) {
  if (!LANGS.includes(l) || l === LANG) return;
  LANG = l;
  try { localStorage.setItem('fr.lang', l); } catch (e) { /* private mode */ }
  applyLang();
}

const getLang = () => LANG;
