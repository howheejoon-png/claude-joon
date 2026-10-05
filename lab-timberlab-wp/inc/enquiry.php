<?php
/**
 * Enquiry handling. Submissions are stored as a private post type so nothing is
 * lost if email delivery fails, and emailed to the studio address.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', function (): void {
	register_post_type( 'lab_enquiry', [
		'labels' => [
			'name'          => __( 'Enquiries', 'lab' ),
			'singular_name' => __( 'Enquiry', 'lab' ),
			'all_items'     => __( 'Enquiries', 'lab' ),
		],
		'public'        => false,
		'show_ui'       => true,
		'menu_icon'     => 'dashicons-email',
		'menu_position' => 25,
		'supports'      => [ 'title' ],
		'capabilities'  => [ 'create_posts' => 'do_not_allow' ],
		'map_meta_cap'  => true,
	] );
} );

add_action( 'wp_ajax_lab_enquiry', 'lab_handle_enquiry' );
add_action( 'wp_ajax_nopriv_lab_enquiry', 'lab_handle_enquiry' );
function lab_handle_enquiry(): void {
	check_ajax_referer( 'lab_enquiry', 'nonce' );

	$fields = [];
	foreach ( [ 'name', 'phone', 'email', 'propertyType', 'propertyStatus', 'budget', 'timeline', 'message' ] as $key ) {
		$fields[ $key ] = isset( $_POST[ $key ] ) ? sanitize_text_field( wp_unslash( $_POST[ $key ] ) ) : '';
	}
	$fields['message'] = isset( $_POST['message'] ) ? sanitize_textarea_field( wp_unslash( $_POST['message'] ) ) : '';

	// Honeypot: a real visitor never fills this in.
	if ( ! empty( $_POST['company'] ) ) {
		wp_send_json_success( [ 'ok' => true ] );
	}
	if ( '' === $fields['name'] || ! is_email( $fields['email'] ) ) {
		wp_send_json_error( [ 'message' => __( 'Please add your name and a valid email address.', 'lab' ) ], 400 );
	}

	$post_id = wp_insert_post( [
		'post_type'   => 'lab_enquiry',
		'post_status' => 'private',
		'post_title'  => sprintf( '%s — %s', $fields['name'], gmdate( 'j M Y, H:i' ) ),
	] );

	if ( $post_id && ! is_wp_error( $post_id ) ) {
		foreach ( $fields as $key => $value ) {
			update_post_meta( $post_id, 'lab_' . $key, $value );
		}
	}

	$to    = (string) lab_opt( 'email' );
	$lines = [];
	foreach ( $fields as $key => $value ) {
		if ( '' !== $value ) {
			$lines[] = ucfirst( preg_replace( '/(?<!^)[A-Z]/', ' $0', $key ) ) . ': ' . $value;
		}
	}
	if ( $to && is_email( $to ) ) {
		wp_mail(
			$to,
			sprintf( '[Website enquiry] %s', $fields['name'] ),
			implode( "\n", $lines ),
			[ 'Reply-To: ' . $fields['email'] ]
		);
	}

	wp_send_json_success( [ 'ok' => true ] );
}

/** Show the submitted details on the enquiry edit screen. */
add_action( 'add_meta_boxes', function (): void {
	add_meta_box( 'lab_enquiry_data', __( 'Enquiry', 'lab' ), function ( WP_Post $post ): void {
		echo '<table class="widefat striped"><tbody>';
		foreach ( get_post_meta( $post->ID ) as $key => $value ) {
			if ( ! str_starts_with( $key, 'lab_' ) ) {
				continue;
			}
			printf(
				'<tr><th style="width:12rem">%s</th><td>%s</td></tr>',
				esc_html( ucfirst( preg_replace( '/(?<!^)[A-Z]/', ' $0', substr( $key, 4 ) ) ) ),
				esc_html( (string) ( $value[0] ?? '' ) )
			);
		}
		echo '</tbody></table>';
	}, 'lab_enquiry', 'normal', 'high' );
} );
