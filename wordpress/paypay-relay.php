<?php
/**
 * PayPay relay — runs on WordPress so calls reach PayPay from a whitelisted IP.
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 * ---------------------------------------------------------------------------
 * The PayPay merchant account restricts API access to IPs registered during
 * application. Cloudflare Pages Functions have no fixed egress IP — requests
 * leave from many rotating Cloudflare addresses — so every call was rejected
 * with `Unauthorized request (08100016)` no matter how correct the signature
 * was. That error reads like a credentials problem and isn't: PayPay's own
 * official Node SDK was rejected with the same key, which ruled out our code.
 *
 * This host's outbound address (MyKinsta → "IP address for external
 * connections") is 161.33.186.30, which is the IP PayPay already has on file.
 * So the Pages Function now calls this relay, and this relay calls PayPay.
 *
 *   browser -> tour.rakanji.org/api/* (Cloudflare) -> here -> PayPay
 *
 * If PayPay later agrees to drop the IP restriction, the Pages Functions can
 * go back to calling PayPay directly and this file can be deleted.
 *
 * ---------------------------------------------------------------------------
 * Required configuration (wp-config.php, above "That's all, stop editing")
 * ---------------------------------------------------------------------------
 *   define('PAYPAY_API_KEY',     '...');  // 17 chars
 *   define('PAYPAY_API_SECRET',  '...');  // 44 chars, base64, ends in '='
 *   define('PAYPAY_MERCHANT_ID', '...');  // 18 digits
 *   define('PAYPAY_ENV',         'PROD'); // or 'STAGING'
 *   define('PAYPAY_RELAY_SECRET','...');  // long random string, must match
 *                                         // Cloudflare's PAYPAY_RELAY_SECRET
 *
 * Keep these in wp-config.php rather than the database: they are credentials,
 * and wp-config.php is not exposed by any REST route or backup export.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const PAYPAY_RELAY_ROUTE     = 'memorial/v1';
const PAYPAY_AMOUNT_JPY      = 1000;
const PAYPAY_ORDER_DESC      = 'Memorial Tour Guide — 24-hour access';
const PAYPAY_RELAY_MAX_SKEW  = 300; // seconds a relay signature stays valid

function paypay_base_url() {
	$env = defined( 'PAYPAY_ENV' ) ? PAYPAY_ENV : 'PROD';
	return 'STAGING' === $env
		? 'https://apigw.stg.paypay.ne.jp'
		: 'https://apigw.paypay.ne.jp';
}

/**
 * Authenticate a call from the Cloudflare Pages Function.
 *
 * Without this the relay would be an open endpoint that anyone could use to
 * mint PayPay payment codes against this merchant account. The caller signs
 * "{timestamp}\n{body}" with a shared secret; the timestamp window means a
 * captured header can't be replayed indefinitely.
 */
function paypay_relay_authorised( WP_REST_Request $request ) {
	if ( ! defined( 'PAYPAY_RELAY_SECRET' ) || '' === PAYPAY_RELAY_SECRET ) {
		return false;
	}

	$timestamp = (string) $request->get_header( 'x-relay-timestamp' );
	$signature = (string) $request->get_header( 'x-relay-signature' );

	if ( '' === $timestamp || '' === $signature ) {
		return false;
	}
	if ( abs( time() - (int) $timestamp ) > PAYPAY_RELAY_MAX_SKEW ) {
		return false;
	}

	$body     = $request->get_body();
	$expected = base64_encode(
		hash_hmac( 'sha256', $timestamp . "\n" . $body, PAYPAY_RELAY_SECRET, true )
	);

	return hash_equals( $expected, $signature );
}

/**
 * Build PayPay's `Authorization` header.
 *
 * Custom HMAC-SHA256 scheme over {path, method, nonce, epoch, contentType,
 * bodyHash} joined by newlines, where bodyHash is base64(MD5(contentType +
 * body)). GET requests sign the literal "empty" for both content type and
 * hash. Spec: https://www.paypay.ne.jp/opa/doc/jp/v1.0/hmac_authentication
 *
 * A direct port of functions/_lib/paypay-auth.js — verified to produce
 * byte-identical headers for the same nonce and epoch.
 */
function paypay_auth_header( $method, $path, $body ) {
	$nonce        = substr( str_replace( array( '+', '/', '=' ), '', base64_encode( random_bytes( 12 ) ) ), 0, 8 );
	$epoch        = time();
	$content_type = 'application/json;charset=UTF-8';

	if ( 'GET' === $method ) {
		$hash              = 'empty';
		$data_content_type = 'empty';
	} else {
		$hash              = base64_encode( md5( $content_type . $body, true ) );
		$data_content_type = $content_type;
	}

	$data_to_sign = implode(
		"\n",
		array( $path, $method, $nonce, $epoch, $data_content_type, $hash )
	);

	$signature = base64_encode(
		hash_hmac( 'sha256', $data_to_sign, PAYPAY_API_SECRET, true )
	);

	return array(
		'header'       => "hmac OPA-Auth:" . PAYPAY_API_KEY . ":{$signature}:{$nonce}:{$epoch}:{$hash}",
		'content_type' => $content_type,
	);
}

