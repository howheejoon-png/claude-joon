<?php
/** Theme supports, menus and the image sizes the layouts depend on. */

defined( 'ABSPATH' ) || exit;

add_action( 'after_setup_theme', 'lab_setup' );
function lab_setup(): void {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', [ 'search-form', 'gallery', 'caption', 'style', 'script' ] );
	add_theme_support( 'responsive-embeds' );

	register_nav_menus( [
		'primary' => __( 'Primary navigation', 'lab' ),
		'footer'  => __( 'Footer navigation', 'lab' ),
	] );

	/**
	 * The layouts crop to fixed ratios, so we generate matching sizes rather than
	 * letting the browser downscale full-size uploads.
	 */
	add_image_size( 'lab-hero', 2400, 1350, true );   // 16:9 hero
	add_image_size( 'lab-wide', 2000, 1000, true );   // 2:1 full-width card
	add_image_size( 'lab-land', 2000, 1333, true );   // 3:2
	add_image_size( 'lab-4x3',  1600, 1200, true );   // 4:3 pair
	add_image_size( 'lab-tall', 1500, 1875, true );   // 4:5 pair
	add_image_size( 'lab-square', 1400, 1400, true ); // 1:1
	add_image_size( 'lab-thumb', 800, 600, true );
}

/** Content width for embeds. */
add_action( 'after_setup_theme', function (): void {
	$GLOBALS['content_width'] = 1680;
} );

/** Expose the image-size choices the gallery field offers. */
function lab_gallery_shapes(): array {
	return [
		'wide'   => __( 'Wide (16:9)', 'lab' ),
		'tall'   => __( 'Tall (4:5)', 'lab' ),
		'square' => __( 'Square (1:1)', 'lab' ),
	];
}
