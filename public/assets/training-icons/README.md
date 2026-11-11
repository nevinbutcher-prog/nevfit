# NevFit Training UI icon assets

Twenty transparent, standalone SVGs in `public/assets/training-icons/`, corresponding to the general UI icon reference sheet from the Training redesign discussion. **No exercise/machine pictograms are included.**

## Inventory
`dashboard`, `dumbbell`, `rob-profile`, `program-layers`, `workout-template`, `calendar`, `plus`, `play`, `arrow-left`, `chevron-right`, `more-vertical`, `edit`, `archive`, `copy`, `move-to-program`, `info`, `delete`, `sets`, `repeat`, `timer`.

## Usage
Each file is a viewBox `0 0 24 24`, transparent background, stroke-based SVG with emerald `#34d399` and occasional white `#f8fafc` accents. Reference as `/assets/training-icons/<name>.svg`, for example `<img src="/assets/training-icons/program-layers.svg" alt="" aria-hidden="true" />` next to an already-labelled program item. Use a meaningfully descriptive `alt` on icon-only controls; ensure keyboard/focus and sufficiently large tap targets.

The asset pack is inspired by the approved visual mockups but built as clean vector UI icons rather than cropped raster imagery. Use selectively; do not decorate every item with a redundant icon. General UI icons only. Exercise metadata images should continue to use the existing catalogue/provider mechanism, not generated pictograms.

## UI direction (not an implementation instruction)
The approved conceptual direction is Training with Workouts/Programs sections, independent reusable workouts, optional programs and a significantly improved workout summary/editor. **Remove explanatory banners** such as “Workouts are independent” and “Programs are optional” from mockups. Keep the existing user-facing experience unchanged until its separate implementation checkpoint; respect architecture/migration review and user approval gates.
