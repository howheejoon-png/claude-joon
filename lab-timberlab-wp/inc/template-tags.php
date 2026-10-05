<?php
/** Rendering helpers shared by the templates. */

defined( 'ABSPATH' ) || exit;

/** The large page heading: a custom one if set, otherwise the page title. */
function lab_page_heading( int $post_id ): array {
	$heading = (string) lab_get( $post_id, 'lab_heading' );
	return [
		'text' => lab_known( $heading ) ? $heading : get_the_title( $post_id ),
		'em'   => (string) lab_get( $post_id, 'lab_heading_em' ),
	];
}

/** True when the first section behind the header is a dark one. */
function lab_header_starts_dark(): bool {
	return is_front_page();
}

/** Placeholder values should never reach the page as if they were facts. */
function lab_known( ?string $value ): bool {
	$value = trim( (string) $value );
	if ( '' === $value || '—' === $value ) {
		return false;
	}
	return ! preg_match( '/to be confirmed|to be supplied|tbc/i', $value );
}

/** Turn *emphasis* into the greyed display span. */
function lab_emphasis( string $text ): string {
	$escaped = esc_html( $text );
	return preg_replace( '/\*(.+?)\*/', '<em>$1</em>', $escaped );
}

/** Display heading with its greyed second half. */
function lab_heading( string $heading, string $em = '', string $classes = 'display display-lg' ): void {
	printf( '<h2 class="%s" data-reveal="lines">', esc_attr( $classes ) );
	echo esc_html( $heading );
	if ( lab_known( $em ) ) {
		echo ' <em>' . esc_html( $em ) . '</em>';
	}
	echo '</h2>';
}

/** The repeated label / heading / aside block above each section. */
function lab_sec_head( string $label, string $heading, string $em = '', string $aside = '' ): void {
	echo '<div class="sec-head">';
	if ( lab_known( $label ) ) {
		printf( '<div class="sec-head__label label muted" data-reveal="fade"><span>%s</span></div>', esc_html( $label ) );
	}
	if ( lab_known( $heading ) ) {
		echo '<div class="sec-head__title">';
		lab_heading( $heading, $em );
		echo '</div>';
	}
	if ( lab_known( $aside ) ) {
		printf( '<p class="sec-head__aside muted" data-reveal="fade">%s</p>', esc_html( $aside ) );
	}
	echo '</div>';
}

function lab_arrow( string $class = 'arrow' ): string {
	return sprintf(
		'<svg class="%s" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 12L12 2M4 2h8v8"/></svg>',
		esc_attr( $class )
	);
}

function lab_arrow_lg(): string {
	return '<svg class="arrow-lg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 40L40 8M14 8h26v26"/></svg>';
}

/** Map a layout shape onto a registered image size. */
function lab_size_for( string $shape ): string {
	return match ( $shape ) {
		'tall'   => 'lab-tall',
		'square' => 'lab-square',
		'land'   => 'lab-land',
		'hero'   => 'lab-hero',
		default  => 'lab-wide',
	};
}

/** An <img> with the designed placeholder as a fallback when nothing is set. */
function lab_image( int $attachment_id, string $shape = 'wide', string $alt = '', bool $eager = false ): string {
	$size = lab_size_for( $shape );
	if ( $attachment_id && wp_attachment_is_image( $attachment_id ) ) {
		return wp_get_attachment_image( $attachment_id, $size, false, [
			'alt'           => $alt,
			'loading'       => $eager ? 'eager' : 'lazy',
			'decoding'      => 'async',
			'fetchpriority' => $eager ? 'high' : 'auto',
		] );
	}
	$n = ( abs( crc32( $alt . $shape ) ) % 8 ) + 1;
	return sprintf(
		'<img src="%s" alt="%s" loading="lazy" decoding="async">',
		esc_url( LAB_URI . '/assets/placeholders/ph-' . $n . '.svg' ),
		esc_attr( $alt )
	);
}

/** The property type a project is filed under. */
function lab_property_type( int $post_id ): string {
	$terms = get_the_terms( $post_id, 'lab_property_type' );
	if ( ! $terms || is_wp_error( $terms ) ) {
		return '';
	}
	return $terms[0]->name;
}

/** Tags under a project card — unconfirmed fields are simply omitted. */
function lab_project_tags( int $post_id ): array {
	$tags = [
		lab_property_type( $post_id ),
		(string) lab_get( $post_id, 'lab_home_type' ),
		(string) lab_get( $post_id, 'lab_location' ),
		(string) lab_get( $post_id, 'lab_direction' ),
	];
	return array_values( array_filter( $tags, 'lab_known' ) );
}

/**
 * A project card as used on the homepage sequence and the Projects index.
 *
 * @param array{shape?:string,number?:string,show_number?:bool,eager?:bool,parallax?:int} $args
 */
