# Dr. Gupet — complete polish and verification report

Local review candidate, 11 October 2026. Applies the Emil design engineering, Apple design and Dr. Gupet frontend design skills; neither Apple nor Emil personally reviewed this project. This report replaces the early design proposals, including the cancelled dog-eye prototype.

The owner's subsequent landing structure is implemented in the 13 October candidate. See [LANDING_REBUILD_REPORT](LANDING_REBUILD_REPORT.md) for the current banner, species illustrations, four compact carousels, admin draft editor, latest verification and unresolved backend publishing contract. The landing descriptions below remain dated history of the earlier candidate.

## Result and scope

The customer interface and admin have been reviewed across every route family and shared control family. Work keeps the existing React/NestJS monorepo, Persian RTL, brand green/gold, self-hosted Vazirmatn, accepted authentication, central API clients, server-authoritative money and privacy choices. No animation library, tracker, analytics vendor or new runtime dependency was added.

The hero now contains one original shared scene with dog, cat and bird together. It no longer contains separate animal photo tiles, cursor-following eyes or competing decorative rings. Both hero actions are visibly clickable. Account routes keep one context navigation row; duplicated profile shortcut cards and redundant account destinations in the global shop navigation were removed. Authentication has clear registration/recovery/back actions and eye/eye-off icons.

Admin now distinguishes selected-period facts from current operational work. Paid/processing/shipped queues, inventory attention, payment failures and recent orders lead to actual filtered destinations. Registered customer counts exclude administrators. Order-item rankings include all order statuses and are labelled accordingly; they do not pretend to be paid best-seller statistics. Broader behavioral analytics are a backend handoff, not fabricated UI numbers.

The source baseline was freshly fetched from GitHub `main`, revision `a1525fa5eb71cfba796b7efda187a3521d7dab07`. Extensive pre-existing local changes were preserved, with an external checkpoint before implementation. This candidate is still uncommitted. No push, PR, publication or VPS deployment occurred. Owner approval is required by root AGENTS.md before those actions.

## Visual system, typography and copy

| Before | After | Why / implementation |
| --- | --- | --- |
| Dog-only hero, then separate cat/bird tiles in a first interpretation | One continuous scene containing all three animals, with reserved 5:4 geometry and responsive 640/1280 WebP assets | Implements the owner's clarified composition; no collage or separate portraits. `HomePage`, `globals.css`. |
| Bare underlined “انتخاب مسیر” | Outlined rounded secondary action beside gold “کشف محصولات” | Makes the action discoverable while preserving one primary choice. |
| Long/competing homepage invitations and decoration | Shorter lead and headings; distinct journey, companion, real products, care-information and closing sections | Each section has a clear job; no fabricated merchandise or trust claims. |
| Dogs/cats only in companion presentation | Persian dog/cat/bird cards using actual active API type IDs | Missing data produces an honest unavailable state and retry, never guessed IDs. |
| Heading weights above the bundled fonts, tight Latin-style Persian tracking | Bundled 400/500/600/700 weights, natural Persian tracking, balanced wrapping, readable leading and smaller mobile hierarchy | Avoids synthesized weight and crowded Persian shapes. |
| Repeated arbitrary colors and durations | Semantic hero/state/motion tokens, clear action and body roles | Keeps the owner brand while making themes and controls consistent. |
| Forest-green dialog headings on dark paper | Dark dialog headings use the ink token | Selected opaque contrast improves from 1.09:1 to 14.43:1. |
| Weak admin table annotations | Muted text uses a readable semantic foreground | Selected light pairs measure 5.11:1 on white and 4.67:1 on canvas. |
| Gold/forest selection foreground inherited incorrectly in dark mode | Theme-aware selected text foreground | Selection remains readable against its background. |
| Blurred surfaces with no dedicated material alternatives | Solid reduced-transparency surfaces and stronger increased-contrast boundaries | Accessibility preferences keep the content understandable. |
| Registration, recovery and back-to-site look like plain text | Bordered 44–48px controls with visible hover/focus | Familiar action affordances in both themes. |
| Text password-visibility controls outside fields | Inset eye/eye-off native buttons, 44px targets, Persian aria-label, pressed state, input relationship | Matches the owner's requested convention while keeping keyboard/screen-reader semantics. |
| Browser file picker shows English chooser/no-file copy | Persian image-choice button and filename state backed by the existing file input | File validation/upload contract preserved; same-file retry supported. |
| Profile repeats links in global navigation, account tabs and shortcut cards | Global shop navigation plus account entry; one AccountNav in account pages; shortcut card grid removed | Reduces navigation clutter and brings useful profile controls closer. |
| Admin moon stroke is clipped or partially hidden | Full crescent inside viewBox, visible SVG stroke | Consistent theme icon in light/dark appearance. |
| Cart badge and accessible name retain Latin counts | Existing Persian number formatter used for both mobile and desktop | Consistent localized presentation; quantities and API numbers remain unchanged. |
| Operations appear as underlined words with unclear purpose | Bordered action rows with count, explanation, “بررسی”, chevron and focus ring | Shows both the business condition and the next task. |
| Internal issue/implementation jargon in product-facing notices | Plain Persian guidance describing the next action | Technical diagnosis remains in reports/issues. |

