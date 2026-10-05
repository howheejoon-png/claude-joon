<?php
/** Navigation items in the exact shape the markup needs. */

defined( 'ABSPATH' ) || exit;

function lab_nav_items( string $location = 'primary' ): array {
	$locations = get_nav_menu_locations();
	$items     = [];

	if ( ! empty( $locations[ $location ] ) ) {
		$menu = wp_get_nav_menu_items( $locations[ $location ] );
		foreach ( (array) $menu as $item ) {
			$items[] = [
				'label'   => $item->title,
				'url'     => $item->url,
				'current' => in_array( 'current-menu-item', (array) $item->classes, true ),
			];
		}
	}

	if ( $items ) {
		return $items;
	}

	// Sensible fallback before a menu is assigned.
	$fallback = [
		[ 'label' => __( 'Projects', 'lab' ), 'url' => get_post_type_archive_link( 'lab_project' ) ],
		[ 'label' => __( 'Services', 'lab' ), 'url' => lab_page_url( 'services' ) ],
		[ 'label' => __( 'Studio', 'lab' ), 'url' => lab_page_url( 'studio' ) ],
		[ 'label' => __( 'Contact', 'lab' ), 'url' => lab_page_url( 'contact' ) ],
	];
	foreach ( $fallback as &$item ) {
		$item['current'] = false;
	}
	return array_values( array_filter( $fallback, static fn( $i ) => ! empty( $i['url'] ) ) );
}

/** Find a page by slug, falling back to the home URL. */
function lab_page_url( string $slug ): string {
	$page = get_page_by_path( $slug );
	return $page ? (string) get_permalink( $page ) : home_url( '/' . $slug . '/' );
}

function lab_contact_url(): string {
	return lab_page_url( 'contact' );
}
