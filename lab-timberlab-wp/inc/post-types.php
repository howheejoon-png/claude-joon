<?php
/** Custom post types and the taxonomy that drives project filtering. */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'lab_register_content' );
function lab_register_content(): void {

	register_post_type( 'lab_project', [
		'labels' => [
			'name'               => __( 'Projects', 'lab' ),
			'singular_name'      => __( 'Project', 'lab' ),
			'add_new_item'       => __( 'Add new project', 'lab' ),
			'edit_item'          => __( 'Edit project', 'lab' ),
			'all_items'          => __( 'All projects', 'lab' ),
			'featured_image'     => __( 'Cover photograph', 'lab' ),
			'set_featured_image' => __( 'Set cover photograph', 'lab' ),
		],
		'public'        => true,
		'menu_icon'     => 'dashicons-format-gallery',
		'menu_position' => 20,
		'supports'      => [ 'title', 'thumbnail', 'page-attributes' ],
		'has_archive'   => true,
		'rewrite'       => [ 'slug' => 'projects' ],
		'show_in_rest'  => true,
	] );

	register_taxonomy( 'lab_property_type', 'lab_project', [
		'labels' => [
			'name'          => __( 'Property types', 'lab' ),
			'singular_name' => __( 'Property type', 'lab' ),
			'add_new_item'  => __( 'Add property type', 'lab' ),
		],
		'public'            => true,
		'hierarchical'      => true,
		'show_admin_column' => true,
		'show_in_rest'      => true,
		'rewrite'           => [ 'slug' => 'property-type' ],
	] );

	register_post_type( 'lab_service', [
		'labels' => [
			'name'          => __( 'Services', 'lab' ),
			'singular_name' => __( 'Service', 'lab' ),
			'add_new_item'  => __( 'Add new service', 'lab' ),
			'all_items'     => __( 'All services', 'lab' ),
		],
		'public'        => false,
		'show_ui'       => true,
		'menu_icon'     => 'dashicons-hammer',
		'menu_position' => 21,
		'supports'      => [ 'title', 'thumbnail', 'page-attributes' ],
	] );

	register_post_type( 'lab_step', [
		'labels' => [
			'name'          => __( 'Process steps', 'lab' ),
			'singular_name' => __( 'Process step', 'lab' ),
			'add_new_item'  => __( 'Add process step', 'lab' ),
			'all_items'     => __( 'Process steps', 'lab' ),
		],
		'public'        => false,
		'show_ui'       => true,
		'menu_icon'     => 'dashicons-controls-repeat',
		'menu_position' => 22,
		'supports'      => [ 'title', 'page-attributes' ],
	] );

	register_post_type( 'lab_person', [
		'labels' => [
			'name'          => __( 'Team', 'lab' ),
			'singular_name' => __( 'Team member', 'lab' ),
			'add_new_item'  => __( 'Add team member', 'lab' ),
			'all_items'     => __( 'Team', 'lab' ),
		],
		'public'        => false,
		'show_ui'       => true,
		'menu_icon'     => 'dashicons-groups',
		'menu_position' => 24,
		'supports'      => [ 'title', 'thumbnail', 'page-attributes' ],
	] );

	register_post_type( 'lab_principle', [
		'labels' => [
			'name'          => __( 'Principles', 'lab' ),
			'singular_name' => __( 'Principle', 'lab' ),
			'add_new_item'  => __( 'Add principle', 'lab' ),
			'all_items'     => __( 'Principles', 'lab' ),
		],
		'public'        => false,
		'show_ui'       => true,
		'menu_icon'     => 'dashicons-editor-ol',
		'menu_position' => 23,
		'supports'      => [ 'title', 'page-attributes' ],
	] );
}

/** Order every CPT listing by the drag-and-drop menu order. */
add_action( 'pre_get_posts', function ( WP_Query $q ): void {
	if ( is_admin() || ! $q->is_main_query() ) {
		return;
	}
	if ( $q->is_post_type_archive( 'lab_project' ) || $q->is_tax( 'lab_property_type' ) ) {
		$q->set( 'orderby', [ 'menu_order' => 'ASC', 'date' => 'DESC' ] );
		$q->set( 'posts_per_page', -1 );
	}
} );

/**
 * The 3D process scene is choreographed against exactly four steps.
 * Warn rather than silently falling out of sync.
 */
add_action( 'admin_notices', function (): void {
	$screen = get_current_screen();
	if ( ! $screen || 'lab_step' !== $screen->post_type ) {
		return;
	}
	$count = (int) wp_count_posts( 'lab_step' )->publish;
	if ( 4 === $count || 0 === $count ) {
		return;
	}
	printf(
		'<div class="notice notice-warning"><p>%s</p></div>',
		esc_html( sprintf(
			/* translators: %d: number of published process steps */
			__( 'There are %d published process steps. The 3D "From plan to place" animation is choreographed for exactly four, so the visuals will drift out of step with the text. Ask your developer to re-time the scene if you need a different number.', 'lab' ),
			$count
		) )
	);
} );