Selected opaque foreground/background checks were calculated with the WCAG relative-luminance formula. These are token-pair measurements, not certification of every image overlay or rendered state. [WCAG contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) specifies 4.5:1 for ordinary text and 3:1 for large text.

| Foreground / surface | Ratio |
| --- | --- |
| Customer body `#1B291B` / cream `#FCF9F1` | 14.47:1 |
| Customer muted `#596859` / cream | 5.62:1 |
| Dark ink `#F2F5EF` / paper `#19251C` | 14.43:1 |
| Dark muted `#B9CBB7` / dark paper | 9.29:1 |
| Hero ink `#F8F6EE` / forest `#102914` | 14.38:1 |
| Hero lead `#D9E3D5` / forest | 11.78:1 |
| Hero accent `#E4C67F` / forest | 9.40:1 |
| Action ink `#122F12` / gold `#D49F28` | 6.10:1 |
| White / forest primary action | 14.57:1 |
| Error `#A62424` / white | 7.24:1 |
| Dark error `#FFB4A9` / dark paper | 9.34:1 |

Headings and body copy were reviewed for hierarchy, length, truthful scope and Persian phrasing across home, catalog/detail, medicine/care, authentication, account/addresses/pets/recommendations, cart/checkout/orders/payment, and admin route families. Numeric prices/pages/counts use Persian presentation where appropriate; IDs, credentials and API identifiers remain code-native. Diet/allergy copy describes recorded evidence rather than claiming clinical suitability.

## Motion and graphic polish

| Before | After | Why |
| --- | --- | --- |
| Hero/section reveal takes 700–850ms and 28px travel | One quiet 360ms hero introduction with 8px travel; ordinary UI 120/180/220ms tokens | Reduces time spent waiting for content; preserves a restrained first impression. |
| Sections can be hidden until a scroll observer reveals them | Home content is visible independently of reveal observers | Loading/errors and navigation never depend on decorative motion. |
| Repeated hover lifts of 7px and long image zooms | Smaller ~2px pointer lift or surface/border response, 180ms reversal | Repeated shopping interactions feel stable. |
| Hover/press movement can jump despite reduced-motion setting | Movement gated by fine pointer, hover support and no reduction; reduced motion removes transforms | Near-zero duration alone is insufficient. |
| Keyboard routes/discovery state replay animated changes | Keyboard route/discovery changes remain immediate | Frequency and input method determine whether motion earns its cost. |
| Shared buttons have inconsistent press response | Subtle 0.98 pointer press or immediate surface change; visibility icons remain position-stable | Gives clear feedback without moving labels unpredictably. |
| Abrupt occasional care drawer dismissal | Retained short exit with keyboard/reduced-motion instant equivalent | Preserves spatial context for occasional pointer edits. |
| Zero sales shown as a small positive/minimum bar | Zero stays at baseline; positive values retain proportionality | Graphic truth precedes decorative animation. |
| Single sales point fills the chart as a giant rectangle | Centered bar track capped at 48px | Preserves proportional height while keeping a sparse dataset legible. |
| Modal content depends on generic browser confirmation | Contextual accessible dialogs with modest entrance and prompt dismissal | Makes destructive decisions understandable. |
| Broken media leaves browser image icons | Shared SafeImage fallback retains geometry and accessible description | Predictable graphics under actual loading failures. |

