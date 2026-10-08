<?php
/**
 * A small native field toolkit: text, textarea, media, simple lists and
 * repeating rows. Used by both the post meta boxes and the theme settings page,
 * so the admin only ever learns one set of controls.
 */

defined( 'ABSPATH' ) || exit;

/** Read a post meta value with a fallback. */
function lab_get( int $post_id, string $key, mixed $default = '' ): mixed {
	$value = get_post_meta( $post_id, $key, true );
	return ( '' === $value || null === $value ) ? $default : $value;
}

function lab_label( string $for, string $label, string $help = '' ): void {
	printf( '<label class="lab-f__label" for="%s">%s</label>', esc_attr( $for ), esc_html( $label ) );
	if ( $help ) {
		printf( '<p class="lab-f__help">%s</p>', esc_html( $help ) );
	}
}

function lab_field_text( string $name, string $value, string $label, string $help = '', string $type = 'text' ): void {
	echo '<div class="lab-f">';
	lab_label( $name, $label, $help );
	printf(
		'<input class="lab-f__input" type="%s" id="%s" name="%s" value="%s">',
		esc_attr( $type ),
		esc_attr( $name ),
		esc_attr( $name ),
		esc_attr( $value )
	);
	echo '</div>';
}

function lab_field_textarea( string $name, string $value, string $label, string $help = '', int $rows = 3 ): void {
	echo '<div class="lab-f">';
	lab_label( $name, $label, $help );
	printf(
		'<textarea class="lab-f__input" id="%s" name="%s" rows="%d">%s</textarea>',
		esc_attr( $name ),
		esc_attr( $name ),
		$rows,
		esc_textarea( $value )
	);
	echo '</div>';
}

function lab_field_select( string $name, string $value, array $choices, string $label, string $help = '' ): void {
	echo '<div class="lab-f">';
	lab_label( $name, $label, $help );
	printf( '<select class="lab-f__input" id="%s" name="%s">', esc_attr( $name ), esc_attr( $name ) );
	foreach ( $choices as $key => $text ) {
		printf( '<option value="%s"%s>%s</option>', esc_attr( $key ), selected( $value, $key, false ), esc_html( $text ) );
	}
	echo '</select></div>';
}

/**
 * Single file chooser backed by the media library.
 *
 * $type is the library the picker shows — 'image' by default, 'video' for the
 * hero film. Without it the video fields opened an image-only modal and could
 * never be filled.
 */
function lab_field_media( string $name, int $value, string $label, string $help = '', string $type = 'image' ): void {
	$is_image = 'image' === $type;
	$src      = $value && $is_image ? wp_get_attachment_image_url( $value, 'medium' ) : '';
	$file     = $value && ! $is_image ? wp_get_attachment_url( $value ) : '';
	printf( '<div class="lab-f lab-media" data-lab-media data-lab-media-type="%s">', esc_attr( $type ) );
	lab_label( $name, $label, $help );
	printf( '<input type="hidden" name="%s" value="%d" data-lab-media-input>', esc_attr( $name ), $value );
	printf(
		'<div class="lab-media__preview" data-lab-media-preview>%s</div>',
		$src ? '<img src="' . esc_url( $src ) . '" alt="">' : ( $file ? '<code>' . esc_html( wp_basename( $file ) ) . '</code>' : '' )
	);
	printf(
		'<p><button type="button" class="button" data-lab-media-pick>%s</button> <button type="button" class="button-link" data-lab-media-clear>%s</button></p>',
		$is_image ? esc_html__( 'Choose image', 'lab' ) : esc_html__( 'Choose file', 'lab' ),
		esc_html__( 'Remove', 'lab' )
	);
	echo '</div>';
}

/**
 * Ordered gallery of images, each with a shape that decides how the layout
 * crops it. Stored as [ [ id, shape, alt ], ... ].
 */
function lab_field_gallery( string $name, array $value, string $label, string $help = '' ): void {
	echo '<div class="lab-f lab-gal" data-lab-gallery>';
	lab_label( $name, $label, $help );
	echo '<div class="lab-gal__items" data-lab-gallery-items>';
	foreach ( $value as $i => $item ) {
		lab_gallery_row( $name, (int) $i, $item );
	}
	echo '</div>';
	printf(
		'<p><button type="button" class="button" data-lab-gallery-add>%s</button></p>',
		esc_html__( 'Add photographs', 'lab' )
	);
	echo '<script type="text/html" data-lab-gallery-tpl>';
	lab_gallery_row( $name, -1, [ 'id' => 0, 'shape' => 'wide', 'alt' => '' ] );
	echo '</script>';
	echo '</div>';
}

function lab_gallery_row( string $name, int $index, array $item ): void {
	$i     = ( -1 === $index ) ? '__i__' : (string) $index;
	$id    = (int) ( $item['id'] ?? 0 );
	$shape = (string) ( $item['shape'] ?? 'wide' );
	$alt   = (string) ( $item['alt'] ?? '' );
	$src   = $id ? wp_get_attachment_image_url( $id, 'thumbnail' ) : '';

	printf( '<div class="lab-gal__item" data-lab-gallery-item><span class="lab-gal__handle" title="%s">⠿</span>', esc_attr__( 'Drag to reorder', 'lab' ) );
	printf( '<div class="lab-gal__thumb">%s</div>', $src ? '<img src="' . esc_url( $src ) . '" alt="">' : '' );
	printf( '<input type="hidden" name="%s[%s][id]" value="%d">', esc_attr( $name ), esc_attr( $i ), $id );
	echo '<div class="lab-gal__meta">';
	printf( '<select name="%s[%s][shape]">', esc_attr( $name ), esc_attr( $i ) );
	foreach ( lab_gallery_shapes() as $key => $shape_label ) {
		printf( '<option value="%s"%s>%s</option>', esc_attr( $key ), selected( $shape, $key, false ), esc_html( $shape_label ) );
	}
	echo '</select>';
	printf(
		'<input type="text" name="%s[%s][alt]" value="%s" placeholder="%s">',
		esc_attr( $name ),
		esc_attr( $i ),
		esc_attr( $alt ),
		esc_attr__( 'Describe the photo (for accessibility and SEO)', 'lab' )
	);
	echo '</div>';
	printf( '<button type="button" class="button-link lab-gal__remove" data-lab-gallery-remove>%s</button>', esc_html__( 'Remove', 'lab' ) );
	echo '</div>';
}

