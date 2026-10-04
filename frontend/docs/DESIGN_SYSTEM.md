# Dr. Gupet visual system — owner-approved direction, refinements under review

This is the frontend visual contract for the current design pass. The owner supplied the logo and two exact colors. Other values below are implementation defaults for local preview and can be refined after visual review; they are not claims about a pre-existing brand manual. Build within the frontend development path (root `README.md` «مسیر توسعه») and preserve DEC-002's functional boundaries.

## Brand inputs and references

| Input | Use |
|---|---|
| Owner-supplied cat/dog/bird circular logo at `frontend/public/brand/logo.jpg` | Currently used in the shell and as a missing-product image placeholder. Retain its aspect ratio; provide meaningful alt text where it conveys brand identity. The supplied JPEG has a white background, so do not fake transparency by CSS masking. |
| `#122F12` | Primary deep green for headers, primary actions, and high-emphasis text. |
| `#D49F28` | Gold for brand accents, selected states, small highlights, and call-to-action emphasis. Verify text contrast for each pairing. |
| Vazirmatn | Persian UI typography. `src/main.tsx` imports `src/styles/fonts.css`, which loads weights 400/500/600/700 from versioned files in `public/fonts/vazirmatn/`. These are copied unchanged from `@fontsource/vazirmatn` 5.3.0 and include WOFF2 and WOFF fallback. Keep the SIL OFL 1.1 notice available with distributed font files. |
| [Pinterest reference](https://pin.it/1HCMP1oPz) | Composition and image-led pet-commerce direction. Recreate the layout; the pin image itself is not a production asset. |
| [21st.dev](https://21st.dev), [MotionSites AI](https://motionsites.ai), [MotionSite](https://motionsite.ai) | Study cards, buttons, navigation, and motion. Inspect the exact component's terms and dependencies before any reuse. |

The Pinterest reference was visually reviewed in a browser: its useful composition is a premium cream/forest-green pet storefront with a large pet-focused hero, circular categories, product cards, promotional bands, reviews, trust section, and dark footer. Translate these patterns into original Dr. Gupet layouts and artwork. Do not import its imagery, copy, or branding.

## Current redesign candidate (2026-10-01)

- The main landing page opens with one clear choice and short copy, then routes product, medicine and care-center needs to their own pages. Large Persian headings, generous spacing, existing licensed pet portraits and restrained gold accents carry the visual hierarchy.
- The site and admin panel support light and dark modes with a compact sun/moon control. The stored value is only the appearance choice; it must never include authentication or consent data.
- On mobile, the top bar keeps the hamburger menu beside the logo and shows a separate search icon beside the cart. Search opens its own field outside the menu; the hamburger contains the page links, including medicine, pharmacies and clinics. The account entry lives in the bottom navigation, and the theme control floats above that bar at the physical left edge. On desktop, search and account stay in the header and the theme control still floats at bottom left.
- Existing `src/styles/tokens.css`, `globals.css`, `filters.css` and `ui.css` own the site styling. The temporary `redesign.css` experiment was removed after its rules were integrated. No design-skill files or downloaded reference components belong in this repository.
- On narrow screens the product filters sit behind a labeled disclosure button so the search and results remain near the top. Searchable option lists still accept typing and selection by keyboard or pointer.
- Hover and arrival motion is subtle and reversible, with reduced-motion coverage. Do not animate a large page section until its content becomes available; loading/error states remain visible without animation.
- The owner approved the overall redesign on 2026-10-02 and requested these navigation, theme and live-only refinements. The refinements still need local review before commit or publication.
- On 2026-10-03, the owner approved the overall design again and requested dark header contrast and more original imagery. The hamburger uses the dark foreground token, and the cart keeps its gold accent in both themes. Discovery images cover the entire section behind a theme-aware scrim, with a restrained static 2px blur. Pointer hover or keyboard focus on a link crossfades the background; mobile links navigate on the first tap. Separate image boxes and thumbnails were removed at the owner's request. The lower dog/cat cards use original generated scenes distinct from the hero portraits. All internal customer routes have a brief shared entry fade, disabled for reduced motion; query-only filtering does not replay it.

## Asset provenance (current local implementation)

| Local asset | Source and rights | Current use |
|---|---|---|
| `frontend/public/brand/logo.jpg` | Owner-provided asset; the committed copy matches the supplied file's SHA-256. Confirm the operator's publication rights before public release. | Header, footer, product fallback. |
| `frontend/public/brand/dog-portrait.jpg` | [Golden Retriever by Victor G](https://unsplash.com/photos/golden-retriever-x5oPmHmY3kQ), [Unsplash License](https://unsplash.com/license). Commercial use permitted under a nonexclusive license; attribution appreciated, not required by that license. | Home hero only. |
| `frontend/public/brand/cat-portrait.jpg` | [White cat by EJ Li](https://unsplash.com/photos/a-white-cat-looking-at-the-camera-franiroBVNA), [Unsplash License](https://unsplash.com/license). Commercial use permitted under a nonexclusive license; attribution appreciated, not required by that license. | Home hero only. |
| `frontend/public/brand/discovery-{medicine,pharmacy,clinic}-{480,960}.webp` | Created with the built-in OpenAI image generation tool on 2026-10-03 at the owner's request. Original generated illustrative artwork; fictional unbranded objects/venues, not photographs of listed products or actual care centers. Source PNGs retained outside the repository; these WebP variants are resized/compressed exports. Prompts below. | Decorative full-section discovery backgrounds; no external image requests. |
| `frontend/public/brand/companion-{dog,cat}-960.webp` | Created with the built-in OpenAI image generation tool on 2026-10-03 at the owner's request. Original generated decorative scenes, not actual listed animals. Source PNGs retained outside the repository; 960×720 WebP exports at quality 82. Prompts below. | Lower companion cards only, distinct from hero portraits. |
| Vazirmatn files from `@fontsource/vazirmatn` 5.3.0 | [Vazirmatn SIL OFL 1.1](https://github.com/rastikerdar/vazirmatn/blob/master/OFL.txt); the package's license and copyright notice is copied unchanged to `frontend/public/licenses/Vazirmatn-OFL.txt`. | All frontend typography through `/fonts/vazirmatn/`; `/licenses/Vazirmatn-OFL.txt` in the built site. |

The stock portraits remain the photographers' work. Do not describe them as Dr. Gupet-owned or reuse them in an exclusive brand claim. Verify that the required font notice is present in every deployed build; the local build now copies it from `public/licenses/`.

### Generated discovery artwork — prompt set (2026-10-03)

Built-in `image_gen` was used for three separate assets, with an opaque background. Each output was exported to WebP at 480×360 and 960×720, quality 82, without changing the scene. Full generation prompts:

- **Medicine:** Use case: product-mockup. Create an original premium editorial photograph for a Persian pet-care website's veterinary medicine information card. Wide 4:3 composition. A few unbranded amber veterinary medicine bottles, one plain blister pack and a clean small measuring syringe without needle arranged on warm limestone; subtle deep forest green background and restrained golden sunlight. Refined realistic materials, shallow depth of field, calm professional mood. No text, no logos, no readable labels, no watermark, no people, no claims about any real medicine. The objects should be recognisable at small card size, with generous clean composition. This is decorative illustrative artwork, not a real product listing.
- **Pharmacy:** Use case: photorealistic-natural. Create an original premium editorial photograph for a Persian pet-care website's pharmacy directory card. Wide 4:3 composition. Interior of a fictional elegant veterinary pharmacy: neat shelves of unbranded plain containers and boxes, warm stone counter, subtle deep forest green cabinetry and brass accents, soft daylight, welcoming quiet atmosphere, realistic textures. A small pet carrier sitting discreetly beside the counter establishes veterinary context. No people, no text, no logos, no readable product labels, no watermark, no identifiable real business. Architectural photography, refined and uncluttered, instantly readable at small card size. Decorative illustrative artwork.
- **Clinic:** Use case: photorealistic-natural. Create an original premium editorial photograph for a Persian pet-care website's veterinary clinic directory card. Wide 4:3 composition. A healthy relaxed ginger cat resting on a clean examination table inside a fictional modern veterinary clinic. Soft daylight, warm off-white walls, subtle forest green cabinet and minimal brass detail, a stethoscope neatly set aside, realistic fur and calm caring atmosphere. No humans, no procedures, no needles, no text, no logos, no watermark, no identifiable real clinic. Premium architectural/lifestyle editorial photography, uncluttered and readable at small card size. Decorative illustrative artwork.

### Generated companion artwork — prompt set (2026-10-03)

- **Dog:** Generate an original premium editorial photograph for a Persian pet-care storefront companion section. A healthy cream-colored Labrador walking calmly in a sunlit olive grove beside a natural limestone path, gentle candid side profile, entire head and body visible, leaves in soft foreground, subtle warm gold light and forest green palette. Landscape composition 4:3, calm quiet luxury photography, realistic anatomy and natural fur, no person, no text, no logos, no products, no collage. Distinct from a studio pet portrait. It is decorative artwork, not a real listed animal.
- **Cat:** Generate an original premium editorial photograph for a Persian pet-care storefront companion section. A healthy silver tabby cat stretching comfortably on a sunlit cream linen windowsill, houseplants and subtle deep green wall behind, candid three-quarter side composition with full head and torso, warm afternoon light, quiet luxury photography with natural fur and realistic anatomy. Landscape composition 4:3, no people, no text, no logos, no products, no collage. Distinct from a studio pet portrait and from a veterinary clinic scene. It is decorative artwork, not a real listed animal.

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
