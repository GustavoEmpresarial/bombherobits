# Header and shortcut dock refresh

The game header now uses matching plates, a single-line demo badge, readable balance text, a legible hero-card counter and new illustrated chest/settings controls. Discord remains a text-only disabled button until its official URL is available. Token purchase is also disabled pending its official link.

The bottom dock is centered, with larger illustrated icons, visible labels, hover/focus feedback and a distinct active state. All existing destinations and game actions remain intact. Responsive layouts were reviewed at 1280, 800 and 390 CSS pixels, including lobby, settings and dungeon headers. The dock stays in normal layout flow and never covers page controls.

Nine original transparent PNG artworks were created separately with the built-in ImageGen tool and are preserved in `art-source/navigation-v2/`. The existing Ember Nook artwork supplies the house icon. Browser assets are in `apps/web/public/ui/v2/`: 256px nearest-neighbor thumbnails encoded as lossless WebP with alpha preserved. The complete icon set is about 600 KiB instead of shipping full-resolution artwork to navigation controls. Every thumbnail was decoded and compared with its resized source to verify lossless encoding.

Exact generation prompts are recorded in [navigation-v2-prompts.json](navigation-v2-prompts.json).

Validation: frontend production build; browser checks for settings, recovery-house and chest navigation; all new image paths; visible active states and keyboard focus; responsive lobby/settings/dungeon layouts. The generation pipeline does not alter the game logo or character sprites.
