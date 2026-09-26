# Dr. Gupet visual system — initial approved direction

This is the frontend visual contract for the current design pass. The owner supplied the logo and two exact colors. Other values below are implementation defaults for local preview and can be refined after visual review; they are not claims about a pre-existing brand manual. Build within `Roadmap-Frontend.md` F1 and preserve DEC-002's functional boundaries.

## Brand inputs and references

| Input | Use |
|---|---|
| Owner-supplied cat/dog/bird circular logo at `frontend/public/brand/logo.jpg` | Currently used in the shell and as a missing-product image placeholder. Retain its aspect ratio; provide meaningful alt text where it conveys brand identity. The supplied JPEG has a white background, so do not fake transparency by CSS masking. |
| `#122F12` | Primary deep green for headers, primary actions, and high-emphasis text. |
| `#D49F28` | Gold for brand accents, selected states, small highlights, and call-to-action emphasis. Verify text contrast for each pairing. |
| Vazirmatn | Persian UI typography. The current implementation imports the self-hosted `@fontsource/vazirmatn` weights 400/500/600/700 from `src/main.tsx`. The installed package includes `LICENSE` under SIL OFL 1.1; keep that notice available with distributed font files. |
| [Pinterest reference](https://pin.it/1HCMP1oPz) | Composition and image-led pet-commerce direction. Recreate the layout; the pin image itself is not a production asset. |
| [21st.dev](https://21st.dev), [MotionSites AI](https://motionsites.ai), [MotionSite](https://motionsite.ai) | Study cards, buttons, navigation, and motion. Inspect the exact component's terms and dependencies before any reuse. |

The Pinterest reference was visually reviewed in a browser: its useful composition is a premium cream/forest-green pet storefront with a large pet-focused hero, circular categories, product cards, promotional bands, reviews, trust section, and dark footer. Translate these patterns into original Dr. Gupet layouts and artwork. Do not import its imagery, copy, or branding.

## Asset provenance (current local implementation)

| Local asset | Source and rights | Current use |
|---|---|---|
| `frontend/public/brand/logo.jpg` | Owner-provided `C:\Users\ISATIS\Desktop\photo_2026-09-25_16-38-07.jpg`; the committed-worktree copy matches the supplied file's SHA-256. Confirm the operator's publication rights before public release. | Header, footer, product fallback. |
| `frontend/public/brand/dog-portrait.jpg` | [Golden Retriever by Victor G](https://unsplash.com/photos/golden-retriever-x5oPmHmY3kQ), [Unsplash License](https://unsplash.com/license). Commercial use permitted under a nonexclusive license; attribution appreciated, not required by that license. | Home hero and dog category. |
| `frontend/public/brand/cat-portrait.jpg` | [White cat by EJ Li](https://unsplash.com/photos/a-white-cat-looking-at-the-camera-franiroBVNA), [Unsplash License](https://unsplash.com/license). Commercial use permitted under a nonexclusive license; attribution appreciated, not required by that license. | Home hero and cat category. |
| Vazirmatn font files bundled by `@fontsource/vazirmatn` | [Vazirmatn SIL OFL 1.1](https://github.com/rastikerdar/vazirmatn/blob/master/OFL.txt); the package's license and copyright notice is copied unchanged to `frontend/public/licenses/Vazirmatn-OFL.txt`. | All frontend typography through local bundle imports; `/licenses/Vazirmatn-OFL.txt` in the built site. |

The stock portraits remain the photographers' work. Do not describe them as Dr. Gupet-owned or reuse them in an exclusive brand claim. Verify that the required font notice is present in every deployed build; the local build now copies it from `public/licenses/`.

## Interface foundation

- `lang="fa"` and `dir="rtl"` at document root. Use CSS logical properties for spacing and borders. Isolate Latin SKUs, URLs, order numbers, and phone numerals where reading order would otherwise break.
- Use a light, calm canvas so product images and green actions remain clear. Define colors as CSS custom properties (background, surface, ink, muted ink, border, primary, primary hover, accent, focus, error, success) rather than spreading hex values through components. Derive secondary colors deliberately from the two owner-provided anchors and test contrast before release.
- Design mobile-first at 360 px, then tablet and desktop. The page shell should keep a clear product search, category navigation, cart/session entry points, and a usable mobile navigation. Use content-driven wrapping; avoid clipping long Persian titles or price labels.
- Build image-led hero/banner and product sections with responsive ratios, safe text placement, appropriate `object-fit`, and reserved dimensions to reduce layout shift. Product images need item-specific alt text; decorative imagery uses empty alt. Keep the provenance table current when adding or replacing stock images.
- Buttons and form controls need visible hover, focus, disabled, pending, invalid, and success/error states. Gold must not be the only indicator of selection or stock. Preserve the existing loading/empty/error/retry behavior while changing appearance.
- Motion should communicate hierarchy or feedback: short entrance and hover transitions, no autoplay that blocks content, no scroll-jacking. Disable non-essential transitions under `prefers-reduced-motion: reduce`; maintain equivalent information without animation.
- Use semantic HTML before ARIA. Modal/drawer interactions need focus management and Escape close; tabs need keyboard behavior; toasts must not hide critical error text. Check tap targets, keyboard-only flow, readable contrast, and zoom at 200%.

## Privacy and attribution in the visual layer

- Show the English floating first-visit cookie notice per DEC-011, scoped with `lang="en"` and `dir="ltr"` inside the Persian RTL shell. Place Accept and Deny side by side with equal visual weight; no settings, Save control, footer privacy link, or `/privacy` page in the local preview. Neither choice enables tracking; any future non-essential service needs a new disclosure and consent flow before its script loads. Persistent privacy disclosures remain a public-release gap.
- Document that authentication persistence currently uses a refresh token in local storage per DEC-003; never display or log the token. Avoid third-party fonts, embeds, trackers, or scripts that send visitor data without a reviewed purpose and consent path.
- The copyright line may claim only original Dr. Gupet material. Place license credits or links wherever the specific asset terms require; maintain an asset inventory in the implementation handoff.

## Visual acceptance

Review the local preview at 360 px, 768 px, and a desktop width; inspect RTL flow, long Persian copy, empty/error/loading states, contrast, keyboard focus, reduced motion, image quality, and privacy/rights entry points. Present it to the owner before any commit or push. Passing code tests alone does not establish visual acceptance.
