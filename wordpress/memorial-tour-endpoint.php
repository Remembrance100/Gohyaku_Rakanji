<?php
/**
 * /memorial/v1/tour — the REST endpoint the tour frontend reads.
 *
 * This is the complete file: the original endpoint with image sizing added.
 * Replace the existing endpoint code with everything below.
 *
 * ---------------------------------------------------------------------------
 * Why the image handling exists
 * ---------------------------------------------------------------------------
 * The endpoint used to return full-resolution originals — in practice 2560px
 * `-scaled.jpg` files — for images phones display at 360-760px wide. Measured
 * against the live tour: 195 images, 154MB in total, averaging 809KB each,
 * with 42 of them over 1MB. Visitors were downloading roughly 50x more pixels
 * than their screen could render.
 *
 * WordPress already generated smaller variants of all of these at upload time,
 * so the fix is only to point the response at them: about a 64% reduction, no
 * re-uploading, and no visible quality change on a phone.
 *
 * That matters most on the temple grounds, where reception is poor. A 946KB
 * hero image is a 7-8 second wait on a weak connection; the 164KB variant of
 * the same photo is closer to one second.
 *
 * Every helper below falls back to the original URL when it cannot resolve an
 * image, so the worst case is the previous behaviour — never a missing image.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/*
|--------------------------------------------------------------------------
| Image sizing helpers
|--------------------------------------------------------------------------
*/

/**
 * Registered size handed to the frontend.
 *
 * 'large' is 1024px on a stock install. Deliberately not chasing retina: on a
 * slow connection a slightly softer image that arrives beats a pin-sharp one
 * that doesn't. wp_get_attachment_image_src() falls back to the full file when
 * a size was never generated, so images already smaller than this pass through
 * untouched rather than being upscaled.
 */
if ( ! defined( 'RAKANJI_IMAGE_SIZE' ) ) {
	define( 'RAKANJI_IMAGE_SIZE', 'large' );
}

/**
 * Resolve an uploaded file URL back to its attachment ID.
 *
 * Only needed for images embedded in rich text, where the URL is all we have.
 * attachment_url_to_postid() matches the exact stored filename, so URLs
 * pointing at a generated variant (`-1024x768.jpg`) or at the scaled original
 * (`-scaled.jpg`) miss — peel those suffixes off and retry before giving up.
 *
 * Memoised per request and in a transient: one tour response references ~195
 * distinct images, and every miss is a database query.
 */
function rakanji_attachment_id_from_url( $url ) {
	static $memo = array();

	if ( ! is_string( $url ) || '' === $url ) {
		return 0;
	}
	if ( isset( $memo[ $url ] ) ) {
		return $memo[ $url ];
	}

	// Cache key is versioned (`att2`) so deploying this file invalidates the
	// day-long negative cache below. Without that bump, every URL this function
	// used to fail on would keep returning its cached 0 for up to 24 hours and
	// the fix would look like it had not worked.
	$cache_key = 'rakanji_att2_' . md5( $url );
	$cached    = get_transient( $cache_key );
	if ( false !== $cached ) {
		$memo[ $url ] = (int) $cached;
		return (int) $cached;
	}

	// Rich-text URLs percent-encode non-ASCII filenames
	// (`.../%E2%91%A0-scaled.jpg`) while `_wp_attached_file` stores the raw
	// UTF-8 name (`.../①-scaled.jpg`), and attachment_url_to_postid() compares
	// the two as plain strings. Every image on this tour with a Japanese
	// filename missed on that alone — 48 of 105, each left pointing at its
	// full-size `-scaled` original, 22.6MB of avoidable payload — while every
	// ASCII-named one resolved. Try the decoded spelling alongside the literal.
	$bases   = array( $url );
	$decoded = rawurldecode( $url );
	if ( $decoded !== $url ) {
		$bases[] = $decoded;
	}

	$candidates = array();
	foreach ( $bases as $base ) {
		$candidates[] = $base;

		// `-1024x768.jpg` -> `.jpg`
		$stripped = preg_replace( '/-\d+x\d+(?=\.[A-Za-z0-9]+$)/', '', $base );
		if ( $stripped !== $base ) {
			$candidates[] = $stripped;
		}

		// `-scaled.jpg` -> `.jpg` (WordPress stores the pre-scale original).
		$unscaled = preg_replace( '/-scaled(?=\.[A-Za-z0-9]+$)/', '', $stripped );
		if ( $unscaled !== $stripped ) {
			$candidates[] = $unscaled;
		}
	}
	$candidates = array_unique( $candidates );

	$id = 0;
	foreach ( $candidates as $candidate ) {
		$id = attachment_url_to_postid( $candidate );
		if ( $id ) {
			break;
		}
	}

	// Misses are cached too: an unresolvable URL stays unresolvable, and
	// retrying it on every request is exactly the cost being avoided here.
	set_transient( $cache_key, $id, DAY_IN_SECONDS );
	$memo[ $url ] = $id;

	return $id;
}

