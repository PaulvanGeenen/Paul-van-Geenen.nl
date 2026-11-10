import React, { useEffect, useState } from 'react';
import { Shield, Lock, Eye, Server, RefreshCw, Mail, Globe, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isLionBooksDomain, getCurrentDomainLabel, getCurrentDomainUrl } from '../utils/domain';
import { getUserGeoLocation } from '../lib/analytics';

export function Privacy() {
  const isLion = isLionBooksDomain();
  const domainLabel = getCurrentDomainLabel();
  const domainUrl = getCurrentDomainUrl();

  const [lang, setLang] = useState<'nl' | 'en'>('nl');
  const [detectedCountry, setDetectedCountry] = useState<string>('Nederland');
  const [isDetecting, setIsDetecting] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    getUserGeoLocation().then((geo) => {
      if (!isMounted) return;
      if (geo && geo.country) {
        setDetectedCountry(geo.country);
        const cLower = geo.country.toLowerCase();
        // Als het bezochte land Nederlands is (Nederland / België/Flanders), kies NL, anders EN
        if (cLower.includes('nederland') || cLower.includes('netherlands') || cLower === 'nl' || cLower.includes('belgië') || cLower.includes('belgium')) {
          setLang('nl');
        } else {
          setLang('en');
        }
      }
      setIsDetecting(false);
    }).catch(() => {
      if (isMounted) setIsDetecting(false);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="bg-[#1a1715] text-earth-light min-h-screen py-12 px-6 md:px-12 lg:px-24">
      <div className="max-w-4xl mx-auto">
        {/* Navigation & Language Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-earth-clay/20">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-earth-gold hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{lang === 'nl' ? 'Terug naar website' : 'Back to website'}</span>
          </Link>

          {/* Language Switcher */}
          <div className="flex items-center gap-2 bg-black/40 border border-earth-clay/30 p-1 rounded-xl text-xs font-mono">
            <span className="px-2 text-earth-light/60 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-earth-gold" />
              <span className="hidden sm:inline">Taal / Language:</span>
            </span>
            <button
              type="button"
              onClick={() => setLang('nl')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                lang === 'nl'
                  ? 'bg-earth-gold text-black shadow'
                  : 'text-earth-light/70 hover:text-white'
              }`}
            >
              Nederlands (NL)
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                lang === 'en'
                  ? 'bg-earth-gold text-black shadow'
                  : 'text-earth-light/70 hover:text-white'
              }`}
            >
              English (EN)
            </button>
          </div>
        </div>

        {/* Header Banner */}
        <div className="bg-gradient-to-br from-[#2D2926] to-[#1e1b19] border border-earth-clay/30 rounded-3xl p-8 md:p-12 mb-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-earth-gold/5 rounded-full blur-3xl pointer-events-none" />
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-earth-gold bg-earth-gold/10 border border-earth-gold/20 px-3 py-1 rounded-full mb-4">
            <Shield className="w-3.5 h-3.5" />
            <span>{lang === 'nl' ? 'AVG & Privacy Gegevensbescherming' : 'GDPR & Privacy Data Protection'}</span>
          </div>

          <h1 className="font-serif text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
            {lang === 'nl' ? 'Privacyverklaring' : 'Privacy Policy'}
          </h1>
          <p className="text-earth-gold font-serif text-lg md:text-xl italic mb-3">
            {isLion ? 'Lion Books / Paul van Geenen' : 'Paul van Geenen / Lion Books'}
          </p>
          <p className="text-xs font-mono text-earth-light/60">
            {lang === 'nl' ? 'Laatst gewijzigd: november 2026' : 'Last updated: November 2026'}
            {!isDetecting && (
              <span className="ml-3 text-white/40">
                • {lang === 'nl' ? `Automatisch afgestemd op locatie: ${detectedCountry}` : `Automatically tailored to detected location: ${detectedCountry}`}
              </span>
            )}
          </p>
        </div>

        {/* Content Body */}
        {lang === 'nl' ? (
          <div className="space-y-10 text-earth-light/90 leading-relaxed font-sans text-sm md:text-base">
            <section className="bg-black/25 border border-earth-clay/20 p-6 md:p-8 rounded-2xl">
              <p className="text-base md:text-lg leading-relaxed text-white/95">
                Welkom op de website van <strong>{isLion ? 'Lion Books' : 'Paul van Geenen'}</strong> (
                <a href={domainUrl} className="text-earth-gold underline font-mono hover:text-white">{domainLabel}</a>
                {domainLabel === 'lionbooks.nl' ? ' en paulvangeenen.nl' : ' en lionbooks.nl'}). Wij hechten veel waarde aan jouw privacy. In deze privacyverklaring leggen we helder en zonder ingewikkelde juridische taal uit welke gegevens we verzamelen, waarom we dat doen, en hoe we jouw gegevens beschermen conform de <strong>Algemene Verordening Gegevensbescherming (AVG / GDPR)</strong>.
              </p>
            </section>

            {/* 1. Verantwoordelijke */}
            <section className="space-y-4">
              <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-3 border-b border-earth-clay/20 pb-3">
                <span className="text-earth-gold font-mono text-lg">1.</span>
                <span>Wie is verantwoordelijk voor de gegevensverwerking?</span>
              </h2>
              <div className="bg-white/[0.03] p-5 rounded-xl border border-white/5 space-y-2">
                <p>De verantwoordelijke voor de verwerking van persoonsgegevens op deze website is:</p>
                <p className="text-white font-medium">Paul van Geenen (handelend onder Lion Books)</p>
                <p className="text-sm">
                  Website: <a href="https://paulvangeenen.nl" className="text-earth-gold underline hover:text-white">paulvangeenen.nl</a> / <a href="https://lionbooks.nl" className="text-earth-gold underline hover:text-white">lionbooks.nl</a>
                </p>
                <p className="text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4 text-earth-gold shrink-0" />
                  <span>E-mail voor privacyvragen: </span>
                  <a href="mailto:info@paulvangeenen.nl" className="text-earth-gold font-mono font-bold hover:underline">info@paulvangeenen.nl</a>
                </p>
              </div>
            </section>

            {/* 2. Welke gegevens */}
            <section className="space-y-6">
              <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-3 border-b border-earth-clay/20 pb-3">
                <span className="text-earth-gold font-mono text-lg">2.</span>
                <span>Welke gegevens verzamelen wij en waarom?</span>
              </h2>

              <div className="space-y-6">
                {/* 2A */}
                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                  <h3 className="font-serif text-lg font-bold text-earth-gold mb-2">
                    A. Muziekspeler &amp; Ontgrendelde SoundTracks (Lokale browser-opslag)
                  </h3>
                  <ul className="space-y-2 text-sm text-earth-light/85">
                    <li><strong className="text-white">Wat slaan we op?</strong> Jouw voortgang in de muziekspeler, welke SoundTracks je via QR-codes of ontgrendelcodes (GUID) hebt vrijgespeeld, je volume-instelling en eventuele favorieten.</li>
                    <li><strong className="text-white">Waar slaan we dit op?</strong> Dit wordt <em>uitsluitend lokaal in jouw eigen webbrowser</em> opgeslagen (<code className="font-mono text-earth-gold bg-black/40 px-1.5 py-0.5 rounded">localStorage</code>).</li>
                    <li><strong className="text-white">Waarom?</strong> Om te onthouden welke nummers jij tijdens het lezen van het boek hebt ontgrendeld, zodat je deze de volgende keer dat je de website bezoekt meteen weer kunt beluisteren. Deze gegevens verlaten jouw apparaat niet en wij hebben hier geen directe toegang toe.</li>
                  </ul>
                </div>

                {/* 2B */}
                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                  <h3 className="font-serif text-lg font-bold text-earth-gold mb-2">
                    B. Contactformulier
                  </h3>
                  <ul className="space-y-2 text-sm text-earth-light/85">
                    <li><strong className="text-white">Wat verzamelen we?</strong> Je naam, e-mailadres en de inhoud van je bericht wanneer je ons een bericht stuurt.</li>
                    <li><strong className="text-white">Waarom?</strong> Uitsluitend om je vraag, reactie of opmerking te kunnen beantwoorden.</li>
                    <li><strong className="text-white">Bewaartermijn:</strong> We bewaren deze correspondentie niet langer dan nodig is voor een correcte afhandeling van je vraag.</li>
                  </ul>
                </div>

                {/* 2C */}
                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                  <h3 className="font-serif text-lg font-bold text-earth-gold mb-2">
                    C. Nieuwsbrief / Updates (indien van toepassing)
                  </h3>
                  <ul className="space-y-2 text-sm text-earth-light/85">
                    <li><strong className="text-white">Wat verzamelen we?</strong> Je e-mailadres (en eventueel voornaam).</li>
                    <li><strong className="text-white">Waarom?</strong> Om je op de hoogte te houden van nieuwe boekuitgaven, muziekreleases of speciale achter-de-schermen updates rondom de boekenreeks.</li>
                    <li><strong className="text-white">Bewaartermijn:</strong> Totdat jij je uitschrijft. Iedere nieuwsbrief bevat een duidelijke uitschrijflink (of je kunt ons een mail sturen naar <a href="mailto:info@paulvangeenen.nl" className="text-earth-gold underline font-mono">info@paulvangeenen.nl</a> om je direct uit te schrijven).</li>
                  </ul>
                </div>

                {/* 2D */}
                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                  <h3 className="font-serif text-lg font-bold text-earth-gold mb-2">
                    D. Volledig anonieme statistieken &amp; scan-tellers
                  </h3>
                  <ul className="space-y-2 text-sm text-earth-light/85">
                    <li><strong className="text-white">Wat verzamelen we?</strong> Hoe vaak een bepaalde QR-code of SoundTrack is gescand/beluisterd en de globale herkomstregio (stad/land).</li>
                    <li><strong className="text-white">Waarom?</strong> Om te zien welke hoofdstukken en composities populair zijn bij lezers.</li>
                    <li><strong className="text-white">AVG-Anonimisering:</strong> Dit gebeurt volledig anoniem op onze eigen server. Er worden <strong>geen individuele IP-adressen opgeslagen of gekoppeld aan persoons- of lezersprofielen</strong>. IP-adressen worden conform de AVG direct gemaskeerd (bijv. het laatste octet op nul gezet), zodat alleen het grove stads-/landniveau kan worden bepaald zonder dat een natuurlijk persoon identificeerbaar is.</li>
                  </ul>
                </div>

                {/* 2E */}
                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                  <h3 className="font-serif text-lg font-bold text-earth-gold mb-2">
                    E. Technische serverlogs (Hosting bij TransIP)
                  </h3>
                  <p className="text-sm text-earth-light/85">
                    Zoals bij vrijwel elke website slaat de hostingprovider (TransIP, gevestigd in Nederland) standaard technische logbestanden op (zoals datum, tijdstip en browsertype). Dit is noodzakelijk voor de technische beveiliging, stabiliteit en het opsporen van storingen. Deze gegevens worden niet gebruikt om individuele personen te identificeren.
                  </p>
                </div>
              </div>
            </section>

            {/* 3. Cookies */}
            <section className="space-y-4">
              <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-3 border-b border-earth-clay/20 pb-3">
                <span className="text-earth-gold font-mono text-lg">3.</span>
                <span>Cookies en tracking</span>
              </h2>
              <ul className="space-y-3 bg-white/[0.02] border border-white/5 p-6 rounded-2xl text-sm">
                <li><strong className="text-white">Geen advertentie- of trackingcookies:</strong> Wij maken <em>geen</em> gebruik van advertentienetwerken, tracking cookies van derden (zoals Google, Meta/Facebook of TikTok) of cross-site tracking.</li>
                <li><strong className="text-white">Functionele opslag:</strong> Wij gebruiken alleen technisch noodzakelijke opslag in de browser (zoals beschreven onder punt 2A) om de website en muziekspeler optimaal te laten functioneren.</li>
              </ul>
            </section>

            {/* 4. Delen met derden */}
            <section className="space-y-4">
              <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-3 border-b border-earth-clay/20 pb-3">
                <span className="text-earth-gold font-mono text-lg">4.</span>
                <span>Delen met derden</span>
              </h2>
              <p className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl text-sm text-earth-light/85">
                Wij verkopen, verhuren of delen jouw persoonsgegevens <strong>nooit</strong> met derden voor commerciële doeleinden. Gegevens worden uitsluitend verwerkt door partijen die direct nodig zijn voor het functioneren van de site (onze gecertificeerde Nederlandse webhostingpartij TransIP onder een verwerkersovereenkomst conform Europese wetgeving).
              </p>
            </section>

            {/* 5. Rechten onder AVG */}
            <section className="space-y-4">
              <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-3 border-b border-earth-clay/20 pb-3">
                <span className="text-earth-gold font-mono text-lg">5.</span>
                <span>Jouw rechten onder de AVG</span>
              </h2>
              <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl space-y-3 text-sm">
                <p>Je hebt te allen tijde het recht om:</p>
                <ul className="list-disc list-inside space-y-1.5 text-earth-light/85 pl-2">
                  <li>Inzage te vragen in de persoonsgegevens die wij eventueel van jou hebben;</li>
                  <li>Rectificatie (correctie) of volledige verwijdering van jouw gegevens te verzoeken;</li>
                  <li>Je af te melden voor communicatie of nieuwsbrieven.</li>
                </ul>
                <p className="pt-2">
                  Wil je gebruikmaken van een van deze rechten? Stuur dan een bericht via ons <Link to="/contact" className="text-earth-gold underline hover:text-white">contactformulier</Link> of mail rechtstreeks naar{' '}
                  <a href="mailto:info@paulvangeenen.nl" className="text-earth-gold font-mono font-bold hover:underline">info@paulvangeenen.nl</a>.
                </p>
              </div>
            </section>

            {/* 6. Beveiliging */}
            <section className="space-y-4">
              <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-3 border-b border-earth-clay/20 pb-3">
                <span className="text-earth-gold font-mono text-lg">6.</span>
                <span>Beveiliging van jouw gegevens</span>
              </h2>
              <p className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl text-sm text-earth-light/85 flex items-start gap-3">
                <Lock className="w-5 h-5 text-earth-gold shrink-0 mt-0.5" />
                <span>
                  De website maakt gebruik van een beveiligde SSL-verbinding (HTTPS), te herkennen aan het slotje in de adresbalk. Alle gegevensuitwisseling tussen jouw browser en onze server is hierdoor versleuteld en beveiligd tegen afluisteren.
                </span>
              </p>
            </section>
          </div>
        ) : (
          <div className="space-y-10 text-earth-light/90 leading-relaxed font-sans text-sm md:text-base">
            <section className="bg-black/25 border border-earth-clay/20 p-6 md:p-8 rounded-2xl">
              <p className="text-base md:text-lg leading-relaxed text-white/95">
                Welcome to the website of <strong>{isLion ? 'Lion Books' : 'Paul van Geenen'}</strong> (
                <a href={domainUrl} className="text-earth-gold underline font-mono hover:text-white">{domainLabel}</a>
                {domainLabel === 'lionbooks.nl' ? ' and paulvangeenen.nl' : ' and lionbooks.nl'}). We value your privacy deeply. In this privacy policy, we explain clearly and without complicated legal jargon what information we collect, why we collect it, and how we protect your data in accordance with the <strong>General Data Protection Regulation (GDPR)</strong>.
              </p>
            </section>

            {/* 1. Controller */}
            <section className="space-y-4">
              <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-3 border-b border-earth-clay/20 pb-3">
                <span className="text-earth-gold font-mono text-lg">1.</span>
                <span>Who is responsible for data processing?</span>
              </h2>
              <div className="bg-white/[0.03] p-5 rounded-xl border border-white/5 space-y-2">
                <p>The controller for the processing of personal data on this website is:</p>
                <p className="text-white font-medium">Paul van Geenen (trading as Lion Books)</p>
                <p className="text-sm">
                  Website: <a href="https://paulvangeenen.nl" className="text-earth-gold underline hover:text-white">paulvangeenen.nl</a> / <a href="https://lionbooks.nl" className="text-earth-gold underline hover:text-white">lionbooks.nl</a>
                </p>
                <p className="text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4 text-earth-gold shrink-0" />
                  <span>Email for privacy inquiries: </span>
                  <a href="mailto:info@paulvangeenen.nl" className="text-earth-gold font-mono font-bold hover:underline">info@paulvangeenen.nl</a>
                </p>
              </div>
            </section>

            {/* 2. What data */}
            <section className="space-y-6">
              <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-3 border-b border-earth-clay/20 pb-3">
                <span className="text-earth-gold font-mono text-lg">2.</span>
                <span>What data do we collect and why?</span>
              </h2>

              <div className="space-y-6">
                {/* 2A */}
                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                  <h3 className="font-serif text-lg font-bold text-earth-gold mb-2">
                    A. Music Player &amp; Unlocked SoundTracks (Local browser storage)
                  </h3>
                  <ul className="space-y-2 text-sm text-earth-light/85">
                    <li><strong className="text-white">What do we store?</strong> Your listening progress in the music player, which SoundTracks you unlocked via QR codes or secret codes (GUID), your volume settings, and any favorites.</li>
                    <li><strong className="text-white">Where do we store this?</strong> This is stored <em>solely locally in your own web browser</em> (<code className="font-mono text-earth-gold bg-black/40 px-1.5 py-0.5 rounded">localStorage</code>).</li>
                    <li><strong className="text-white">Why?</strong> To remember which tracks you unlocked while reading the book, so you can immediately listen to them upon your next visit. This data never leaves your device, and we have no direct access to it.</li>
                  </ul>
                </div>

                {/* 2B */}
                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                  <h3 className="font-serif text-lg font-bold text-earth-gold mb-2">
                    B. Contact Form
                  </h3>
                  <ul className="space-y-2 text-sm text-earth-light/85">
                    <li><strong className="text-white">What do we collect?</strong> Your name, email address, and the contents of your message when you send us an inquiry.</li>
                    <li><strong className="text-white">Why?</strong> Exclusively to answer your question, comment, or feedback.</li>
                    <li><strong className="text-white">Retention period:</strong> We keep correspondence no longer than necessary to properly address and resolve your inquiry.</li>
                  </ul>
                </div>

                {/* 2C */}
                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                  <h3 className="font-serif text-lg font-bold text-earth-gold mb-2">
                    C. Newsletter / Updates (if applicable)
                  </h3>
                  <ul className="space-y-2 text-sm text-earth-light/85">
                    <li><strong className="text-white">What do we collect?</strong> Your email address (and optional first name).</li>
                    <li><strong className="text-white">Why?</strong> To keep you informed about new book editions, music releases, or special behind-the-scenes updates regarding the series.</li>
                    <li><strong className="text-white">Retention period:</strong> Until you unsubscribe. Every newsletter includes an easy unsubscribe link (or you can email us at <a href="mailto:info@paulvangeenen.nl" className="text-earth-gold underline font-mono">info@paulvangeenen.nl</a> to unsubscribe immediately).</li>
                  </ul>
                </div>

                {/* 2D */}
                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                  <h3 className="font-serif text-lg font-bold text-earth-gold mb-2">
                    D. Completely Anonymous Statistics &amp; Scan Counters
                  </h3>
                  <ul className="space-y-2 text-sm text-earth-light/85">
                    <li><strong className="text-white">What do we collect?</strong> How often a specific QR code or SoundTrack was scanned/played, as well as the broad geographic region (city/country).</li>
                    <li><strong className="text-white">Why?</strong> To understand which chapters and musical compositions resonate most with readers.</li>
                    <li><strong className="text-white">GDPR Anonymization:</strong> This is carried out completely anonymously on our own dedicated server. <strong>No individual IP addresses are stored or linked to reader profiles</strong>. In full compliance with GDPR, IP addresses are immediately masked (e.g., zeroing the last octet), allowing only city/country level aggregation without identifying any individual person.</li>
                  </ul>
                </div>

                {/* 2E */}
                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                  <h3 className="font-serif text-lg font-bold text-earth-gold mb-2">
                    E. Technical Server Logs (Hosting at TransIP)
                  </h3>
                  <p className="text-sm text-earth-light/85">
                    As with nearly all websites, our hosting provider (TransIP, based in the Netherlands) standardly maintains technical log files (such as date, timestamp, and browser type). This is essential for technical security, system stability, and troubleshooting incidents. This data is never used to identify individual people.
                  </p>
                </div>
              </div>
            </section>

            {/* 3. Cookies */}
            <section className="space-y-4">
              <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-3 border-b border-earth-clay/20 pb-3">
                <span className="text-earth-gold font-mono text-lg">3.</span>
                <span>Cookies and Tracking</span>
              </h2>
              <ul className="space-y-3 bg-white/[0.02] border border-white/5 p-6 rounded-2xl text-sm">
                <li><strong className="text-white">No advertising or tracking cookies:</strong> We do <em>not</em> use advertising networks, third-party tracking cookies (such as Google, Meta/Facebook, or TikTok), or cross-site tracking.</li>
                <li><strong className="text-white">Functional storage:</strong> We solely utilize strictly necessary browser storage (as described under point 2A) to ensure the website and music player function smoothly.</li>
              </ul>
            </section>

            {/* 4. Sharing with third parties */}
            <section className="space-y-4">
              <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-3 border-b border-earth-clay/20 pb-3">
                <span className="text-earth-gold font-mono text-lg">4.</span>
                <span>Third-Party Disclosure</span>
              </h2>
              <p className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl text-sm text-earth-light/85">
                We <strong>never</strong> sell, rent, or share your personal data with third parties for commercial purposes. Data is processed exclusively by entities directly required for operating this website (our certified Dutch web hosting partner TransIP under a GDPR data processing agreement).
              </p>
            </section>

            {/* 5. Your Rights */}
            <section className="space-y-4">
              <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-3 border-b border-earth-clay/20 pb-3">
                <span className="text-earth-gold font-mono text-lg">5.</span>
                <span>Your Rights Under the GDPR</span>
              </h2>
              <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl space-y-3 text-sm">
                <p>You have the right at all times to:</p>
                <ul className="list-disc list-inside space-y-1.5 text-earth-light/85 pl-2">
                  <li>Request access to any personal data we may hold about you;</li>
                  <li>Request rectification (correction) or complete erasure of your data;</li>
                  <li>Unsubscribe from communications or newsletter updates.</li>
                </ul>
                <p className="pt-2">
                  To exercise any of these rights, please contact us through our <Link to="/contact" className="text-earth-gold underline hover:text-white">contact form</Link> or send an email directly to{' '}
                  <a href="mailto:info@paulvangeenen.nl" className="text-earth-gold font-mono font-bold hover:underline">info@paulvangeenen.nl</a>.
                </p>
              </div>
            </section>

            {/* 6. Security */}
            <section className="space-y-4">
              <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-3 border-b border-earth-clay/20 pb-3">
                <span className="text-earth-gold font-mono text-lg">6.</span>
                <span>Data Security</span>
              </h2>
              <p className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl text-sm text-earth-light/85 flex items-start gap-3">
                <Lock className="w-5 h-5 text-earth-gold shrink-0 mt-0.5" />
                <span>
                  This website utilizes a secure SSL connection (HTTPS), indicated by the padlock icon in your browser's address bar. All communications between your browser and our server are encrypted and safeguarded.
                </span>
              </p>
            </section>
          </div>
        )}

        {/* Bottom Back Button */}
        <div className="mt-12 pt-8 border-t border-earth-clay/20 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-earth-gold text-black font-semibold hover:bg-white transition-all shadow-lg active:scale-95 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{lang === 'nl' ? 'Terug naar de website' : 'Back to the website'}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