function lab_project_card( WP_Post $post, array $args = [] ): void {
	$shape    = $args['shape'] ?? 'wide';
	$number   = $args['number'] ?? '';
	$parallax = $args['parallax'] ?? 6;
	$type     = lab_property_type( $post->ID );
	$title    = get_the_title( $post );
	$alt      = trim( $title . ' — ' . implode( ', ', lab_project_tags( $post->ID ) ), ' —,' );

	printf(
		'<a class="proj proj--%s" href="%s" aria-label="%s">',
		esc_attr( $shape ),
		esc_url( get_permalink( $post ) ),
		esc_attr( $title )
	);

	if ( ! empty( $args['show_number'] ) && $number ) {
		printf( '<div class="proj__num" aria-hidden="true">%s', esc_html( $number ) );
		if ( $type ) {
			printf( '<sup>%s</sup>', esc_html( $type ) );
		}
		echo '</div>';
	}

	printf( '<div class="frame frame--shade" data-reveal="clip" data-parallax="%d">', (int) $parallax );
	echo lab_image( (int) get_post_thumbnail_id( $post ), $shape, $alt, ! empty( $args['eager'] ) );
	echo '</div>';

	echo '<div class="proj__meta">';
	printf( '<h3 class="proj__title">%s</h3>', esc_html( $title ) );
	$tags = lab_project_tags( $post->ID );
	if ( $tags ) {
		echo '<ul class="proj__tags">';
		foreach ( $tags as $tag ) {
			printf( '<li>%s</li>', esc_html( $tag ) );
		}
		echo '</ul>';
	}
	echo '</div></a>';
}

/** Fetch projects in their editor-defined order. */
function lab_projects( array $args = [] ): array {
	return get_posts( wp_parse_args( $args, [
		'post_type'      => 'lab_project',
		'posts_per_page' => -1,
		'orderby'        => [ 'menu_order' => 'ASC', 'date' => 'DESC' ],
	] ) );
}

/** Projects ticked for the homepage sequence (max six). */
function lab_featured_projects(): array {
	$featured = lab_projects( [
		'posts_per_page' => 6,
		'meta_query'     => [ [ 'key' => 'lab_featured', 'value' => '1' ] ],
	] );
	return $featured ?: array_slice( lab_projects( [ 'posts_per_page' => 6 ] ), 0, 6 );
}

/** Zero-padded sequence number for a project's position on the page. */
function lab_number( int $index ): string {
	return str_pad( (string) ( $index + 1 ), 2, '0', STR_PAD_LEFT );
}

/** Contact details, assembled once. */
function lab_contact(): array {
	return [
		'address'  => array_values( array_filter( array_map( 'trim', explode( "\n", (string) lab_opt( 'address' ) ) ) ) ),
		'map_url'  => (string) lab_opt( 'map_url' ),
		'phone'    => (string) lab_opt( 'phone' ),
		'tel'      => (string) lab_opt( 'phone_raw' ),
		'email'    => (string) lab_opt( 'email' ),
		'whatsapp' => (string) lab_opt( 'whatsapp' ),
		'hours'    => (array) lab_opt( 'hours', [] ),
		'socials'  => (array) lab_opt( 'socials', [] ),
	];
}

/** The contact list beside the enquiry form. */
function lab_contact_list( bool $with_hours = false ): void {
	$c = lab_contact();
	echo '<ul class="enquiry__alt" data-reveal="fade">';
	if ( $c['address'] ) {
		printf(
			'<li><span>%s</span><a href="%s" target="_blank" rel="noopener">%s</a></li>',
			esc_html__( 'Studio', 'lab' ),
			esc_url( $c['map_url'] ),
			wp_kses_post( implode( '<br>', array_map( 'esc_html', $c['address'] ) ) )
		);
	}
	if ( $c['phone'] ) {
		printf(
			'<li><span>%s</span><a href="tel:%s">%s</a></li>',
			esc_html__( 'Phone', 'lab' ),
			esc_attr( $c['tel'] ),
			esc_html( $c['phone'] )
		);
	}
	if ( $c['email'] ) {
		printf(
			'<li><span>%s</span><a href="mailto:%s">%s</a></li>',
			esc_html__( 'Email', 'lab' ),
			esc_attr( $c['email'] ),
			esc_html( $c['email'] )
		);
	}
	if ( $with_hours && $c['hours'] ) {
		printf( '<li><span>%s</span><span class="hours">', esc_html__( 'Opening hours', 'lab' ) );
		foreach ( $c['hours'] as $row ) {
			printf( '<span><i>%s</i><b>%s</b></span>', esc_html( $row['days'] ?? '' ), esc_html( $row['time'] ?? '' ) );
		}
		echo '</span></li>';
	}
	echo '</ul>';
}