/** Issue a signed request to PayPay and return [status, decoded body]. */
function paypay_request( $method, $path, $body = '' ) {
	$auth = paypay_auth_header( $method, $path, $body );

	$args = array(
		'method'  => $method,
		'timeout' => 20,
		'headers' => array(
			'Authorization'     => $auth['header'],
			'X-ASSUME-MERCHANT' => PAYPAY_MERCHANT_ID,
		),
	);

	if ( 'GET' !== $method ) {
		$args['headers']['Content-Type'] = $auth['content_type'];
		$args['body']                    = $body;
	}

	$response = wp_remote_request( paypay_base_url() . $path, $args );

	if ( is_wp_error( $response ) ) {
		return array( 0, array( 'error' => $response->get_error_message() ) );
	}

	return array(
		(int) wp_remote_retrieve_response_code( $response ),
		json_decode( wp_remote_retrieve_body( $response ), true ),
	);
}

add_action(
	'rest_api_init',
	function () {
		// Create a payment code. Amount and description are fixed here rather
		// than taken from the request, so a caller that got past relay auth
		// still can't set its own price.
		register_rest_route(
			PAYPAY_RELAY_ROUTE,
			'/paypay/create',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => 'paypay_relay_authorised',
				'callback'            => function ( WP_REST_Request $request ) {
					foreach ( array( 'PAYPAY_API_KEY', 'PAYPAY_API_SECRET', 'PAYPAY_MERCHANT_ID' ) as $needed ) {
						if ( ! defined( $needed ) || '' === constant( $needed ) ) {
							return new WP_REST_Response( array( 'error' => 'Relay misconfigured' ), 500 );
						}
					}

					$params      = $request->get_json_params();
					$redirect    = isset( $params['redirectUrl'] ) ? esc_url_raw( $params['redirectUrl'] ) : '';
					$payment_id  = wp_generate_uuid4();

					if ( ! $redirect || 0 !== strpos( $redirect, 'https://' ) ) {
						return new WP_REST_Response( array( 'error' => 'Invalid redirectUrl' ), 400 );
					}

					$body = wp_json_encode(
						array(
							'merchantPaymentId' => $payment_id,
							'amount'            => array(
								'amount'   => PAYPAY_AMOUNT_JPY,
								'currency' => 'JPY',
							),
							'codeType'          => 'ORDER_QR',
							'orderDescription'  => PAYPAY_ORDER_DESC,
							'redirectUrl'       => add_query_arg( 'paypay_payment_id', $payment_id, $redirect ),
							'redirectType'      => 'WEB_LINK',
						),
						JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
					);

					list( $status, $data ) = paypay_request( 'POST', '/v2/codes', $body );

					if ( 200 !== $status || empty( $data['data']['url'] ) ) {
						return new WP_REST_Response(
							array(
								'error' => isset( $data['resultInfo']['message'] ) ? $data['resultInfo']['message'] : 'PayPay error',
								'code'  => isset( $data['resultInfo']['codeId'] ) ? $data['resultInfo']['codeId'] : null,
							),
							502
						);
					}

					return new WP_REST_Response(
						array(
							'url'               => $data['data']['url'],
							'merchantPaymentId' => $payment_id,
						),
						200
					);
				},
			)
		);

		// Payment status. Deliberately returns only the status string — the
		// access token is still minted on Cloudflare, which owns TOKEN_SECRET.
		register_rest_route(
			PAYPAY_RELAY_ROUTE,
			'/paypay/status',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => 'paypay_relay_authorised',
				'callback'            => function ( WP_REST_Request $request ) {
					$payment_id = sanitize_text_field( (string) $request->get_param( 'merchantPaymentId' ) );

					// PayPay ids are UUIDs we generated; reject anything else
					// rather than interpolating it straight into the path.
					if ( ! preg_match( '/^[A-Za-z0-9\-]{8,64}$/', $payment_id ) ) {
						return new WP_REST_Response( array( 'error' => 'Invalid merchantPaymentId' ), 400 );
					}

					list( $status, $data ) = paypay_request( 'GET', "/v2/codes/payments/{$payment_id}" );

					if ( 200 !== $status ) {
						return new WP_REST_Response(
							array(
								'status' => null,
								'error'  => isset( $data['resultInfo']['message'] ) ? $data['resultInfo']['message'] : 'PayPay error',
								'code'   => isset( $data['resultInfo']['codeId'] ) ? $data['resultInfo']['codeId'] : null,
							),
							502
						);
					}

					return new WP_REST_Response(
						array( 'status' => isset( $data['data']['status'] ) ? $data['data']['status'] : null ),
						200
					);
				},
			)
		);
	}
);
