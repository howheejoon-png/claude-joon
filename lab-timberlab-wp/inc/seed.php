<?php
/**
 * One-click import of the approved concept content: the nine projects and their
 * photography, services, process steps, principles, pages and the menu.
 *
 * Safe to run more than once — anything already imported is skipped.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'admin_menu', function (): void {
	add_submenu_page(
		'lab-settings',
		__( 'Import starter content', 'lab' ),
		__( 'Import content', 'lab' ),
		'manage_options',
		'lab-seed',
		'lab_seed_page'
	);
} );

function lab_seed_page(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	echo '<div class="wrap"><h1>' . esc_html__( 'Import starter content', 'lab' ) . '</h1>';

	if ( isset( $_POST['lab_seed_nonce'] ) && wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['lab_seed_nonce'] ) ), 'lab_seed' ) ) {
		$log = lab_run_seed();
		echo '<div class="notice notice-success"><p>' . esc_html__( 'Import finished.', 'lab' ) . '</p></div>';
		echo '<pre style="background:#fff;border:1px solid #dcdcde;padding:1rem;max-height:30rem;overflow:auto">';
		echo esc_html( implode( "\n", $log ) );
		echo '</pre>';
	} else {
		echo '<p>' . esc_html__( 'This imports the nine projects photographed by L.A.B, their galleries, the services, the four process steps, the principles, the pages and the navigation menu.', 'lab' ) . '</p>';
		echo '<p>' . esc_html__( 'Running it twice is safe: anything already present is left alone. Once you are happy, the /seed folder inside the theme can be deleted to save space.', 'lab' ) . '</p>';
		echo '<form method="post">';
		wp_nonce_field( 'lab_seed', 'lab_seed_nonce' );
		submit_button( __( 'Import starter content', 'lab' ) );
		echo '</form>';
	}
	echo '</div>';
}

/** Sideload one seed file into the media library, reusing it if already there. */
function lab_seed_attachment( string $relative, string $alt = '' ): int {
	static $seen = [];
	if ( isset( $seen[ $relative ] ) ) {
		return $seen[ $relative ];
	}

	$path = LAB_DIR . '/seed/' . ltrim( $relative, '/' );
	if ( ! file_exists( $path ) ) {
		return 0;
	}

	$slug     = sanitize_title( 'lab-' . str_replace( [ '/', '.' ], '-', $relative ) );
	$existing = get_posts( [
		'post_type'      => 'attachment',
		'post_status'    => 'inherit',
		'name'           => $slug,
		'posts_per_page' => 1,
	] );
	if ( $existing ) {
		$seen[ $relative ] = $existing[0]->ID;
		return $existing[0]->ID;
	}

	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';

	$upload = wp_upload_bits( basename( $path ), null, (string) file_get_contents( $path ) );
	if ( ! empty( $upload['error'] ) ) {
		return 0;
	}

	$type = wp_check_filetype( $upload['file'] );
	$id   = wp_insert_attachment( [
		'post_mime_type' => $type['type'],
		'post_title'     => $alt ?: pathinfo( $path, PATHINFO_FILENAME ),
		'post_name'      => $slug,
		'post_status'    => 'inherit',
	], $upload['file'] );

	if ( is_wp_error( $id ) || ! $id ) {
		return 0;
	}
	wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $upload['file'] ) );
	if ( $alt ) {
		update_post_meta( $id, '_wp_attachment_image_alt', $alt );
	}

	$seen[ $relative ] = (int) $id;
	return (int) $id;
}

/** Create a post of the given type unless one with the same title exists. */
function lab_seed_post( string $type, string $title, int $order ): array {
	$existing = get_posts( [ 'post_type' => $type, 'title' => $title, 'posts_per_page' => 1, 'post_status' => 'any' ] );
	if ( $existing ) {
		return [ $existing[0]->ID, false ];
	}
	$id = wp_insert_post( [
		'post_type'   => $type,
		'post_title'  => $title,
		'post_status' => 'publish',
		'menu_order'  => $order,
	] );
	return is_wp_error( $id ) ? [ 0, false ] : [ (int) $id, true ];
}

