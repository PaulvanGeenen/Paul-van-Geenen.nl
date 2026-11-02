import { Book, EchoChapter } from '../types';
import koesterWeg from '../assets/images/boek1.jpg';
import koester21 from '../assets/images/book2.jpg';
import deEcho from '../assets/images/book3.jpg';
import deBestemming from '../assets/images/book4.jpg';
import homeImg from '../assets/images/home.jpg';
import page9Img from '../assets/images/hoofdstuk9.jpg';

export const BOOKS: Book[] = [
  {
    id: '1',
    slug: 'koester-het-leven-de-weg-ernaartoe',
    title: 'Koester het Leven: de weg ernaartoe',
    subtitle: 'Het begin van een reis',
    order: 1,
    teaser: 'Waarom ik begon met schrijven. De ontstaansgeschiedenis, de tumor en Angelica’s boekje.',
    
    description: [
      "Wat doe je als er in de stilte van je vertrouwde leven plotseling iets ontwaakt dat onophoudelijk tegen je begint te fluisteren?",
      "Voor de buitenwereld en mijn gezin leek alles normaal. Maar achter die façade droeg ik bijna een jaar een loodzwaar en verstikkend geheim met me mee. Om iedereen te beschermen tegen mijn donkerste nachtmerries, besloot ik de strijd met deze onzichtbare, innerlijke demon helemaal alleen aan te gaan.",
      "Het was het begin van een beklemmende tocht door een kille, onzekere wereld. Een reis waarin de dreiging om mijn toekomst – en letterlijk mijn eigen gezicht en glimlach – voorgoed te verliezen, met de dag groter werd.",
      "Dit is het waargebeurde verhaal van het jaar dat ik het liefst wil vergeten, maar dat me dwong de stilte te doorbreken en te vechten tegen een vijand die me van binnenuit probeerde klein te krijgen.",
      "Toen de storm na een slopende strijd eindelijk ging liggen, ontwaakte er door een onverwacht, hartverscheurend gebaar van mijn dochter een ongekende oerkracht in mij.",
      "Het besef sloeg in als een bliksem: sommige levensverhalen zijn te groot, te echt en te mooi om te verzwijgen of in voorgedrukte vakjes te stoppen.",
      "Dit boek is de loodzware, maar majestueuze proloog op mijn schrijverschap."
    ],
    
    coverUrl: koesterWeg,
    bannerUrl: '/images/banner-boek-1.jpg',
    buyUrl: 'https://www.bravenewbooks.nl/paulvangeenen',
    fragmentText: `Ik ontwaak heel langzaam, alsof ik uit een diepe, warme zee naar boven drijf. Alles is zacht, gedempt, ver weg. Stemmen zweven boven me, kalm en professioneel, maar ze raken me nog niet echt. Mijn hoofd is zwaar, mijn lichaam voelt ver weg. Gedachten komen traag, als dikke druppels honing.

Heel diep vanbinnen licht iets op. Een kleine, stille blijdschap. Het is voorbij. Ik ben er weer. Ik laat me terugzakken in die diepe, vertrouwde slaap. Geen moeite. Geen weerstand. Alleen rust.

Wanneer ik weer een stukje bovenkom, zie ik door mijn oogharen zacht, warm licht en schaduwen die voorbij glijden. Ik sluit mijn ogen opnieuw en neem de rust. Mijn vingers proberen te bewegen, maar ze gehoorzamen nog niet. Vanbinnen lach ik. Waarom die haast, Paul? Rust. Pak die heerlijke rust.

Dan, langzamer, ontwaak ik verder. De geluiden worden duidelijker: zacht piepen van apparaten, voetstappen, een deur die dichtvalt. Ik open mijn ogen half.

Er staat iemand naast me. Lange donkere krullen vallen in zachte golven over haar schouders. Donkere, warme ogen. Een rode jurk, zacht en vloeiend, die het licht vangen. Ze buigt zich naar me toe, gracieus, bekend. Het is de leeuwin. Ik ben terug op die dansvloer, de rumba nog in mijn lichaam, haar gezicht vlak bij het mijne.

“Meneer Van Geenen?” zegt ze zacht.

In één seconde verandert alles. De rode jurk vervaagt tot een lichtblauw verpleegstershirt. Ze is jong, misschien vierentwintig. Een warme, professionele glimlach.

Ik lach zacht en knik. Ze lacht terug. “De operatie is goed verlopen. Alles is volgens plan gegaan. De chirurg is tevreden. U bent er goed doorheen gekomen.”

Een diepe, warme golf van blijdschap trekt door mijn borst. Mijn schouders zakken. Eindelijk.

“Ze halen u zo op om u terug te brengen naar uw kamer,” zegt ze. “Uw vrouw is gebeld. Ze weet dat u onderweg bent.”

Ik sluit mijn ogen even. De wereld is zacht, wazig en veilig.`,
    fragmentVideoUrl: '/videos/fragment-boek-1.mov',
    whyThisOrder: `Dit is het eerste boek – de absolute ontstaansgeschiedenis van mijn schrijverschap.
    Ik zweeg bijna, totdat de tumor (de demon) mij confronteerde met de eindigheid.
    Het moment dat Angelica mij het boekje "Papa, vertel eens..." gaf,
    was het moment dat de cocon openbrak.`,
    hasMRI: true
  },

  {
    id: '2',
    slug: 'koester-het-leven-de-eerste-21-jaar',
    title: 'Koester het Leven: mijn eerste 21 jaar',
    subtitle: 'De vorming van een zwijger',
    order: 2,
    teaser: 'Jeugd, couveuse, blikseminslag, de stilte en de vlucht in het orgel en computercode.',
    
    description: [
      "Op een stormachtige zomernacht in 1965 beslist een blikseminslag over leven en dood. Drie maanden te vroeg geboren, vecht ik in een glazen couveuse voor mijn laatste adem. Terwijl de hoop wegebt, zweert mijn moeder met haar hand op haar hart: 'Dit is Paul Albert. En hij blijft!'",
      "Koester het Leven: de eerste 21 jaar is het rauwe, waargebeurde verslag van een jongen die de dood meermaals in de ogen kijkt, maar weigert mee te gaan.",
      "Gedragen door een oerkrachtige familieliefde groei ik op in de veilige cocon van ons gezin. Maar achter die warme muren schuilt een eenzame strijd. Gevangen in een verlammende verlegenheid en een stem die worstelt om gehoord te worden, zoek ik wanhopig naar mijn plek in een wereld die vaak te luid is.",
      "Wanneer ik onverwachte manieren vind om mijn stiltes te doorbreken, opent zich een weg naar ongekende vrijheid. Een zoektocht die me dwingt mijn diepste schaduwen onder ogen te komen.",
      "Dit is geen gewoon dagboek. In veertig rijk geïllustreerde, losse hoofdstukken die ieder hun eigen verhaal vertellen, beleef je een herinnering die zó is aangescherpt dat je de pijn, de passie en de overlevingskracht tot in je ziel voelt.",
      "Welkom in mijn leven. Lees, voel, en bovenal: koester het leven."
    ],
    
    coverUrl: koester21,
    bannerUrl: '/images/banner-boek-2.jpg',
    buyUrl: 'https://www.bravenewbooks.nl/paulvangeenen',
    fragmentText: `Madame Rosa zat aan een ronde tafel, een oude vrouw met een gezicht als verweerd leer, een rode sjaal om haar hoofd, gouden oorringen die tinkelden als belletjes, haar ogen zwart en diep als een nacht zonder sterren, haar handen vol ringen die glinsterden in het kaarslicht. Ze sprak als eerste, haar stem laag en warm, met een accent dat over zeeën en bergen was gereisd.

“Come, my dear… sit... I see it already. You carry life…” Francien ging zitten, haar handen trilden licht, en legde haar rechterhand open op het fluwelen kleed. Rosa’s vingers, lang en vol ringen, gleden over haar palm, haar nagels rood als kersenbloesems.

“A boy,” zei ze, zonder op te kijken. Francien’s adem stokte, haar hart sloeg een slag over. “A strong boy.” Ze keek op, recht in Franciens ogen, en haar stem werd nog dieper, alsof de aarde zelf sprak. “His hands will hold music. His breath will become a song. He will bring music. The world will hear him. Through storm and silence. Through darkness and light. He will fill halls and hearts with music, Beautiful music.”

Francien fluisterde, haar stem trillend als een kaarsvlam: “Music?” Rosa glimlachte, haar tanden wit in het flakkerende licht. “A life full of notes and light. A road full of storms… but a light that never fades.” Ze legde haar hand zacht op Franciens buik, heel even, alsof ze het hartje al kon horen kloppen. “He knows his name already: Paul, and he will sing it to the world.”

Franciens tranen vielen op het fluweel, stil en warm. Rosa boog zich voorover, haar sjaal viel over de kristallen bol, haar stem nu een fluistering die door de tent zweefde als rook: “Hold him close, mother. Love him with all your heart. For his music will break walls, his voice will tear silence apart. A boy born to fly… even when the world tries to keep him down.”

Buiten speelde een viool, zacht en droevig, terwijl de kermislichten flakkerden in de invallende nacht. Francien stond op, haar hand op haar buik, haar ogen vol tranen die niemand zag. Ze zei niets meer. Ze hoefde niets meer te zeggen. Ze liep de tent uit. De wind was koel op haar wangen. Albert wachtte, zijn arm om haar heen, zijn stem zacht: “En?” Ze keek naar hem, haar ogen glanzend. “Een jongen…” fluisterde ze.

De mist was dichter geworden. De kermislichten waren vlekken in het grijs. Maar in Franciens buik klopte een hartje dat al wist dat het zou zingen. De kermis buiten bruiste. De draaimolen draaide met piepende, vrolijke muziek, de lichtjes flakkerden als duizend vallende sterren, de geur van suikerspin vermengde zich met de zware wierook die nog uit de tent kwam. Kinderen gilden, de schiettent knalde, de nacht was vol klanken en kleuren.

Maar in Franciens hart brandde een ander vuur. Een voorspelling die als een zaadje wortel schoot. Een licht dat wachtte op mijn eerste adem. Een melodie die nog niet gezongen was, maar al in de lucht hing.`,
    fragmentVideoUrl: '/videos/fragment-boek-2.mp4',
    whyThisOrder: `Ik neem  je mee naar het begin. Naar de blikseminslag, de couveuse en de strijd om te overleven. 
    Dit boek legt de fundering voor de man die ik ben geworden.`
  },

  {
    id: '3',
    slug: 'de-echo',
    title: 'De Echo',
    subtitle: 'Veertig jaar van zwijgen',
    order: 3,
    teaser: 'De emotionele kern. Een 21-jarige achter het orgel en de onuitgesproken liefde voor Luna.',
    
    description: [
      "Dit zijn mijn memoires. Een verhaal over zeldzame, breekbare momenten waarop de rest van je leven onherroepelijk wordt bepaald.",
      "Veertig jaar geleden was ik een jonge student, verstrikt in prestatiedruk. Mijn enige ontsnapping vond ik achter de toetsen van een gigantisch instrument. Alles veranderde toen ik de beeldschone altzangeres ontmoette. Ze wekte een allesverterende hartstocht in me los, maar onze liefde stuitte op onzichtbare muren van ongeschreven regels en angst.",
      "De Echo is iets wat je leest, ziet, hoort én voelt. Hyperrealistische foto's en vlinder-QR-codes met een zorgvuldig gekozen Spotify-soundtrack trekken je onontkoombaar het verhaal in, waardoor je de rauwe emotie tot in je diepste vezels zult ervaren.",
      "Ik heb dit boek met een absolute missie geschreven en spaar mezelf niet. De zwaarste echo ontstaat namelijk niet door een verkeerde keuze. Hij ontstaat door de verlamming. Dat ene moment waarop het zó simpel is, maar je bevriest en helemaal níéts doet. Dát is de stilte die een meedogenloze echo achterlaat, waarin de leegte tanden krijgt en decennialang gemeen in je ziel blijft bijten. Een gekmakend 'wat als' dat je de rest van je leven elke nacht wakker houdt.",
      "Lees mijn verhaal en vind de kracht om op te staan en je uit te spreken, vóórdat de stilte jouw levenslange gevangenis wordt."
    ],
    
    coverUrl: deEcho,
    bannerUrl: '/images/banner-boek-3.jpg',
    buyUrl: 'https://www.bravenewbooks.nl/paulvangeenen',
    fragmentText: `"Pap komt nu ook binnen. Zijn gezicht is bleek. “Luna… waarom rende je achter hem aan?” Ik draai me om. Schreeuw. “Omdat ik van hem hou!” Hij schudt zijn hoofd. “Dat is geen antwoord.” Dat is het enige antwoord dat er is!” Hij doet een stap dichterbij. Zijn stem wordt harder. “Je rende het oksaal af. Voor de ogen van het hele koor. Voor de ogen van de dirigent. Voor de ogen van God. Waarom?” “Omdat ik het niet meer kon aanzien!” Mijn stem breekt. “Hij zat daar. Achter dat orgel. En hij brak! En ik kon niets doen! Omdat jullie hem niet toelaten! Omdat jullie mij niet toelaten! Omdat jullie ons niet toelaten!”

Mam komt dichterbij. Haar stem trilt. “Luna… alsjeblieft…”

“NEE!”

Het woord scheurt uit mijn keel – geen schreeuw meer, maar een brul. Een rauwe, keelverscheurende brul die de muren doet trillen. Mijn stem is niet meer alleen van mij. Er zit iets anders in. Iets oers, iets dat al die tijd in mijn borst heeft liggen wachten, grommend, hijgend, hongerig.

De leeuwin is wakker. Niet langzaam. Niet voorzichtig. Ze ontploft. In één seconde is ze er. Volledig. Mijn hart slaat niet meer als een mensenhart – het bonkt als een trommel van oorlog, diep en zwaar, alsof mijn ribbenkast te klein is geworden voor wat er binnenin zit. Mijn adem komt niet meer uit mijn longen, maar uit een veel diepere plek – een plek waar vuur en bloed en razernij wonen. Mijn spieren spannen zich zonder dat ik het wil. Mijn schouders worden breder. Mijn nek trekt strak. Mijn vingers krommen zich als klauwen. Nagels drukken in mijn handpalmen tot bloed opwelt – heet, dik, rood – en het doet geen pijn. Het voelt goed. Het voelt juist.

Ik zie de stoel staan. Gewoon een stoel. Hout. Vier poten. Een rugleuning. Maar voor de leeuwin is het geen stoel. Het is een symbool. Een symbool van alles wat me klein houdt. Alles wat me opsluit. Alles wat me dwingt te buigen. Alles wat me dwingt te zwijgen.

Ik pak hem vast. Niet met mijn handen. Met mijn klauwen. Mijn vingers sluiten zich om de rugleuning. Het hout kraakt al onder mijn greep. Mijn armen spannen zich. Mijn biceps branden. Mijn rug trekt strak. De leeuwin brult in mijn borst – laag, diep, dierlijk – een geluid dat door mijn botten trilt, dat mijn tanden laat klapperen, dat mijn hele lijf laat schudden.

Ik til de stoel op. Niet langzaam. Niet voorzichtig. Met een ruk. Met een brul. Het hout protesteert – een scheurend geluid – maar het kan me niet schelen. Ik zwaai hem boven mijn hoofd. Mijn armen trillen van kracht. Mijn schouders schreeuwen. Mijn rug buigt door. Maar ik voel het niet. Ik voel alleen haar. Alleen de leeuwin. Alleen de razernij die door mijn aderen raast als lava.

En dan gooi ik. Niet zomaar gooien. Vernietigen. De stoel vliegt door de kamer. Hij raakt de muur met een explosie van hout en splinters. Een poot breekt af. De rugleuning splijt. Scherven vliegen alle kanten op. Een scherf raakt de lamp. Glas knalt. De lamp valt. De gloeilamp spettert en dooft. Duisternis slokt de kamer half op. Alleen nog het schemerlicht van de straatlantaarn buiten valt door het raam."`,
    fragmentVideoUrl: '/videos/fragment-boek-3.mp4',
    whyThisOrder: `Mijn stem is eindelijk ontwaakt. Maar dan volgt de werkelijke beklemming. Dit is het moment waarop je genadeloos hard wordt meegetrokken in de absolute, rauwe kern van mijn zwijgen.`
  },

  {
    id: '4',
    slug: 'de-bestemming',
    title: 'De Bestemming',
    subtitle: 'De terugkeer',
    order: 4,
    teaser: 'Het heden. De terugkeer en de confrontatie met de sloopdreiging van mijn kerk.',
    
    description: [
      "Op een ijskoude februari avond in 1984 stapte ik als eenentwintigjarige jongen een majestueus gebouw binnen. Hoog op het oksaal, achter een machtig instrument met zilveren en gouden pijpen, brak ik de stiltes van mijn jeugd open. Ik temde het donkere beest en liet de stenen gewelven zingen. Hier vond ik geen kille religie, maar een warme gemeenschap en een allesverterende passie. Ik was koning, en het gebouw ademde met mij mee.",
      "Maar de tijd is meedogenloos. Veertig jaar later sta ik opnieuw voor dezelfde zware eikenhouten deuren. De warme droom van mijn jeugd heeft plaatsgemaakt voor een ijzingwekkende realiteit. Een wereld geregeerd door kille spreadsheets en zielloze efficiëntie is ook mijn oude koninkrijk binnengedrongen.",
      "De Bestemming is het rauwe, viscerale verhaal van mijn ultieme confrontatie met mijn verleden. Gevangen tussen magische herinneringen en een hartverscheurend heden, word ik overspoeld door een onvoorstelbare dreiging. Terwijl in de verte een zwaar, mechanisch geronk aanzwelt dat de aarde doet beven, rest er nog maar één vraag:",
      "Hoever reikt de echo van je jeugd, voordat een absolute oerkracht alles voorgoed vermorzelt?"
    ],
    
    coverUrl: deBestemming,
    bannerUrl: '/images/banner-boek-4.jpg',
    buyUrl: 'https://www.bravenewbooks.nl/paulvangeenen',
    fragmentText: "Een muur van ijskoude, muffe lucht slaat me vol in het gezicht. Waar ik zojuist in mijn herinnering nog de zoete, zware geur van wierook en warm kaarsvet snoof, ruik ik nu alleen nog maar verlatenheid. Stof. Vocht. Dood.\n\nIk zet een stap over de drempel en sta in het middenschip. Mijn adem stokt in mijn keel. Mijn maag trekt samen tot een harde, pijnlijke knoop die me bijna dubbel doet klappen. Ik wist dat dit zou komen. Ik had me erop voorbereid. Ik wíst dat ze het gebouw hadden gestript. Maar je kunt je niet voorbereiden op de fysieke klap van een vermoorde ziel.\n\nDe ruimte voor me is gigantisch, hol en karkas-achtig. De statige pilaren van baksteen en beton staan er nog, ze reiken nog steeds naar de hemel, maar ze dragen niets meer. Geen gezang, geen warmte, geen gemeenschap. Ze dragen alleen nog een oorverdovende, drukkende leegte die de lucht uit mijn longen perst.\n\nDe kerkmeester zegt niets. Hij snapt het. Hij loopt zwijgend naast me terwijl we via het middenpad naar voren lopen. Mijn schoenen raken de stoffige tegelvloer, de echo is nu dof en eenzaam, als voetstappen in een immense graftombe. Het licht valt nog steeds door de hoge boogramen, maar het vangt geen stofdeeltjes meer die dansen boven de hoofden van de mensen. Er ís niemand meer. De donker stoffige eiken banken staan in strakke rijen, koud en dood, als vergeten grafstenen op een verlaten kerkhof.\n\nMijn blik glijdt naar het altaar. Het staat er kaal, koud en gestript bij. Geen strakke witte doeken meer. Geen flakkerende kaarsen in rode glazen. Geen gouden kandelaars of bloemen. Het hart is eruit gerukt. Maar als ik omhoogkijk, stopt de wereld even met draaien.\n\nHij hangt er nog. Het grote, donkere, ruwe kruis.\n\nJezus.\n\nNog steeds net zo rauw, pijnlijk en onbarmhartig echt als veertig jaar geleden. Zijn hoofd voorovergebogen, gestold bloed dat over zijn ribben en benen loopt, de open wond in zijn zij.\n\nMaar waar Hij toen voor een volle, levende kerk hing, hangt Hij nu in een volstrekte, ijzige verlatenheid. Achtergelaten. Vergeten door de mensen en instanties die dit gebouw zonder pardon hebben opgegeven en onttrokken aan het leven. Hij hangt daar, starend in de holle leegte, net zo eenzaam en verraden als ik me nu voel.\n\nMijn knieën beginnen te trillen. De zwaartekracht trekt aan me. Langzaam, alsof ik breekbaar ben geworden, laat ik me in de eerste eikenhouten bank glijden. Het hout is ijskoud. Ik leg mijn bevende handen in mijn schoot. Ik haal diep, heel diep adem in de dode ruimte.\n\nIk sluit mijn ogen in de ijskoude, muffe stilte van het heden. De kou trekt door mijn jas, door mijn spieren, tot diep in mijn botten.",
    fragmentVideoUrl: '/videos/fragment-boek-4.mp4',
    whyThisOrder: `Dit is het ultieme, bombastische slotakkoord van de reeks.
    Veertig jaar nadat mijn ziel ontwaakte, keer ik terug.
    Het is de perfecte, majestueuze finale.`
  }
];