The unified hero and bird artwork were created with the built-in OpenAI image generation tool. They are fictional decorative scenes, not actual venue/pet/product photographs. Exact prompts, saved WebP paths, sizes and original/stock asset rights are recorded in [DESIGN_SYSTEM](DESIGN_SYSTEM.md). Stock originals and font license were preserved.

## Customer workflows and shared components

| Before | After | Why / scope |
| --- | --- | --- |
| Cart coupon disappears on checkout | Carry exact code text in identity-scoped RAM; checkout revalidates | Preserves intent without trusting a previous discount. |
| Address creation interrupts checkout | Exact allowlisted return to checkout, draft preserved, new address selected | Avoids reconstructing the purchase. |
| Checkout cannot add another address once one exists | Add-address action available next to selector | Places the action where it matters. |
| Quantity writes every keystroke and cannot be cleared naturally | Local quantity draft; blur/Enter/update commit, 44px +/−, invalid restore and serialized writes | Natural editing and stock-safe submission. |
| First unavailable variant selected automatically | First available variant is the default unless shopper chose explicitly | Avoids false unavailability. |
| Dense variant radios mix price/stock/weight at same emphasis | Compact selectable weight tiles with dominant current price and subordinate stock | Improves scan order without removing purchase facts. |
| No larger product-image inspection | Accessible dialog with close/Escape/focus return | Optional useful detail rather than decorative complexity. |
| Favorite button lacks pressed state and distinct status | Pressed state, pending lock, status/error channels | Clear saved-state semantics. |
| Favorite removal has no restoration path | Server-backed Undo where restoration is supported, focus and feedback retained | Forgiving reversible action. Cart uses confirmation/feedback instead of unsafe guessed Undo. |
| Payment-result cancellation skips contextual confirmation | Same contextual async confirmation as order detail | Consistent consequential action. |
| Confirmation closes before real mutation completes | Dialog awaits write, locks duplicate/close while pending, retains error and retry | Actual completion determines dismissal. |
| Account shell disappears on loading/error | Navigation/title stay visible with local loading/retry | Wayfinding survives network failure. |
| OTP number-change loses checkout/order destination | Preserve sanitized next and OTP mode | Resumes the intended flow. |
| Recovery “back to login” opens registration | Back action now returns to password mode; regression added after real browser check | Fixes a concrete navigation bug discovered in normal interaction. |
| Errors stay stale after correction; first failure has no focus | Revalidate edited fields after first submit; focus first invalid input | Guides correction near the problem. |
| Password errors only below entire form | Field-associated current/new/confirmation messages and service alert | Keeps explanations actionable. |
| Profile/address/pet fields editable while writes pending | Lock relevant inputs during save/upload | Avoids silently overwriting visible later edits. |
| Failed upload of the same file cannot be retried | File chooser resets selection and allows same-file retry | Keeps failure recovery usable. |
| Gregorian date entry unexplained | Explicit calendar hint plus Jalali preview; stored contract preserved | No guessed conversion or new date dependency. |
| Stored pet date cannot be cleared with supported null contract | Frontend sends null for clearing, omits date when unchanged | Separately verified earlier local backend contract; see handoff. |
| Allergy/diet references absent or unclear | Actual ALLERGEN pet tags and DIET product filters with Persian labels, clear empty/error/retry | No fake options or invented medical recommendations. |
| Recommendations imply blanket suitability | Item reasons use actual matchedTags and stored species/tag facts | No unsupported clinical promise. |
| Active filter option scrolls out of view | Keyboard Home/End/arrow selection keeps active option visible | Matches combobox semantics. |
| Pagination uses Latin digits and retained rows can appear fresh | Persian numerals, local updating indicator and action locks | Clarifies which result set is usable. |
| Later empty orders/recommendation pages claim no history/profile | Accurate page-empty copy and first-page recovery preserving query/pet | Distinguishes no records from out-of-range pagination. |
| Detail loading/error removes title and return route | Stable medicine/pharmacy/clinic heading, backlink and retry | Preserves location even with invalid ID or failed request. |
| Initial JS chunk is 551.89kB with size warning | Lazy route modules and accessible error/loading boundary; shell retained | Splits occasional routes; no new architecture library. Real network metrics remain unmeasured. |
| Separate-origin local API complicates image/auth preview | Existing same-origin `/api/v1` contract via Vite `/api` + `/uploads` proxy | Development-only target override supports source API; does not configure production. |