/**
 * Display-sized URL for an ACF image field.
 *
 * Handles every return format ACF might be configured for. The ID and array
 * formats give the attachment directly, which is the fast and exact path; a
 * plain URL string falls back to the reverse lookup above.
 */
function rakanji_image_url( $value, $size = RAKANJI_IMAGE_SIZE ) {
	$id = 0;

	if ( is_numeric( $value ) ) {
		$id = (int) $value;
	} elseif ( is_array( $value ) ) {
		if ( ! empty( $value['ID'] ) ) {
			$id = (int) $value['ID'];
		} elseif ( ! empty( $value['id'] ) ) {
			$id = (int) $value['id'];
		} elseif ( ! empty( $value['url'] ) ) {
			$id = rakanji_attachment_id_from_url( $value['url'] );
		}
	} elseif ( is_string( $value ) && preg_match( '#^https?://#i', trim( $value ) ) ) {
		$id = rakanji_attachment_id_from_url( trim( $value ) );
	}

	if ( $id ) {
		$img = wp_get_attachment_image_src( $id, $size );
		if ( ! empty( $img[0] ) ) {
			return esc_url_raw( $img[0] );
		}
	}

	// Nothing resolved — mirror the original $normalize_media_url exactly. An
	// image that can't be resized must still be an image that displays.
	if ( is_array( $value ) && ! empty( $value['url'] ) ) {
		return esc_url_raw( $value['url'] );
	}
	if ( is_numeric( $value ) ) {
		return esc_url_raw( wp_get_attachment_url( (int) $value ) ?: '' );
	}
	if ( is_string( $value ) && preg_match( '#^https?://#i', trim( $value ) ) ) {
		return esc_url_raw( trim( $value ) );
	}

	return '';
}

/**
 * Rewrite every <img> in a block of rich text: point `src` at the smaller file
 * and attach `srcset`/`sizes` so the browser can step down further again on
 * low-density screens.
 *
 * Many of these tags carry `class=""` rather than WordPress's usual
 * `wp-image-{ID}`, so wp_filter_content_tags() can't identify them — hence
 * matching on the src URL, which works for both kinds. Tags that already
 * declare srcset keep theirs, and any tag that can't be resolved is returned
 * exactly as it came in.
 */
function rakanji_size_html_images( $html ) {
	if ( ! is_string( $html ) || false === stripos( $html, '<img' ) ) {
		return $html;
	}

	return preg_replace_callback(
		'/<img\b[^>]*>/i',
		function ( $matches ) {
			$tag = $matches[0];

			if ( ! preg_match( '/\ssrc=["\']([^"\']+)["\']/i', $tag, $src_match ) ) {
				return $tag;
			}

			$id = rakanji_attachment_id_from_url( $src_match[1] );
			if ( ! $id ) {
				return $tag;
			}

			$resized = wp_get_attachment_image_src( $id, RAKANJI_IMAGE_SIZE );
			if ( empty( $resized[0] ) ) {
				return $tag;
			}

			$tag = str_replace(
				$src_match[0],
				' src="' . esc_url( $resized[0] ) . '"',
				$tag
			);

			if ( ! preg_match( '/\ssrcset=/i', $tag ) ) {
				$srcset = wp_get_attachment_image_srcset( $id, RAKANJI_IMAGE_SIZE );
				if ( $srcset ) {
					$inject = ' srcset="' . esc_attr( $srcset ) . '"';
					$sizes  = wp_get_attachment_image_sizes( $id, RAKANJI_IMAGE_SIZE );
					if ( $sizes ) {
						$inject .= ' sizes="' . esc_attr( $sizes ) . '"';
					}
					$tag = preg_replace( '/<img\b/i', '<img' . $inject, $tag, 1 );
				}
			}

			if ( ! preg_match( '/\sloading=/i', $tag ) ) {
				$tag = preg_replace( '/<img\b/i', '<img loading="lazy"', $tag, 1 );
			}

			return $tag;
		},
		$html
	);
}

