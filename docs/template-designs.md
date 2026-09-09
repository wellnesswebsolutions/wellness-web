# BrightSite presentation systems

These are original BrightSite implementations, not exports or redistributed
Framer projects. The reference sites informed broad visual direction only;
their code, components, text, branding and photography are not bundled.

| Picker name | Direction | Reference studied |
| --- | --- | --- |
| Minimal | Quiet split hero, information column, large portfolio cards | Kima |
| Soft | Centred introduction, rounded bento cards, generous spacing | Nouris |
| Serene | Cinematic hero, flowing section edges, light serif type | Serena Yoga |
| Organic | Grounded split panels, layered cards, native swipe gallery | YogaGrove |
| Editorial | Oversized centred type, feature card, asymmetric photo essays | Stillnes |
| Noir | Image navigation panels, refined contrast, serif headlines | Qitchen |
| Perspective | Rounded split hero, editorial type, scroll-driven showcases | Perspectiva |
| Luxe | Existing sculpted imagery and soft reveals, retained | Existing BrightSite |

The internal `bold` and `kinetic` IDs remain for compatibility; their picker
names are now Noir and Perspective. Category data and page labels are selected
by `demoContentForCategory`, independently of these visual styles.

Every design retains three views: home, category services/pricing and contact.
The shared content includes six gallery demos, three labelled sample reviews,
opening hours and a location map. No unsupported qualifications, client counts
or statistics were imported from the references.

Hero photographs retain their complete 16:9 composition with `object-fit:
contain`. Split layouts keep text outside the image. Overlay layouts protect
the upper 54%; oversized copy moves below and switches to readable colours.
Only ordinary gallery images receive hover/scroll effects, never the 3D logo.

All surfaces use the shared palette variables. Explicit font choices also
update buttons. Appearance changes preserve the live document and scroll
position. Reduced-motion preferences disable reveals and replace the moving
Perspective showcase with a regular grid.

## Checks

- `npm run test:builder`: live builder controls, font/palette updates without
  reload, scroll preservation, real composited hero, eight-layout screenshots,
  desktop/phone preview sizing, mobile navigation, all three pages, Noir image
  navigation and Perspective scroll motion. Lead/email calls are intercepted.
- `npm run test:templates`: offline matrix of every business category across
  eight designs at desktop and mobile sizes, checking content, prices, maps,
  gallery/review counts, horizontal overflow and the protected hero area.
