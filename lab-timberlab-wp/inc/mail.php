<?php
/**
 * Email delivery.
 *
 * An enquiry is worth more than anything else on this site, so the two things
 * that silently lose one are handled here:
 *
 * 1. WordPress sends as wordpress@<site-domain> unless told otherwise. Mail
 *    from a shared host, claiming a domain that has not authorised that server,
 *    is the classic spam-folder case. So the sender is set explicitly, and can
 *    be routed through real SMTP credentials instead of PHP's mail().
 * 2. wp_mail() returns false on failure and nothing in WordPress tells anyone.
 *    Failures are recorded, surfaced in the admin, and marked on the enquiry.
 *
 * Credentials belong in wp-config.php rather than the database. Any of these
 * constants wins over the matching setting:
 *
 *   LAB_SMTP_HOST  LAB_SMTP_PORT  LAB_SMTP_SECURE
 *   LAB_SMTP_USER  LAB_SMTP_PASS  LAB_MAIL_FROM  LAB_MAIL_FROM_NAME
 */

defined( 'ABSPATH' ) || exit;

const LAB_MAIL_ERROR = 'lab_mail_last_error';

/** A mail setting: the wp-config.php constant if defined, else the saved value. */
function lab_mail_setting( string $key ): string {
	$constant = 'LAB_' . strtoupper( $key );
	if ( defined( $constant ) ) {
		return trim( (string) constant( $constant ) );
	}
	return trim( (string) lab_opt( strtolower( $key ), '' ) );
}

/** The site's own domain, which is what the sender address should sit on. */
function lab_mail_domain(): string {
	$host = (string) wp_parse_url( network_home_url(), PHP_URL_HOST );
	return 'www.' === substr( $host, 0, 4 ) ? substr( $host, 4 ) : $host;
}

/**
 * Who the site sends as, or '' when we have nothing better than WordPress's own
 * default. Deriving no-reply@<domain> is only safe when that is a real address:
 * on localhost or a bare IP it is not, and PHPMailer rejects the whole message.
 */
function lab_mail_from(): string {
	$from = lab_mail_setting( 'mail_from' );
	if ( is_email( $from ) ) {
		return $from;
	}
	$derived = 'no-reply@' . lab_mail_domain();
	return is_email( $derived ) ? $derived : '';
}

/** What the site will actually send as, for display. */
function lab_mail_effective_from(): string {
	$ours = lab_mail_from();
	return '' !== $ours ? $ours : 'wordpress@' . lab_mail_domain();
}

add_filter( 'wp_mail_from', function ( string $from ): string {
	$ours = lab_mail_from();
	return '' !== $ours ? $ours : $from;
} );

add_filter( 'wp_mail_from_name', function ( string $name ): string {
	$set = lab_mail_setting( 'mail_from_name' );
	return '' !== $set ? $set : $name;
} );

/**
 * Route through SMTP when a host is configured; otherwise WordPress keeps using
 * PHP's mail(), so an unconfigured site still works exactly as it did.
 */
add_action( 'phpmailer_init', function ( $phpmailer ): void {
	$host = lab_mail_setting( 'smtp_host' );
	if ( '' === $host ) {
		return;
	}

	$phpmailer->isSMTP();
	$phpmailer->Host = $host;

	$secure = strtolower( lab_mail_setting( 'smtp_secure' ) );
	if ( in_array( $secure, [ 'tls', 'ssl' ], true ) ) {
		$phpmailer->SMTPSecure = $secure;
	} else {
		$phpmailer->SMTPSecure  = '';
		$phpmailer->SMTPAutoTLS = false;
	}

	$port = (int) lab_mail_setting( 'smtp_port' );
	if ( ! $port ) {
		$port = 'ssl' === $secure ? 465 : 587;
	}
	$phpmailer->Port = $port;

	$user = lab_mail_setting( 'smtp_user' );
	$pass = lab_mail_setting( 'smtp_pass' );
	if ( '' !== $user ) {
		$phpmailer->SMTPAuth = true;
		$phpmailer->Username = $user;
		$phpmailer->Password = $pass;
	}

	$phpmailer->Timeout = 20;
} );

/** Remember why the last send failed, so somebody can be told. */
add_action( 'wp_mail_failed', function ( WP_Error $error ): void {
	update_option( LAB_MAIL_ERROR, [
		'message' => $error->get_error_message(),
		'time'    => time(),
	], false );
} );

function lab_mail_last_error(): array {
	return (array) get_option( LAB_MAIL_ERROR, [] );
}

function lab_mail_clear_error(): void {
	delete_option( LAB_MAIL_ERROR );
}

/**
 * Say so in the admin when mail is failing. Without this the enquiries pile up
 * unseen while the studio assumes the form is broken.
 */
add_action( 'admin_notices', function (): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$error = lab_mail_last_error();
	if ( empty( $error['message'] ) ) {
		return;
	}
	printf(
		'<div class="notice notice-error"><p><strong>%s</strong> %s</p><p>%s</p><p>%s</p></div>',
		esc_html__( 'Website enquiries are not reaching your inbox.', 'lab' ),
		esc_html( sprintf(
			/* translators: %s: how long ago the failure was. */
			__( 'The last attempt failed %s ago.', 'lab' ),
			human_time_diff( (int) ( $error['time'] ?? time() ) )
		) ),
		esc_html( (string) $error['message'] ),
		sprintf(
			/* translators: %s: link to the settings screen. */
			wp_kses( __( 'Nothing has been lost — every enquiry is saved under <strong>Enquiries</strong>. Check the delivery settings on <a href="%s">L.A.B settings</a>.', 'lab' ), [ 'strong' => [], 'a' => [ 'href' => [] ] ] ),
			esc_url( admin_url( 'admin.php?page=lab-settings' ) )
		)
	);
} );

/** "Send a test email" on the settings screen. */
add_action( 'admin_post_lab_test_mail', function (): void {
	if ( ! current_user_can( 'manage_options' ) || ! check_admin_referer( 'lab_test_mail' ) ) {
		wp_die( esc_html__( 'Not allowed.', 'lab' ) );
	}

	lab_mail_clear_error();
	$to = (string) lab_opt( 'email' );
	$ok = is_email( $to ) && wp_mail(
		$to,
		__( '[Website] Test email', 'lab' ),
		sprintf(
			/* translators: 1: site name, 2: sender address. */
			__( "This is a test from %1\$s.\n\nIf you are reading it in your inbox, website enquiries will reach you too.\nIf you found it in spam, tell your developer — the sender address is %2\$s.", 'lab' ),
			get_bloginfo( 'name' ),
			lab_mail_effective_from()
		)
	);

	wp_safe_redirect( add_query_arg( [
		'page'      => 'lab-settings',
		'lab_test'  => $ok ? 'sent' : 'failed',
		'lab_to'    => rawurlencode( $to ),
	], admin_url( 'admin.php' ) ) );
	exit;
} );