export const ECHO_CHAPTERS: EchoChapter[] = [
  {
    id: 'ch1',
    slug: 'de-leeuw-in-de-kerk',
    title: 'De leeuw in de kerk',
    teaser: 'En toen stond de leeuw op..',
    imageUrl: 'https://images.unsplash.com/photo-1546182208-99c197e41184?q=80&w=1200&auto=format&fit=crop',
    videoUrl: '/videos/leeuw-in-de-kerk.mp4',
    quote: '"De muziek ontwaakte de leeuw en zorgde ervoor dat hij echt opstond."',
    backgroundStory: [
            "Dit hoofdstuk was een absolute martelgang om te schrijven. Ik heb het keer op keer gewist en opnieuw opgebouwd. In de allereerste versies zette ik de angstige verwachtingen van Luna en de mijne puur feitelijk tegenover elkaar. Ik beschreef hoe ik in de kerkbank zat, bad om kracht, innerlijk versterkt opstond en naar haar toe liep.", 
            "Maar elke keer als ik het teruglas, voelde het leeg. Te braaf. Te menselijk. Het miste de allesvernietigende oerkracht die zich dat moment veertig jaar geleden daadwerkelijk van mij meester maakte. Op zoek naar de juiste emotionele cadans, zette ik muziek op. Ik zocht naar een illustratie, een ritme, en kwam uit bij 'In These Arms' van Bon Jovi. Ik draaide het volume open en speelde het snoeihard af.",
            "En toen gebeurde het.",
            "Meteen aan het begin van dat nummer drong de zware, trage beat van de drum en de bas dwars door mijn borstkas heen. Het was geen muziek meer; het klonk als een hartslag. Een zware, diepe, oeroude wilde hartslag. Bij elke dreun van die bas zag ik hem voor me opdoemen.",
            "De leeuw.",
            "De gedachte sloeg in als een mokerslag: ík was daar helemaal niet opgestaan uit die bank. De verlegen, zwijgende organist bleef achter. Het was het beest dat wakker werd en volledig bezit van mij nam. Ik besloot de scène op dat moment drastisch of zelfs totaal cinematografisch om te gooien.",
            "Terwijl Bon Jovi door mijn werkkamer denderde, begon ik te typen hoe de wereld in die kerkbank voor mij veranderde. Ik beschreef hoe het publiek om me heen, zoals de oude vrouw naast me, slechts 'Paul de organist' zag zitten. Een doodgewone, biddende jongen. Maar vanbinnen voltrok zich een brute, viscerale metamorfose.",
            "Hoe dat verder afloopt, bewaar ik voor de bladzijden van het boek. Maar geloof me: deze scène brak de deuren in mij open en smeedde een extra, adembenemende laag in het verhaal."
    ]
  },
  {
    id: 'ch2',
    slug: 'luna-als-eigen-personage',
    title: 'Luna als eigen personage',
    teaser: 'Ze moest geen bijrol spelen; ze moest ademen, bijten en de bladzijden verscheuren.',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1200&auto=format&fit=crop',
    videoUrl: '/videos/luna-story.mp4',
    quote: '"Hoe wek je een leeuwin na veertig jaar weer tot leven, zonder dat ze slechts een schaduw van je eigen pijn wordt?"',
    backgroundStory: [
          "In de allereerste, ruwe schetsen van het boek was Luna slechts een bijrol. Een herinnering die zijdelings door mijn eigen verhaal fladderde. Maar elke keer als ik haar naam typte, voelde het als verraad. Zij was geen figurant; zij was de vonk die de explosie veroorakte. Zij moest net zo groot, net zo dwingend en misschien nog wel machtiger worden dan ikzelf. Ik wilde de lezer genadeloos meesleuren in háár hoofd, haar stille wanhoop laten proeven  en haar vrouwelijke oerkracht laten voelen.",
          "Maar hoe doe je dat als man, veertig jaar na dato?",
          "Ik weigerde haar af te vlakken tot een eendimensionaal, braaf personage. Dus greep ik naar een onorthodox, bruut hulpmiddel om de deuren van het verleden open te breken. Ik programmeerde een speciale, vrouwelijke AI-chatbot als een meedogenloze spiegel en gaf het één keiharde opdracht: Bevraag mij. Graaf in mijn weggestopte herinneringen. Dwing me om haar ziel tot op het bot bloot te leggen.",
          "De machine vuurde onafgebroken vraag na vraag op me af. Het werd een uitputtend, emotioneel kruisverhoor. Ik moest tot in de diepste, pijnlijkste kelders van mijn geheugen afdalen om exact te beschrijven hoe ze dacht, hoe ze bewoog, hoe ze me aankeek met die reebruine ogen.", 
          "Het resultaat was een haarscherp profiel van twee A4’tjes: de absolute, zuivere essentie van Luna.",
          "Vanaf dat moment controleerde ik elke scène waarin zij genadeloos verscheen aan de hand van die beschrijving. Was ze vrouwelijk genoeg? Was ze vurig genoeg? Was ze de ongetemde vrouw die ze op dat moment in mijn leven was?",
          "Vervolgens heb ik de jongen die ik toen was — de verlegen, zwijgende organist van eenentwintig — aan exact dezelfde genadeloze ontleding onderworpen. Door deze twee loeisterke, onafhankelijke persoonlijkheden leven in te blazen en ze via wisselende perspectieven (POV) af te wisselen, ontstond er een adembenemende, filmische dynamiek.", 
          "Zo ontstaan de memoires van twee verschillende zielen met één gepassioneerde liefde voor elkaar, die genadeloos stuitte op onzichtbare tralies. Je wordt meegezogen in een rauwe strijd tegen de beklemmende regels van buitenaf en de verlammende demonen van binnenuit.",
          "Wil je voelen hoe haar personage uiteindelijk van het papier af spat en de controle overneemt? Dan daag ik je uit om het boek open te slaan en ook haar wereld binnen te stappen."
    ]
  },
  {
    id: 'ch3',
    slug: 'hoofdstuk-10-demon-ontwaakt',
    title: 'Hoofdstuk 10 – De Demon ontwaakt',
    teaser: 'Een psychologische deep dive van 22 minuten. Een intens gesprek tussen twee experts over wat er écht gebeurt in dit hoofdstuk.',
    imageUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1200&auto=format&fit=crop',
    audioUrl: '/audio/Zelfsabotage_aan_de_Limburgse_koffietafel 96 kbps mono.m4a',
    quote: '"De zwaarste strijd is die tegen de stemmen in je eigen hoofd."',
    backgroundStory: [
      "Dit is geen gewone uitleg, maar een diepgaande analyse van de psychologische lagen in hoofdstuk 10. We duiken in het mechanisme van zelfsabotage en de verlammende werking van de innerlijke demon.",
      "Zet je koptelefoon op en neem de tijd voor dit 22 minuten durende gesprek dat de kern van de beklemming in De Echo blootlegt."
    ],
    isLocked: true,
    unlockCode: 'LUNA1984'
  }
];
