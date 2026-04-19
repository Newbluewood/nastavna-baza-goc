# AI Roadmap i Budzet Plan (Draft)

## Svrha
Ovaj dokument cuva dogovorenu strategiju da sajt ostane potpuno funkcionalan bez AI podrške, a da se AI opcije aktiviraju automatski kada postoji aktivan API provider i dovoljan budzet.

## Osnovni Principi
- Core funkcionalnost sajta ne zavisi od AI servisa.
- AI je dodatna vrednost, ne hard dependency.
- Ako AI nije dostupan, korisnik i admin i dalje zavrsavaju posao manuelno.
- DeepL ostaje glavni servis za prevod.

## Ciljevi proizvoda
- Komforan admin/editor workflow.
- Konzistentan kvalitet sadržaja i slika.
- Predvidljiv mesecni trosak bez iznenadjenja.
- Jednostavno ukljucivanje buducih AI feature-a (chat, RAG, site navigation).

## Arhitektura (Graceful Degradation)
1. Backend ima centralni AI sloj: /api/ai/*
2. Frontend na load-u proverava /api/ai/ping
3. Ako je AI aktivan:
- prikazuju se AI dugmad (proofread, suggest, alt-text)
- radi token/metrika tracking
4. Ako AI nije aktivan:
- AI dugmad se sakriju ili disable-uju
- ostaju manuelna polja i standardni workflow

## Predlog Feature-a (Admin Fokus)
### Faza 1 - Bezbedan start
- AI OFF by default
- Image pipeline standardizacija (rezolucije, crop pravila, kompresija)
- Manual alt text (sr/en)
- Editor radi bez AI

### Faza 2 - AI asistencija za admina
- Alt-text suggestion za slike
- Proofread i style suggestion u editoru
- Rewrite/summarize za brze korekcije
- Sve akcije imaju fallback na manuelni unos

### Faza 3 - Public AI (po zahtevu klijenta)
- Chat widget
- RAG pretraga kroz sajt i bazu znanja
- Guided site navigation kroz AI asistenta

## Model Routing Strategija
- Chat/asistent: kvalitetniji model (npr. Sonnet klasa)
- Rewrite/proofread/summarize: jeftiniji model (npr. Haiku klasa)
- Kratke sistemske transformacije: low-cost model ili pravila bez LLM

## Cost Guardrails (obavezno)
- Globalni mesecni limit (npr. 10, 20, 50 EUR)
- Dnevni limit potrosnje
- Per-user limit (broj AI akcija dnevno)
- Per-feature limit (npr. max poruka po sesiji)
- Soft alert pragovi: 60%, 80%, 95%
- Hard stop na 100% (AI OFF, app i dalje radi)

## Caching i Ustede
- Prompt hash + rezultat cache (TTL)
- Deduplikacija identicnih zahteva
- Prompt caching kod dokumenata koji se ponavljaju
- Batch obrada za ne-hitne AI taskove

## Image Quality Standard (Profi izgled)
- Definisane ciljane dimenzije po tipu (thumbnail, card, hero)
- Pravila za crop i centriranje
- Maksimalna tezina fajla i automatska kompresija
- Zabranjeno razvlačenje slike u UI-u
- Alt text obavezan (sr i en)

## Editor UX Standard
- Brz unos i pregled izmena
- Jasno odvojena manuelna i AI asistencija
- AI predlog je uvek reviewable pre primene
- Nema automatskog overwrite-a bez potvrde korisnika

## Telemetrija i Operativa
- Log po AI pozivu: feature, model, tokeni, trajanje, status
- Dnevni i mesecni agregati
- Admin pregled potrosnje i health statusa
- Evidencija fallback event-a (kada AI nije dostupan)

## Provider Napomena
Subscription planovi i API billing cesto nisu isti proizvod.
Potrebno je posebno proveriti da li konkretan plan daje API key za runtime pozive iz aplikacije.

## Prezentacija za klijenta (buduci deck)
- Scenario A: Sajt bez AI (stabilan i kompletan)
- Scenario B: AI za admin tim (efikasniji content workflow)
- Scenario C: Public AI (chat + RAG) uz kontrolisan budzet
- Jasna tabela troska, limita i fallback ponasanja

## Otvorena pitanja za finalizaciju
- Koliki je pocetni mesecni cap za AI?
- Ko odobrava povecanje budzeta?
- Koje AI funkcije su prioritet #1 za admin tim?
- Da li public chat ide odmah ili nakon perioda merenja?

## Predlog Start Konfiguracije
- AI_ENABLED=false na produkciji dok se ne potvrde limiti
- AI_ENABLED=true na dev/staging za test
- DeepL ostaje aktivan
- Nakon 2-4 nedelje metrike: odluka za rollout sledece faze