/*
|--------------------------------------------------------------------------
| The endpoint
|--------------------------------------------------------------------------
*/

add_action('rest_api_init', function () {
  register_rest_route('memorial/v1', '/tour', [
    'methods' => WP_REST_Server::READABLE,
    'permission_callback' => '__return_true',
    'callback' => function () {
      $posts = get_posts([
        'post_type'      => 'memorial_stop',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'orderby'        => 'menu_order',
        'order'          => 'ASC',
      ]);

      // Still used for audio and video, which must never be resized.
      $normalize_media_url = function ($value) {
        if (is_array($value) && !empty($value['url'])) return esc_url_raw($value['url']);
        if (is_numeric($value)) return esc_url_raw(wp_get_attachment_url((int) $value) ?: '');
        if (is_string($value) && preg_match('#^https?://#i', trim($value))) return esc_url_raw(trim($value));

        return '';
      };

      $normalize_link = function ($value) {
        if (is_array($value) && !empty($value['url'])) {
          return [
            'url'    => esc_url_raw($value['url']),
            'title'  => isset($value['title']) ? sanitize_text_field($value['title']) : '',
            'target' => isset($value['target']) ? sanitize_text_field($value['target']) : '',
          ];
        }
        if (is_string($value) && filter_var($value, FILTER_VALIDATE_URL)) {
          return ['url' => esc_url_raw($value), 'title' => '', 'target' => ''];
        }
        return null;
      };

      $normalize_post_object_id = function ($value) {
        if (is_numeric($value)) return (int) $value;
        if (is_object($value) && isset($value->ID)) return (int) $value->ID;
        if (is_array($value) && isset($value['ID'])) return (int) $value['ID'];
        return 0;
      };

      $to_plain = function ($value) {
        return is_string($value) ? trim(wp_strip_all_tags($value)) : '';
      };

      // Single chokepoint for every piece of rich text in the response —
      // details_content, transcript, highlight, popup_text and all their
      // _en/_ja variants — which is where the bulk of the tour's images live.
      // Sanitise first, then resize the images in the already-clean markup.
      $to_rich = function ($value) {
        return is_string($value)
          ? rakanji_size_html_images(wp_kses_post($value))
          : '';
      };

      $normalize_highlight_lines = function ($value) {
        if (!is_string($value) || trim($value) === '') return [];

        $text = $value;
        $text = preg_replace('/<br\s*\/?>/i', "\n", $text);
        $text = preg_replace('/<\/(p|li|div|h[1-6])>/i', "\n", $text);
        $text = wp_strip_all_tags($text, false);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $text = preg_replace('/\r\n?/', "\n", $text);
        $text = preg_replace('/\s*(?:\\\\n|\/n)\s*/u', "\n", $text);
        $text = preg_replace('/([。！？.!?」）])\s*[・･•●▪◦\-—]/u', "$1\n・", $text);

        $lines = preg_split('/\n+/u', $text);
        $lines = array_filter(array_map('trim', $lines), function ($line) {
          return $line !== '';
        });

        $lines = array_map(function ($line) {
          return preg_match('/^[・･•●▪◦\-—]/u', $line) ? $line : '・' . $line;
        }, $lines);

        return array_values($lines);
      };

      $stops = array_map(function ($p) use (
        $normalize_media_url,
        $normalize_link,
        $normalize_post_object_id,
        $to_plain,
        $to_rich,
        $normalize_highlight_lines
      ) {
        $get_field_safe = function ($field_name, $post_id = null) use ($p) {
          if (!function_exists('get_field')) return null;
          return get_field($field_name, $post_id ?: $p->ID);
        };

        // rakanji_image_url() instead of $normalize_media_url(): asks WordPress
        // for the display-sized file rather than the 2560px original.
        $images = [];
        foreach (['image_1', 'image_2', 'image_3', 'image_4', 'image_5'] as $field) {
          $url = rakanji_image_url($get_field_safe($field));
          if ($url) $images[] = $url;
        }

        $mapUrl = rakanji_image_url($get_field_safe('map_image'));

        $linked_terms = $get_field_safe('term_popups');
        if (!$linked_terms) $linked_terms = [];
        if (!is_array($linked_terms)) $linked_terms = [$linked_terms];

        $term_popups = [];
        foreach ($linked_terms as $term_ref) {
          $term_post_id = $normalize_post_object_id($term_ref);
          if (!$term_post_id) continue;

          $term_id = $to_plain($get_field_safe('term_id', $term_post_id));
          if (!$term_id) $term_id = sanitize_title(get_the_title($term_post_id));

          $popup_title = $to_plain($get_field_safe('popup_title', $term_post_id));
          if (!$popup_title) $popup_title = $to_plain(get_the_title($term_post_id));

          $popup_text = $to_rich($get_field_safe('popup_text', $term_post_id));
          $popup_image = rakanji_image_url($get_field_safe('popup_image', $term_post_id));
          $popup_link = $normalize_link($get_field_safe('popup_link', $term_post_id));
          $popup_link_label = $to_plain($get_field_safe('popup_link_label', $term_post_id));

          $term_popups[] = [
            'term_id'          => $term_id,
            'popup_title'      => $popup_title,
            'popup_text'       => $popup_text,
            'popup_image'      => $popup_image,
            'popup_link'       => $popup_link,
            'popup_link_label' => $popup_link_label,
          ];
        }

        // highlight2 priority
        $highlight_default_raw = (string) ($get_field_safe('highlight2') ?: $get_field_safe('highlight'));
        $highlight_en_raw      = (string) ($get_field_safe('highlight2_en') ?: $get_field_safe('highlight_en'));
        $highlight_ja_raw      = (string) ($get_field_safe('highlight2_ja') ?: $get_field_safe('highlight_ja'));

        return [
          'id' => $p->post_name,

          'title'      => $to_plain(get_the_title($p->ID)),
          'text'       => $to_plain($p->post_content),
          'transcript' => $to_rich($get_field_safe('transcript')),
          'highlight'  => $to_rich($highlight_default_raw),
          'details_content' => $to_rich($get_field_safe('details_content')),

          'title_en'      => $to_plain($get_field_safe('title_en')),
          'title_ja'      => $to_plain($get_field_safe('title_ja')),
          'text_en'       => $to_plain($get_field_safe('text_en')),
          'text_ja'       => $to_plain($get_field_safe('text_ja')),
          'transcript_en' => $to_rich($get_field_safe('transcript_en')),
          'transcript_ja' => $to_rich($get_field_safe('transcript_ja')),
          'highlight_en'  => $to_rich($highlight_en_raw),
          'highlight_ja'  => $to_rich($highlight_ja_raw),
          'details_content_en' => $to_rich($get_field_safe('details_content_en')),
          'details_content_ja' => $to_rich($get_field_safe('details_content_ja')),

          // optional explicit highlight2 outputs
          'highlight2'    => $to_rich($get_field_safe('highlight2')),
          'highlight2_en' => $to_rich($get_field_safe('highlight2_en')),
          'highlight2_ja' => $to_rich($get_field_safe('highlight2_ja')),

          // stable bullet arrays
          'highlight_lines'    => $normalize_highlight_lines($highlight_default_raw),
          'highlight_lines_en' => $normalize_highlight_lines($highlight_en_raw),
          'highlight_lines_ja' => $normalize_highlight_lines($highlight_ja_raw),

          'images'      => array_values(array_filter($images)),
          'audioUrl'    => $normalize_media_url($get_field_safe('audio_url')),
          'audio_url_en' => $normalize_media_url($get_field_safe('audio_url_en')),
          'audio_url_ko' => $normalize_media_url($get_field_safe('audio_url_ko')),
          'audio_url_zh' => $normalize_media_url($get_field_safe('audio_url_zh')),

          'mapUrl'      => $mapUrl,
          'videoUrl'    => $normalize_media_url($get_field_safe('video_url')),
          'term_popups' => $term_popups,
        ];
      }, $posts);

      return [
        'siteTitle'    => get_bloginfo('name'),
        'tourTitle'    => 'Standard Memorial Tour',
        'tourTitle_en' => 'Standard Memorial Tour',
        'tourTitle_ja' => 'スタンダード慰霊ツアー',
        'intro'        => 'A quiet, audio-first tour through key points of remembrance. Headphones recommended.',
        'intro_en'     => 'A quiet, audio-first tour through key points of remembrance. Headphones recommended.',
        'intro_ja'     => '追悼の要所を静かに巡る音声中心のツアーです。ヘッドホンの利用をおすすめします。',
        'stops'        => $stops,
      ];
    },
  ]);
});

add_filter('rest_pre_serve_request', function ($served, $result, $request) {
  if ($request instanceof WP_REST_Request && $request->get_route() === '/memorial/v1/tour') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Vary: Origin');
  }
  return $served;
}, 10, 3);
