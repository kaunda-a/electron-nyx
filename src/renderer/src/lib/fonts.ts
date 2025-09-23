/**
 * List of available font names (visit the url`/settings/appearance`).
 * This array is used to generate Tailwind's `safelist` inside 'tailwind.config.js' and 'appearance-form.tsx'
 * to prevent dynamic font classes (e.g., `font-inter`, `font-manrope`) from being removed during purging.
 *
 * 📝 How to Add a New Font:
 * 1. Add the font name here.
 * 2. Update the `<link>` tag in 'index.html' to include the new font from Google Fonts (or any other source).
 * 3. Add new fontFamily 'tailwind.config.js'
 *
 * Example:
 * fonts.ts           → Add 'roboto' to this array.
 * index.html         → Add Google Fonts link for Roboto.
 * tailwind.config.js  → Add the new font inside `theme.extend.fontFamily`.
 */
export const fonts = ['inter', 'manrope', 'system'] as const