function lab_run_seed(): array {
	$log  = [];
	$file = LAB_DIR . '/seed/content.json';
	if ( ! file_exists( $file ) ) {
		return [ 'No seed/content.json found — nothing to import.' ];
	}
	$data = json_decode( (string) file_get_contents( $file ), true );
	if ( ! is_array( $data ) ) {
		return [ 'seed/content.json could not be read.' ];
	}

	/* Property types -------------------------------------------------- */
	foreach ( (array) ( $data['propertyTypes'] ?? [] ) as $type ) {
		$name = (string) ( $type['name'] ?? '' );
		if ( ! $name ) {
			continue;
		}
		$found = term_exists( $name, 'lab_property_type' );
		if ( $found ) {
			// Backfill the sub-label on terms created before it existed.
			$term_id = (int) ( is_array( $found ) ? $found['term_id'] : $found );
			if ( ! empty( $type['sub'] ) && ! get_term_meta( $term_id, 'lab_sub', true ) ) {
				update_term_meta( $term_id, 'lab_sub', (string) $type['sub'] );
				$log[] = "Sub-label set: {$name}";
			}
			if ( '' === (string) get_term_meta( $term_id, 'lab_is_home', true ) ) {
				update_term_meta( $term_id, 'lab_is_home', empty( $type['isHome'] ) ? '0' : '1' );
			}
			continue;
		}
		$created = wp_insert_term( $name, 'lab_property_type', [ 'description' => (string) ( $type['desc'] ?? '' ) ] );
		if ( ! is_wp_error( $created ) ) {
			update_term_meta( (int) $created['term_id'], 'lab_sub', (string) ( $type['sub'] ?? '' ) );
			update_term_meta( (int) $created['term_id'], 'lab_is_home', empty( $type['isHome'] ) ? '0' : '1' );
		}
		$log[] = "Property type: {$name}";
	}

	/* Projects --------------------------------------------------------- */
	foreach ( (array) ( $data['projects'] ?? [] ) as $i => $project ) {
		[ $id, $created ] = lab_seed_post( 'lab_project', (string) $project['title'], $i );
		if ( ! $id ) {
			continue;
		}
		$log[] = ( $created ? 'Project: ' : 'Project (existing): ' ) . $project['title'];
		if ( ! $created ) {
			continue;
		}

		wp_update_post( [ 'ID' => $id, 'post_name' => sanitize_title( (string) $project['slug'] ) ] );
		wp_set_object_terms( $id, (string) $project['propertyType'], 'lab_property_type' );

		foreach ( [ 'homeType' => 'lab_home_type', 'location' => 'lab_location', 'direction' => 'lab_direction', 'year' => 'lab_year', 'summary' => 'lab_summary', 'brief' => 'lab_brief', 'response' => 'lab_response' ] as $from => $to ) {
			update_post_meta( $id, $to, (string) ( $project[ $from ] ?? '' ) );
		}
		update_post_meta( $id, 'lab_details', lab_clean_list( $project['details'] ?? [] ) );
		update_post_meta( $id, 'lab_featured', $i < 6 ? 1 : 0 );

		$cover = lab_seed_attachment( (string) $project['cover'], (string) $project['title'] );
		if ( $cover ) {
			set_post_thumbnail( $id, $cover );
		}
		if ( ! empty( $project['hero'] ) ) {
			$hero = lab_seed_attachment( (string) $project['hero'], (string) $project['title'] );
			if ( $hero ) {
				update_post_meta( $id, 'lab_hero', $hero );
			}
		}

		$gallery = [];
		foreach ( (array) ( $project['gallery'] ?? [] ) as $item ) {
			$att = lab_seed_attachment( (string) $item['file'], (string) ( $item['alt'] ?? '' ) );
			if ( $att ) {
				$gallery[] = [
					'id'    => $att,
					'shape' => (string) ( $item['shape'] ?? 'wide' ),
					'alt'   => (string) ( $item['alt'] ?? '' ),
				];
			}
		}
		update_post_meta( $id, 'lab_gallery', $gallery );
		$log[] = '  · ' . count( $gallery ) . ' gallery images';
	}

	/* Services, steps, principles -------------------------------------- */
	foreach ( (array) ( $data['services'] ?? [] ) as $i => $service ) {
		[ $id, $created ] = lab_seed_post( 'lab_service', (string) $service['title'], $i );
		if ( $id && $created ) {
			update_post_meta( $id, 'lab_summary', (string) $service['desc'] );
			update_post_meta( $id, 'lab_points', lab_clean_list( $service['points'] ?? [] ) );
			$img = lab_seed_attachment( (string) $service['image'], (string) $service['title'] );
			if ( $img ) {
				set_post_thumbnail( $id, $img );
			}
			$log[] = 'Service: ' . $service['title'];
		}
	}

	foreach ( (array) ( $data['steps'] ?? [] ) as $i => $step ) {
		[ $id, $created ] = lab_seed_post( 'lab_step', (string) $step['title'], $i );
		if ( $id && $created ) {
			update_post_meta( $id, 'lab_summary', (string) $step['text'] );
			update_post_meta( $id, 'lab_points', lab_clean_list( $step['tags'] ?? [] ) );
			$log[] = 'Process step: ' . $step['title'];
		}
	}

	$principles = [
		[ 'One team, start to finish', 'The people who draw your home are the people who build it. Nothing is lost between a designer\'s intent and a contractor\'s interpretation.', 'home' ],
		[ 'Decisions made visible', 'Layouts, materials and costs are put in front of you before work begins. You approve drawings, not descriptions.', 'home' ],
		[ 'Details you can inspect', 'Carpentry, finishes and services are checked at each stage, and the handover walk-through is done against the drawings you signed.', 'home' ],
		[ 'Plan before palette', 'Layout decides how a home feels far more than finishes do. We resolve the plan first, then dress it.', 'studio' ],
		[ 'Draw everything', 'If it will be built, it will be drawn. Drawings are how we agree, cost and check the work.', 'studio' ],
		[ 'Honest costs', 'A costed proposal sits next to every design. No surprises at the end, because there are none in the middle.', 'studio' ],
		[ 'Build to be inspected', 'Good joinery looks right from the inside of the drawer. We build as if every detail will be checked, because it will.', 'studio' ],
	];
	foreach ( $principles as $i => [ $title, $text, $where ] ) {
		[ $id, $created ] = lab_seed_post( 'lab_principle', $title, $i );
		if ( $id && $created ) {
			update_post_meta( $id, 'lab_summary', $text );
			update_post_meta( $id, 'lab_where', $where );
			$log[] = 'Principle: ' . $title;
		}
	}

	// Team placeholders, matching the approved concept. Replace these with real
	// people and portraits, or delete them to hide the section entirely.
	$team = [
		[ 'Name', 'Founder / Design lead' ],
		[ 'Name', 'Interior designer' ],
		[ 'Name', 'Project manager' ],
		[ 'Name', 'Carpentry lead' ],
	];
	foreach ( $team as $i => [ $person, $role ] ) {
		$existing = get_posts( [ 'post_type' => 'lab_person', 'posts_per_page' => 1, 'post_status' => 'any', 'offset' => $i ] );
		if ( $existing ) {
			continue;
		}
		$id = wp_insert_post( [ 'post_type' => 'lab_person', 'post_title' => $person, 'post_status' => 'publish', 'menu_order' => $i ] );
		if ( ! is_wp_error( $id ) ) {
			update_post_meta( $id, 'lab_role', $role );
			$log[] = 'Team placeholder: ' . $role;
		}
	}

	/* Pages and the front page ----------------------------------------- */
	$pages = [
		'home'     => [ 'Home', '', '', '', '' ],
		'services' => [ 'Services', 'page-services.php', 'A full-service design-and-build studio. Engage us for the whole home, or for the part that matters most.', 'What we', 'do.' ],
		'studio'   => [ 'Studio', 'page-studio.php', 'L.A.B is the interior design and design-and-build practice of Timberlab Pte Ltd.', 'Drawn here.', 'Built here.' ],
		'contact'  => [ 'Contact', 'page-contact.php', '', '', '' ],
	];
	$ids = [];
	foreach ( $pages as $slug => [ $title, $template, $excerpt, $heading, $heading_em ] ) {
		$page = get_page_by_path( $slug );
		if ( $page ) {
			$ids[ $slug ] = $page->ID;
			// Fill in the display heading on pages created before this existed.
			if ( $heading && ! lab_get( $page->ID, 'lab_heading' ) ) {
				update_post_meta( $page->ID, 'lab_heading', $heading );
				update_post_meta( $page->ID, 'lab_heading_em', $heading_em );
				$log[] = 'Page heading set: ' . $title;
			}
			continue;
		}
		$id = wp_insert_post( [
			'post_type'    => 'page',
			'post_title'   => $title,
			'post_name'    => $slug,
			'post_status'  => 'publish',
			'post_excerpt' => $excerpt,
			'post_content' => 'studio' === $slug
				? "<h2>A studio that draws, and a workshop that builds.</h2>\n<p>Most renovations pass through several hands: a designer, a contractor, a carpenter, a project manager. Each handover loses something. L.A.B was set up so that the same team is responsible from the first sketch to the final defects check.</p>\n<p>We work across HDB, BTO, condominium and landed homes, and we treat each with the same discipline: measure carefully, draw everything, cost it honestly, then build it well.</p>"
				: '',
		] );
		if ( ! is_wp_error( $id ) ) {
			if ( $template ) {
				update_post_meta( $id, '_wp_page_template', $template );
			}
			if ( $heading ) {
				update_post_meta( $id, 'lab_heading', $heading );
				update_post_meta( $id, 'lab_heading_em', $heading_em );
			}
			$ids[ $slug ] = (int) $id;
			$log[]        = 'Page: ' . $title;
		}
	}
	if ( ! empty( $ids['home'] ) ) {
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $ids['home'] );
	}

	/* Navigation menu --------------------------------------------------- */
	$menu = wp_get_nav_menu_object( 'Primary' );
	if ( $menu ) {
		// Repair menus created before Process was part of the navigation.
		$titles = wp_list_pluck( (array) wp_get_nav_menu_items( $menu->term_id ), 'title' );
		if ( ! in_array( 'Process', (array) $titles, true ) ) {
			wp_update_nav_menu_item( $menu->term_id, 0, [
				'menu-item-title'    => __( 'Process', 'lab' ),
				'menu-item-url'      => home_url( '/#process' ),
				'menu-item-type'     => 'custom',
				'menu-item-status'   => 'publish',
				'menu-item-position' => 3,
			] );
			$log[] = 'Added the missing Process link to the navigation.';
		}
		// Keep the designed order regardless of when each item was added.
		$order = [ 'Projects' => 1, 'Services' => 2, 'Process' => 3, 'Studio' => 4, 'Contact' => 5 ];
		foreach ( (array) wp_get_nav_menu_items( $menu->term_id ) as $item ) {
			if ( isset( $order[ $item->title ] ) && (int) $item->menu_order !== $order[ $item->title ] ) {
				wp_update_post( [ 'ID' => $item->ID, 'menu_order' => $order[ $item->title ] ] );
			}
		}
	} else {
		$menu_id = wp_create_nav_menu( 'Primary' );
		if ( ! is_wp_error( $menu_id ) ) {
			wp_update_nav_menu_item( $menu_id, 0, [
				'menu-item-title'     => __( 'Projects', 'lab' ),
				'menu-item-type'      => 'post_type_archive',
				'menu-item-object'    => 'lab_project',
				'menu-item-status'    => 'publish',
				'menu-item-position'  => 1,
			] );
			$pos = 2;
			foreach ( [ 'services', 'process', 'studio', 'contact' ] as $slug ) {
				if ( 'process' === $slug ) {
					wp_update_nav_menu_item( $menu_id, 0, [
						'menu-item-title'    => __( 'Process', 'lab' ),
						'menu-item-url'      => home_url( '/#process' ),
						'menu-item-type'     => 'custom',
						'menu-item-status'   => 'publish',
						'menu-item-position' => $pos++,
					] );
					continue;
				}
				if ( empty( $ids[ $slug ] ) ) {
					continue;
				}
				wp_update_nav_menu_item( $menu_id, 0, [
					'menu-item-object-id' => $ids[ $slug ],
					'menu-item-object'    => 'page',
					'menu-item-type'      => 'post_type',
					'menu-item-status'    => 'publish',
					'menu-item-position'  => $pos++,
				] );
			}
			set_theme_mod( 'nav_menu_locations', [ 'primary' => $menu_id ] );
			$log[] = 'Navigation menu created and assigned.';
		}
	}

	/* Hero video and the sample figures --------------------------------- */
	$options = (array) get_option( LAB_OPTION, [] );
	$videos = [
		'video_desktop_webm' => '_video/hero.webm',
		'video_desktop'      => '_video/hero.mp4',
		'video_mobile_webm'  => '_video/hero-mobile.webm',
		'video_mobile'       => '_video/hero-mobile.mp4',
	];
	foreach ( $videos as $key => $relative ) {
		if ( empty( $options[ $key ] ) ) {
			$att = lab_seed_attachment( $relative, 'L.A.B hero film' );
			if ( $att ) {
				$options[ $key ] = $att;
				$log[]           = 'Hero video: ' . $relative;
			}
		}
	}
	if ( empty( $options['figures'] ) ) {
		$options['figures'] = [
			[ 'value' => '12', 'suffix' => '+', 'label' => 'Years in practice' ],
			[ 'value' => '260', 'suffix' => '+', 'label' => 'Homes completed' ],
			[ 'value' => '18', 'suffix' => '', 'label' => 'In-house team' ],
		];
		$options['figures_note'] = 'Sample figures — to be confirmed by L.A.B';
		$log[]                   = 'Studio figures seeded (sample values — replace with the real numbers).';
	}
	update_option( LAB_OPTION, wp_parse_args( $options, lab_defaults() ) );

	// Pretty permalinks: without a structure the project archive falls back to the home page.
	if ( ! get_option( 'permalink_structure' ) ) {
		update_option( 'permalink_structure', '/%postname%/' );
		$log[] = 'Permalinks set to post name.';
	}
	flush_rewrite_rules();
	$log[] = 'Permalinks refreshed.';
	return $log;
}