## Admin productivity and correctness

| Before | After | Why / scope |
| --- | --- | --- |
| Sales cards dominate overview but next task unclear | Paid/processing/shipped queues, inventory/payment attention, recent order detail links and refresh | Moves from observation to a useful next action. |
| Period/current statistics can be confused | Explicit selected-period sales/registrations and current operational scopes | Prevents misleading comparison. |
| Registered “users” includes admins | Selected-period customer registration count excludes administrator accounts | Measures the intended population. |
| All-status ordered items called “best-selling” | “اقلام سفارش‌ها” with all-status disclosure | Existing backend includes cancelled/unpaid orders; no false paid-sales claim. |
| Operational text looks like an underlined label | Distinct clickable row with “بررسی”, explanation, count and chevron | Makes destination and task recognizable. |
| “همهٔ سفارش‌ها” inherits a native blue underlined link | Bordered semantic secondary action with 44px target | Matches the dashboard action hierarchy. |
| Closed mobile drawer contributes horizontal scroll | Dedicated clipped drawer viewport with existing focus/inert behavior retained | Contains offscreen motion without hiding unrelated layout problems. |
| Report grid expands to wide-table minimum width | Zero minimum grid/card widths; tables scroll inside their own wrappers | Preserves data access without stretching the page. |
| Admin section exists only in component state | Allowlisted URL fragments/history, contextual draft departure guard | Addressability with RAM-only authentication preserved. |
| Browser Back cancel can leave history inconsistent | Managed history indices restore the prior entry; queued traversal retained through confirmation | Consistent user navigation. |
| Skip link can accidentally route a fragment | Focus main content without changing application section | Keyboard accessibility without side effects. |
| Mobile section selection returns focus to old trigger | Focus new content after selection | Aligns focus with the selected task. |
| Credential/coupon/care/catalog validation shown globally or English native bubbles | Persian per-field errors, required semantics, first-invalid focus and localized numeric handling | Fast correction in the administrator's language. |
| Persian/Arabic digits rejected | Normalize integer input; explicit bounded coordinate decimal handling | Localized input retains business validation. |
| Closed coupon editor can reopen after response | Originating editor generation owns completion; selection/pending guards | Later user action stays authoritative. |
| Multiple editors may be marked saved by one editor's close | Scope draft owner clearing by region and target | Preserves independent unsaved user/create/detail drafts. |
| Cancellation reason does not map to note field dirty owner | Reason/note bookkeeping corrected | Protects the actual cancellation draft. |
| Stale retained rows can still be edited | Busy/pending locks and response-generation guards | Reduces races under filtering and slow responses. |
| Write buttons can duplicate requests | Immediate synchronous locks before async writes | Durable UI concurrency; does not replace backend transactional acceptance. |
| Generic confirmation used on ordinary status changes | Contextual confirmation for destructive cancellation; ordinary writes show pending/completion | Keeps meaningful confirmations useful. |
| Wide tables expose every column on mobile | Prioritize identity/status/main action; retain secondary detail access | Less friction on narrow screens. |
| Credential visibility text button and clipped theme icon | Inset accessible eye/eye-off and full moon/sun stroke | Shared clear conventions, no auth-storage change. |

