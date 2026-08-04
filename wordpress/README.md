# WordPress: the tour endpoint

[`memorial-tour-endpoint.php`](memorial-tour-endpoint.php) is the complete
`/memorial/v1/tour` endpoint — the original code with image sizing added.

Kept in the repo because the frontend depends on this endpoint's behaviour, and
the two need to change together.

## Installing

Replace the existing endpoint code — the `add_action('rest_api_init', ...)`
block and the `add_filter('rest_pre_serve_request', ...)` after it — with the
contents of this file. It lives in the theme's `functions.php` or a
site-specific plugin.

Skip the opening `<?php` line if pasting into a file that already has one.

## What changed from the original

Four edits, all image-related. Everything else is byte-for-byte the original.

| | Was | Now |
| --- | --- | --- |
| `image_1`–`image_5` | `$normalize_media_url(...)` | `rakanji_image_url(...)` |
| `map_image` | `$normalize_media_url(...)` | `rakanji_image_url(...)` |
| `popup_image` | `$normalize_media_url(...)` | `rakanji_image_url(...)` |
| `$to_rich` | `wp_kses_post($value)` | `rakanji_size_html_images(wp_kses_post($value))` |

Plus three helper functions above the endpoint.

`audio_url`, `audio_url_en/ko/zh` and `video_url` still go through
`$normalize_media_url` and are deliberately untouched — they aren't images.

## Why

The endpoint returned full-resolution originals (2560px `-scaled.jpg`) for
images phones display at 360–760px. Measured against the live tour: 195 images,
154MB total, averaging 809KB each, 42 over 1MB — roughly 50x more pixels than
the screen can render.

WordPress already generated smaller variants at upload time. These changes point
the response at them: about a 64% reduction, no re-uploading, no visible quality
change on a phone.

It matters most on the temple grounds, where reception is poor. A 946KB hero
image is a 7–8 second wait on a weak connection; the 164KB variant of the same
photo is closer to one second.

## Safety

Every helper falls back to the original URL when it can't resolve an image, so
the worst case is the previous behaviour, never a missing image. Verified in PHP
8.2 against real `<img>` tags from the live API: `src` swapped, `srcset`/`sizes`
added, `loading` preserved, no duplicated attributes, existing `srcset` left
alone, and `null`/empty handled exactly as `$normalize_media_url` does.

The first request after saving is slow — it resolves ~195 image URLs to
attachment IDs. Those are cached for 24 hours, so reload once.

To roll back, restore the original endpoint. 

## Verifying

Load the endpoint and search the response for `-scaled.jpg`. Most occurrences
should be replaced with sized variants like `-1024x768.jpg`.

## Paired frontend change

`assets/js/script.js` used to strip WordPress's size suffix back off
(`-1024x768.jpg` → full size), which would undo three of the four edits above.
That's been removed, and the HTML sanitiser now preserves `srcset`/`sizes`.

Both sides are safe to deploy in either order; the full benefit needs both.