/** Repeating single-line list, e.g. the materials on a project. */
function lab_field_list( string $name, array $value, string $label, string $help = '', string $placeholder = '' ): void {
	echo '<div class="lab-f lab-rep" data-lab-repeat>';
	lab_label( $name, $label, $help );
	echo '<div class="lab-rep__rows" data-lab-repeat-rows>';
	foreach ( $value as $line ) {
		lab_list_row( $name, (string) $line, $placeholder );
	}
	echo '</div>';
	printf( '<p><button type="button" class="button" data-lab-repeat-add>%s</button></p>', esc_html__( 'Add row', 'lab' ) );
	echo '<script type="text/html" data-lab-repeat-tpl>';
	lab_list_row( $name, '', $placeholder );
	echo '</script>';
	echo '</div>';
}

function lab_list_row( string $name, string $line, string $placeholder ): void {
	echo '<div class="lab-rep__row" data-lab-repeat-row>';
	printf( '<span class="lab-gal__handle">⠿</span>' );
	printf(
		'<input type="text" name="%s[]" value="%s" placeholder="%s">',
		esc_attr( $name ),
		esc_attr( $line ),
		esc_attr( $placeholder )
	);
	printf( '<button type="button" class="button-link" data-lab-repeat-remove>%s</button>', esc_html__( 'Remove', 'lab' ) );
	echo '</div>';
}

/**
 * Repeating rows with named sub-fields.
 * $cols = [ 'key' => [ 'label' => 'Days', 'type' => 'text' ], ... ]
 */
function lab_field_rows( string $name, array $value, array $cols, string $label, string $help = '' ): void {
	echo '<div class="lab-f lab-rep" data-lab-repeat>';
	lab_label( $name, $label, $help );
	echo '<div class="lab-rep__rows" data-lab-repeat-rows>';
	foreach ( $value as $i => $row ) {
		lab_rows_row( $name, (array) $row, $cols, (int) $i );
	}
	echo '</div>';
	printf( '<p><button type="button" class="button" data-lab-repeat-add>%s</button></p>', esc_html__( 'Add row', 'lab' ) );
	echo '<script type="text/html" data-lab-repeat-tpl>';
	lab_rows_row( $name, [], $cols, -1 );
	echo '</script>';
	echo '</div>';
}

function lab_rows_row( string $name, array $row, array $cols, int $index = -1 ): void {
	$i = ( -1 === $index ) ? '__i__' : (string) $index;
	echo '<div class="lab-rep__row lab-rep__row--cols" data-lab-repeat-row>';
	echo '<span class="lab-gal__handle">⠿</span>';
	foreach ( $cols as $key => $col ) {
		printf(
			'<input type="%s" name="%s[%s][%s]" value="%s" placeholder="%s">',
			esc_attr( $col['type'] ?? 'text' ),
			esc_attr( $name ),
			esc_attr( $i ),
			esc_attr( $key ),
			esc_attr( (string) ( $row[ $key ] ?? '' ) ),
			esc_attr( $col['label'] ?? $key )
		);
	}
	printf( '<button type="button" class="button-link" data-lab-repeat-remove>%s</button>', esc_html__( 'Remove', 'lab' ) );
	echo '</div>';
}

/* ------------------------------------------------------------------ *
 * Sanitisers
 * ------------------------------------------------------------------ */

function lab_clean_list( mixed $raw ): array {
	if ( ! is_array( $raw ) ) {
		return [];
	}
	$out = [];
	foreach ( $raw as $line ) {
		$line = sanitize_text_field( (string) $line );
		if ( '' !== $line ) {
			$out[] = $line;
		}
	}
	return $out;
}

function lab_clean_gallery( mixed $raw ): array {
	if ( ! is_array( $raw ) ) {
		return [];
	}
	$shapes = array_keys( lab_gallery_shapes() );
	$out    = [];
	foreach ( $raw as $item ) {
		$id = (int) ( $item['id'] ?? 0 );
		if ( $id <= 0 ) {
			continue;
		}
		$shape = (string) ( $item['shape'] ?? 'wide' );
		$out[] = [
			'id'    => $id,
			'shape' => in_array( $shape, $shapes, true ) ? $shape : 'wide',
			'alt'   => sanitize_text_field( (string) ( $item['alt'] ?? '' ) ),
		];
	}
	return $out;
}

function lab_clean_rows( mixed $raw, array $cols ): array {
	if ( ! is_array( $raw ) ) {
		return [];
	}
	$out = [];
	foreach ( $raw as $row ) {
		if ( ! is_array( $row ) ) {
			continue;
		}
		$clean = [];
		$empty = true;
		foreach ( array_keys( $cols ) as $key ) {
			$val           = sanitize_text_field( (string) ( $row[ $key ] ?? '' ) );
			$clean[ $key ] = $val;
			if ( '' !== $val ) {
				$empty = false;
			}
		}
		if ( ! $empty ) {
			$out[] = $clean;
		}
	}
	return $out;
}