Broader visits, online presence, conversion, behavioral funnels and cart abandonment are not measured by current endpoints. Their absence is explicitly documented in `.issue/32` for the backend developer. No tracker was added and no customer activity was invented.

## Species/reference data and backend handoff

The actual local acceptance database initially contained only the existing dog type. After a database backup, a guarded minimal local reference operation preserved the existing dog ID/slug, added cat and bird, their breeds and shared tag lists. Local counts: dog/cat/bird type IDs 3/4/5; dog breeds 10, cat breeds 9, bird breeds 4; ALLERGEN tags 9 and DIET tags 8. This was an idempotent reference operation against a named local MySQL database, not an automatic production demo seed. The storefront still shows only actual catalog records; reference support does not invent cat/bird stock.

Earlier local backend work, completed before the owner changed the backend handoff preference, fixed null pet dates, species/breed consistency, raster upload response policy, MySQL TEXT order snapshot serialization/read normalization and authoritative pending-order expiry. Bird age/size/neuter matching does not assume dog/cat rules. These candidates have separate tests and remain unapproved for deployment. After the owner's instruction, further core findings are notes only. No new customer-activity endpoint was implemented.

See [backend handoff](POLISH_BACKEND_HANDOFF.md) and root [.issue/STATUS](../../.issue/STATUS.md) for exact current findings, evidence and acceptance criteria. Open OTP budget ordering, admin cancellation races and activity-report needs require backend-owner work. Real provider, crawler, operator/privacy and deployed-revision gates remain separate from local UI polish.

## Verification evidence

| Check | Evidence / current status |
| --- | --- |
| Prior customer baseline | 38 files / 255 tests passed before this pass. |
| Intermediate customer integrated suite | 44 files / 293 tests passed, lint passed; superseded by the final run below. |
| Final customer suite / lint / typecheck | 46 files / 303 tests passed (162.87s). Latest auth/header/field/password checks: 4 files / 22 tests passed. Final lint and typecheck passed. |
| Final customer build / latest Header verification | Passed, including typecheck; latest count-format Header rerun 1 file / 8 tests passed. Entry JS 293.40kB / 89.78kB gzip; CSS 107.44kB / 20.19kB gzip. No 500kB chunk warning. |
| Admin final stable suite | 13 files / 66 tests passed in clean full single-worker rerun. |
| Admin final build/typecheck | Passed after responsive refinement. JS 390.52kB / 108.26kB gzip; CSS 63.38kB / 12.36kB gzip. |
| Admin latest lint / navigation-accessibility rerun | Passed; 16 focused cases passed after drawer/chart wrapper changes. The full 66-test run above is separate. |
| Backend earlier complete candidate | 42 suites / 361 tests passed; later recommendation focused 12/12 passed including three added policy cases. No claim of a later full 364-test run. |
| Backend build/lint | Passed, zero lint errors with 296 existing warnings. No global legacy-any rewrite. |
| MySQL rollback contract acceptance | Passed actual local checkout snapshot, null/omitted dates, expiry setting, total/stock changes and cancel restoration; all transaction fixtures rolled back, no SMS/payment. |
| Reference idempotence | Passed with no pending additions/conflicts after minimal local apply. |
| Source preview health | `/api/v1/health` on local source API returned 200 after authenticated Redis harness correction. |
| Browser visual/function checks | Actual coverage and limitations recorded below; these used the source API and real local MySQL with disposable identities. |
| Git / release | Dirty source preserved; no commit, push, PR or VPS publication. |
| Whitespace | CRLF-aware Git diff check passed; existing Windows line endings preserved. |

