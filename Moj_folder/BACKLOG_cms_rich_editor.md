# Backlog — CMS rich editor (kasnije)

**Status:** urađeno za Stranice + Vesti + Teme (TipTap) — 2026-11-09  
**Zabeleženo:** 2026-11-08  
**Gde u kodu:** `RichTextEditor.vue` + `PagesView` / `NewsView` / `ThemesView`  
**Public:** News `v-html`; Teme — HTML pass-through + legacy plain-text formatter

## Problem
Admin sada unosi sadržaj stranica kao **sirovi HTML** (`<h2>`, `<p>`, …).  
To je neintuitivno za korisnika koji ne poznaje markup; na sajtu izgled teksta ispod heroa zavisi od toga da li je HTML uredan.

## Cilj
Jednostavan rich text editor umesto raw HTML textarea:

- naslov / podnaslov
- bold / italic
- lista (ul/ol)
- pasus / link (opciono)
- i dalje čuvati HTML u bazi (bez promene API ugovora)

## Napomene
- Public render ostaje `v-html` u `.text-content` (već ujednačen u `PageTemplate`).
- Isto razmotriti za vesti / teme ako koriste sličan textarea.
- Ne mešati sa layout refaktorom — zaseban FE/CMS korak.
