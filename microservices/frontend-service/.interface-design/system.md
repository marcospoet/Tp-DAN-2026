# BudgetBuddy — Interface Design System

## Direction & Feel
**"Personal financial terminal"** — focused, dark, precise. Not a bank app (cold institutional), not social (playful). Like a trusted notebook that understands Argentine financial reality. The user is on their phone between tasks; speed of capture is the core value.

## User
Young Argentine adult (20s-35s) on mobile, dealing with ARS + USD dual-currency reality. Checks finances on the go. Speed of input is paramount. Needs to track peso AND dollar transactions with specific exchange rates.

## Depth Strategy
**Borders only** — no box shadows for cards. `border border-border` everywhere. Shadows only for overlays/dropdowns (`shadow-xl shadow-black/40`). Dark mode-native.

## Spacing Base
`4px` base unit. Cards: `p-4` (16px). Header: `py-3 px-4`. Gaps: `gap-3` or `gap-4`. Touch targets minimum `h-9` (36px), ideally `h-11` (44px).

## Surfaces (elevation scale)
```
Level 0 — page:     bg-background  (oklch 0.13)
Level 1 — cards:    bg-card        (oklch 0.17)
Level 2 — inputs:   bg-secondary/50
Level 3 — overlay:  glass class    (oklch 0.17 / 0.6 + blur)
Level 4 — dropdowns: bg-card/90 + border
```

## Colors
- Primary / emerald: `oklch(0.72 0.19 160)` — selected states, income, positive balance
- Destructive / red: `oklch(0.60 0.20 25)` — overspending, negative
- Accent / violet: `oklch(0.65 0.14 300)` — AI features, recording
- USD / gold: `text-chart-5`, `bg-chart-5/15` — dollar transactions

## Typography
Font: Inter (sans). Data/amounts: font-mono, tabular-nums.
- Heading: `text-base font-semibold`
- Amount (hero): `text-lg font-bold tabular-nums`
- Label: `text-xs text-muted-foreground`
- Hint: `text-[10px] text-muted-foreground/50`

## Border Radius
- Cards / containers: `rounded-2xl`
- Buttons, inputs: `rounded-xl`
- Chips: `rounded-full`
- Icon containers: `rounded-xl` (w-7–w-11 size)

## Key Mobile-First Patterns

### Fixed Bottom Input Bar
The primary interaction anchor. Always accessible at thumb position.
```tsx
<div className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border"
     style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
  <div className="max-w-3xl mx-auto px-4 pt-3 pb-3">
    {/* magic-border input */}
  </div>
</div>
```
Main content requires `pb-36` to avoid content hiding behind bar.

### Horizontal Scrollable Chip Row (Time Filter)
No dropdown — chips for quick selection. Hidden scrollbar.
```tsx
<div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4">
  <button className="shrink-0 h-8 px-3.5 rounded-full text-sm font-medium ...">
```

### Sticky Header with Balance
Balance is the north star — always visible.
```tsx
<header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
```

### Transaction Cards
```tsx
className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 hover:bg-secondary/30 active:bg-secondary/50"
```

### USD Rate Row (per-transaction)
Appears when USD is selected:
```tsx
<div className="flex items-center gap-2 bg-chart-5/10 border border-chart-5/25 rounded-lg px-3 py-2">
  <DollarSign /> <span>1 USD =</span> <input .../> <span>ARS</span>
</div>
```

## Layout Structure
```
<div className="min-h-screen flex flex-col">
  <header sticky />
  <div className="flex-1 flex flex-col lg:flex-row">
    <main className="pb-36 lg:pb-8 max-w-3xl mx-auto" />
    {chatOpen && <aside fixed-right />}
  </div>
  <div fixed-bottom-input />
</div>
```
