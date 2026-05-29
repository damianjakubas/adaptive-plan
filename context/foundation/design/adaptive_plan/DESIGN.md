---
name: Adaptive Plan
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c5c9ac'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8f9378'
  outline-variant: '#444932'
  surface-tint: '#b0d500'
  primary: '#ffffff'
  on-primary: '#2a3400'
  primary-container: '#caf300'
  on-primary-container: '#596c00'
  inverse-primary: '#536600'
  secondary: '#c7c6c6'
  on-secondary: '#303031'
  secondary-container: '#464747'
  on-secondary-container: '#b6b5b5'
  tertiary: '#ffffff'
  on-tertiary: '#1b343d'
  tertiary-container: '#cde7f3'
  on-tertiary-container: '#506873'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#caf300'
  primary-fixed-dim: '#b0d500'
  on-primary-fixed: '#171e00'
  on-primary-fixed-variant: '#3e4c00'
  secondary-fixed: '#e4e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#cde7f3'
  tertiary-fixed-dim: '#b1cad7'
  on-tertiary-fixed: '#041e28'
  on-tertiary-fixed-variant: '#324a54'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-xl:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Montserrat
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  stats-display:
    fontFamily: Montserrat
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 40px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is engineered for a high-performance fitness environment. It targets motivated athletes and data-conscious users who value precision and momentum. The aesthetic is rooted in **Modern High-Contrast**, blending the deep blacks of elite performance gear with the electric intensity of neon accents.

The mood is professional yet aggressive—designed to evoke the atmosphere of a high-end, late-night boutique gym. By utilizing high-energy color pops against a dark, structured foundation, the UI creates a "command center" feel that motivates action and clarifies complex biometric data.

## Colors

The palette is dominated by deep blacks and charcoals to minimize eye strain during high-intensity workouts and to allow the primary accent to vibrate with energy.

- **Primary (Neon Lime):** Reserved exclusively for calls-to-action, progress indicators, and active states. It represents movement and completion.
- **Surface & Inputs:** Subtle shifts in grey levels provide depth without breaking the dark-mode immersion.
- **Text:** High-contrast white for critical information, with muted slate for labels and secondary metadata to maintain a clear visual hierarchy.

## Typography

Typography in the design system uses a dual-font strategy to balance power with readability. 

**Headlines** utilize **Montserrat** in bold and extra-bold weights. The tight letter spacing and heavy weights provide a "sturdy" feel reminiscent of athletic branding. For data visualization and key metrics, an italicized "Stats Display" style is used to imply speed and forward motion.

**Body text** and functional UI elements use **Inter**. Its neutral, highly legible glyphs ensure that workout instructions and data tables remain readable even when the user is in motion. Use uppercase labels for small navigation elements to maintain a technical, disciplined look.

## Layout & Spacing

This design system employs a **Fluid Grid** model with a hard 4px baseline rhythm. 

- **Desktop:** 12-column grid with 24px gutters. Content is typically centered in a maximum 1280px container.
- **Tablet:** 8-column grid with 20px gutters. 
- **Mobile:** 4-column grid with 16px gutters and 24px side margins to ensure touch targets remain clear of screen edges.

Vertical rhythm is strictly enforced using multiples of 4px. Use `stack-lg` (32px) to separate distinct content blocks and `stack-sm` (8px) for internal component spacing (e.g., a label and its input field).

## Elevation & Depth

Depth is achieved through **Glassmorphism** and tonal layering rather than traditional heavy shadows. 

1.  **Base Layer:** The deepest background level (`#0A0A0A`).
2.  **Surface Layer:** Cards and containers (`#1A1A1A`). These should use a subtle 1px border (`#333333`) to define their edges.
3.  **Floating Elements:** Modals and overlays utilize a backdrop blur (20px) with a semi-transparent fill (`#1A1A1A` at 80% opacity). 
4.  **Interactive Glow:** High-priority elements like active progress rings or primary buttons can utilize a soft, 20% opacity Neon Lime outer glow to simulate a light-emitting diode (LED) effect.

## Shapes

The shape language is consistently **Rounded**, providing a sophisticated, modern feel that softens the "aggressive" color palette. 

- **Standard Components:** Buttons, inputs, and small chips use a 12px (`0.75rem`) radius.
- **Container Elements:** Large cards and section wrappers use a 16px (`1rem`) radius.
- **Data Points:** Progress bars should have fully rounded (pill-shaped) caps to emphasize fluidity and movement.

## Components

- **Buttons:** Primary buttons feature a solid Neon Lime background with black text for maximum contrast. Secondary buttons use an outlined style with white text.
- **Cards:** Utilize the Surface color with a subtle glass effect when overlaid on photography. Cards should have a padding of 24px to ensure data doesn't feel cramped.
- **Input Fields:** Backgrounds set to `#262626` with no top/left/right borders—only a thick 2px bottom border that glows Neon Lime when focused.
- **Progress Rings:** Use a thick stroke for the primary metric. The "track" of the progress bar should be `#333333`, while the "fill" is the primary accent.
- **Chips/Badges:** Small, uppercase text inside a pill-shaped container with a subtle dark-grey fill. Used for categorizing workout types (e.g., STRENGTH, CARDIO).
- **Data Lists:** Rows should be separated by a 1px border (`#333333`) with a hover state that slightly lightens the background to `#222222`.