Initial simultaneous test launches encountered Windows worker startup timeouts; bounded single-worker reruns separate runner startup failures from assertions. During latest verification, one old clinic test awaited any h1; the newly stable loading h1 made that wait invalid. It was corrected to await the loaded clinic name. Reported counts distinguish failed/partial runs from the final stable rerun.

### Actual browser checks on the source preview

These were ordinary UI interactions against the local source API and actual MySQL, using isolated disposable customer/admin identities. No production identities, real SMS or payment were used. Evidence screenshots show local test records, not a live-business report.

| Flow | Observed result |
| --- | --- |
| Unified hero, light/dark desktop 1280×720 and mobile 360×800 | All three animals appear together in one scene; both actions remain visible; no horizontal page scroll. |
| Mobile shop menu | Opens, Escape closes, trigger is restored; hero “انتخاب مسیر” moves to the real path section. |
| Customer authentication | Password eye changes visibility; registration/recovery/back controls are distinct. Recovery-back navigation bug was fixed and regression-tested. |
| Customer profile | One account navigation row; duplicate shortcut cards and global account destination links are absent; Persian image chooser is visible. |
| Species and tags | Actual API dog/cat/bird options are Persian. Cat selection loads nine real Persian breed options. Bird with عروس هلندی and ذرت tag saved and read back in list/detail. |
| Favorite and cart | Actual favorite write produces pressed saved state; add-to-cart succeeds. Quantity edited from 1 to 2, Enter commits, controls lock while pending and subtotal reads ۲۰۰٬۰۰۰ تومان afterward. |
| Checkout/address | Empty-address state links to an allowed checkout return. Synthetic address saves, returns to checkout and is selected; add-address remains available. Payment submission was not invoked. |
| Dashboard truth and navigation | Source data shows selected-period paid sales and distinct current queues. Inactive-products action selects the actual draft filter; inventory action reaches the low-stock report; processing queue selects PROCESSING. No write to the existing order. |
| Admin mobile drawer | Actual 360px view opens/closes; Escape restores opener focus and selecting a destination focuses main content. Offscreen drawer no longer expands root width. |
| Admin mobile overview/reports | Loaded root scroll width is 345px with a 360px viewport and its vertical scrollbar. 620px tables scroll inside 275px wrappers. No horizontal root scrollbar. |
| Admin chart/theme/actions | One sales bar is capped at 48px; operational rows and all-orders action have explicit boundaries without native underlines. Full moon/sun visible; final dark mobile and light desktop screenshots captured. |

Local test identity cleanup removed exactly the two guarded synthetic accounts and their pet/tag, favorite, cart and address records after verification. Existing local catalog/order/reference data was preserved. Preview authentication remains RAM-only, so refreshing a development page can require signing in again; no persistent token storage was introduced.

Screenshot evidence delivered with the owner preview includes `hero-unified-light-desktop.png`, `hero-unified-dark-desktop.png`, `hero-unified-mobile.png`, `login-after.png`, `account-after.png`, `admin-dashboard-light.png`, `admin-attention-after.png` and `admin-mobile-dark.png`. The images are owner review artifacts outside the repository; no machine paths or credentials are added to source.

This is broad source/automated coverage and a local browser review, not proof that every possible button/state/device works. Physical touch/pen, screen-reader output, OS preference transitions, full 200% zoom matrix, real SMS delivery, live payments, actual production role access, crawler behavior and exact deployed SHA need release acceptance. Owner preview approval must occur before commit/push/deployment.
