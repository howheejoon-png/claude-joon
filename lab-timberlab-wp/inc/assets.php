<?php
/**
 * Enqueue the compiled front-end bundle.
 *
 * Assets are built by Vite into /assets with a manifest, so hashed filenames
 * are resolved here rather than hard-coded. Define LAB_DEV_SERVER in wp-config
 * (e.g. 'http://localhost:5173') to load from the Vite dev server instead.
 */

defined( 'ABSPATH' ) || exit;

const LAB_ENTRY = 'src/main.js';

function lab_manifest(): array {
	static $manifest = null;
	if ( null !== $manifest ) {
		return $manifest;
	}
	$path     = LAB_DIR . '/assets/.vite/manifest.json';
	$manifest = file_exists( $path )
		? (array) json_decode( (string) file_get_contents( $path ), true )
		: [];
	return $manifest;
}

function lab_asset_url( string $file ): string {
	return LAB_URI . '/assets/' . ltrim( $file, '/' );
}

add_action( 'wp_enqueue_scripts', 'lab_enqueue' );
function lab_enqueue(): void {
	$dev = defined( 'LAB_DEV_SERVER' ) ? untrailingslashit( (string) constant( 'LAB_DEV_SERVER' ) ) : '';

	if ( $dev ) {
		wp_enqueue_script( 'lab-vite-client', $dev . '/@vite/client', [], null, false );
		wp_enqueue_script( 'lab-main', $dev . '/' . LAB_ENTRY, [], null, true );
	} else {
		$manifest = lab_manifest();
		$entry    = $manifest[ LAB_ENTRY ] ?? null;

		if ( ! $entry ) {
			return; // Not built yet — fail quietly rather than emitting broken tags.
		}

		foreach ( (array) ( $entry['css'] ?? [] ) as $i => $css ) {
			wp_enqueue_style( 'lab-style-' . $i, lab_asset_url( $css ), [], LAB_VERSION );
		}
		wp_enqueue_script( 'lab-main', lab_asset_url( $entry['file'] ), [], LAB_VERSION, true );
	}

	// Resolve lazily-loaded chunks against the real theme URL.
	wp_add_inline_script(
		'lab-main',
		'window.__labAsset=function(f){return ' . wp_json_encode( trailingslashit( LAB_URI . '/assets' ) ) . '+f;};',
		'before'
	);

	wp_localize_script( 'lab-main', 'LAB', [
		'assets'  => trailingslashit( LAB_URI . '/assets' ),
		'ajax'    => admin_url( 'admin-ajax.php' ),
		'nonce'   => wp_create_nonce( 'lab_enquiry' ),
		'reduced' => false,
	] );
}

/** Vite output is ESM, so the tags need type="module". */
add_filter( 'script_loader_tag', function ( string $tag, string $handle, string $src ): string {
	if ( ! in_array( $handle, [ 'lab-main', 'lab-vite-client' ], true ) ) {
		return $tag;
	}
	return sprintf( '<script type="module" src="%s" id="%s-js"></script>' . "\n", esc_url( $src ), esc_attr( $handle ) );
}, 10, 3 );

/** Preconnect nothing external — fonts are self-hosted — but do preload the hero poster. */
add_action( 'wp_head', function (): void {
	if ( ! is_front_page() ) {
		return;
	}
	$featured = lab_featured_projects();
	if ( ! $featured ) {
		return;
	}
	$hero = (int) lab_get( $featured[0]->ID, 'lab_hero', 0 ) ?: (int) get_post_thumbnail_id( $featured[0] );
	$url  = $hero ? wp_get_attachment_image_url( $hero, 'lab-hero' ) : '';
	if ( $url ) {
		printf( '<link rel="preload" as="image" href="%s" fetchpriority="high">' . "\n", esc_url( $url ) );
	}
}, 5 );

/* ------------------------------------------------------------------ *
 * Admin
 * ------------------------------------------------------------------ */

add_action( 'admin_enqueue_scripts', function ( string $hook ): void {
	$screen = get_current_screen();
	$ours   = $screen && in_array( $screen->post_type, [ 'lab_project', 'lab_service', 'lab_step', 'lab_principle', 'lab_person' ], true );
	$ours   = $ours || str_contains( $hook, 'lab-settings' );
	if ( ! $ours ) {
		return;
	}
	wp_enqueue_media();
	wp_enqueue_style( 'lab-admin', LAB_URI . '/admin/admin.css', [], LAB_VERSION );
	wp_enqueue_script( 'lab-admin', LAB_URI . '/admin/admin.js', [ 'jquery', 'jquery-ui-sortable' ], LAB_VERSION, true );
} );
