<?php
/** Editing screens for projects, services, process steps and principles. */

defined( 'ABSPATH' ) || exit;

const LAB_NONCE = 'lab_meta_nonce';

add_action( 'add_meta_boxes', function (): void {
	add_meta_box( 'lab_project_details', __( 'Project details', 'lab' ), 'lab_box_project_details', 'lab_project', 'normal', 'high' );
	add_meta_box( 'lab_project_story', __( 'Project story', 'lab' ), 'lab_box_project_story', 'lab_project', 'normal', 'high' );
	add_meta_box( 'lab_project_media', __( 'Photography', 'lab' ), 'lab_box_project_media', 'lab_project', 'normal', 'default' );
	add_meta_box( 'lab_project_feature', __( 'Homepage', 'lab' ), 'lab_box_project_feature', 'lab_project', 'side', 'default' );
	add_meta_box( 'lab_service_box', __( 'Service details', 'lab' ), 'lab_box_service', 'lab_service', 'normal', 'high' );
	add_meta_box( 'lab_step_box', __( 'Step details', 'lab' ), 'lab_box_step', 'lab_step', 'normal', 'high' );
	add_meta_box( 'lab_person_box', __( 'Role', 'lab' ), 'lab_box_person', 'lab_person', 'normal', 'high' );
	add_meta_box( 'lab_principle_box', __( 'Principle', 'lab' ), 'lab_box_principle', 'lab_principle', 'normal', 'high' );
	add_meta_box( 'lab_page_box', __( 'Page heading', 'lab' ), 'lab_box_page', 'page', 'normal', 'high' );
} );

function lab_nonce_field(): void {
	wp_nonce_field( LAB_NONCE, LAB_NONCE );
}

function lab_box_project_details( WP_Post $post ): void {
	lab_nonce_field();
	lab_field_text( 'lab_home_type', (string) lab_get( $post->ID, 'lab_home_type' ), __( 'Home type', 'lab' ), __( 'For example: 4-Room Resale, 5-Room BTO, Terrace House. Leave blank to hide it.', 'lab' ) );
	lab_field_text( 'lab_location', (string) lab_get( $post->ID, 'lab_location' ), __( 'Location', 'lab' ), __( 'Estate or development name.', 'lab' ) );
	lab_field_text( 'lab_direction', (string) lab_get( $post->ID, 'lab_direction' ), __( 'Design direction', 'lab' ), __( 'For example: Warm contemporary, Modern farmhouse.', 'lab' ) );
	lab_field_text( 'lab_year', (string) lab_get( $post->ID, 'lab_year' ), __( 'Year completed', 'lab' ), __( 'Leave blank to hide it.', 'lab' ) );
	echo '<p class="lab-f__help">' . esc_html__( 'Property type (HDB, BTO, Condominium, Landed) is set in the Property types box, and drives the filter on the Projects page.', 'lab' ) . '</p>';
}

function lab_box_project_story( WP_Post $post ): void {
	lab_field_textarea( 'lab_summary', (string) lab_get( $post->ID, 'lab_summary' ), __( 'Summary', 'lab' ), __( 'One or two sentences. Shown large at the top of the project page.', 'lab' ), 3 );
	lab_field_textarea( 'lab_brief', (string) lab_get( $post->ID, 'lab_brief' ), __( 'The brief', 'lab' ), __( 'What the owners asked for.', 'lab' ), 4 );
	lab_field_textarea( 'lab_response', (string) lab_get( $post->ID, 'lab_response' ), __( 'The response', 'lab' ), __( 'What L.A.B did about it.', 'lab' ), 4 );
	lab_field_list( 'lab_details', (array) lab_get( $post->ID, 'lab_details', [] ), __( 'Design details', 'lab' ), __( 'Materials and making — one per row.', 'lab' ), __( 'e.g. Fluted walnut feature panels', 'lab' ) );
}

function lab_box_project_media( WP_Post $post ): void {
	echo '<p class="lab-f__help">' . esc_html__( 'The cover photograph is the Featured image, set in the sidebar. It is used on the homepage and the Projects page.', 'lab' ) . '</p>';
	lab_field_gallery( 'lab_gallery', (array) lab_get( $post->ID, 'lab_gallery', [] ), __( 'Gallery', 'lab' ), __( 'Shown on the project page. The shape decides how each photo is cropped, so pick the one that suits the composition.', 'lab' ) );
	echo '<hr>';
	echo '<p class="lab-f__help"><strong>' . esc_html__( 'Before and after (optional)', 'lab' ) . '</strong> — ' . esc_html__( 'the comparison slider only appears when both images are set.', 'lab' ) . '</p>';
	lab_field_media( 'lab_before', (int) lab_get( $post->ID, 'lab_before', 0 ), __( 'Before', 'lab' ) );
	lab_field_media( 'lab_after', (int) lab_get( $post->ID, 'lab_after', 0 ), __( 'After', 'lab' ) );
}

function lab_box_project_feature( WP_Post $post ): void {
	$featured = (int) lab_get( $post->ID, 'lab_featured', 0 );
	echo '<div class="lab-f">';
	printf(
		'<label><input type="checkbox" name="lab_featured" value="1"%s> %s</label>',
		checked( $featured, 1, false ),
		esc_html__( 'Show in the homepage sequence', 'lab' )
	);
	echo '<p class="lab-f__help">' . esc_html__( 'The homepage shows the first six ticked projects, in the order set by the Order field below. Every project appears on the Projects page regardless.', 'lab' ) . '</p>';
	echo '</div>';
	lab_field_media( 'lab_hero', (int) lab_get( $post->ID, 'lab_hero', 0 ), __( 'Hero photograph (optional)', 'lab' ), __( 'Used as the full-screen homepage background and as the poster frame behind the hero video. Falls back to the cover photograph.', 'lab' ) );
}

function lab_box_service( WP_Post $post ): void {
	lab_nonce_field();
	lab_field_textarea( 'lab_summary', (string) lab_get( $post->ID, 'lab_summary' ), __( 'Description', 'lab' ), __( 'One or two sentences, shown under the service name.', 'lab' ), 3 );
	lab_field_list( 'lab_points', (array) lab_get( $post->ID, 'lab_points', [] ), __( 'What it includes', 'lab' ), __( 'One per row.', 'lab' ), __( 'e.g. Layout and spatial planning', 'lab' ) );
	echo '<p class="lab-f__help">' . esc_html__( 'The accompanying photograph is the Featured image, set in the sidebar.', 'lab' ) . '</p>';
}

function lab_box_step( WP_Post $post ): void {
	lab_nonce_field();
	lab_field_textarea( 'lab_summary', (string) lab_get( $post->ID, 'lab_summary' ), __( 'Description', 'lab' ), '', 3 );
	lab_field_list( 'lab_points', (array) lab_get( $post->ID, 'lab_points', [] ), __( 'Tags', 'lab' ), __( 'Short labels shown under the text, one per row.', 'lab' ), __( 'e.g. Site visit', 'lab' ) );
}

function lab_box_page( WP_Post $post ): void {
	lab_nonce_field();
	lab_field_text( 'lab_heading', (string) lab_get( $post->ID, 'lab_heading' ), __( 'Display heading', 'lab' ), __( 'The large heading at the top of the page. Leave blank to use the page title. This lets the menu say "Services" while the page says something more interesting.', 'lab' ) );
	lab_field_text( 'lab_heading_em', (string) lab_get( $post->ID, 'lab_heading_em' ), __( 'Display heading — greyed half', 'lab' ), __( 'The second half of the heading, shown in grey.', 'lab' ) );
}

function lab_box_person( WP_Post $post ): void {
	lab_nonce_field();
	lab_field_text( 'lab_role', (string) lab_get( $post->ID, 'lab_role' ), __( 'Role', 'lab' ), __( 'For example: Founder / Design lead.', 'lab' ) );
	echo '<p class="lab-f__help">' . esc_html__( 'The portrait is the Featured image, set in the sidebar.', 'lab' ) . '</p>';
}

function lab_box_principle( WP_Post $post ): void {
	lab_nonce_field();
	lab_field_textarea( 'lab_summary', (string) lab_get( $post->ID, 'lab_summary' ), __( 'Description', 'lab' ), '', 3 );
	lab_field_select( 'lab_where', (string) lab_get( $post->ID, 'lab_where', 'home' ), [
		'home'   => __( 'Homepage — "Why L.A.B"', 'lab' ),
		'studio' => __( 'Studio page — "Four things we hold to"', 'lab' ),
	], __( 'Show this on', 'lab' ) );
}

/* ------------------------------------------------------------------ *
 * Saving
 * ------------------------------------------------------------------ */

add_action( 'save_post', 'lab_save_meta', 10, 2 );
function lab_save_meta( int $post_id, WP_Post $post ): void {
	if ( ! in_array( $post->post_type, [ 'lab_project', 'lab_service', 'lab_step', 'lab_principle', 'lab_person', 'page' ], true ) ) {
		return;
	}
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	$nonce = isset( $_POST[ LAB_NONCE ] ) ? sanitize_text_field( wp_unslash( $_POST[ LAB_NONCE ] ) ) : '';
	if ( ! $nonce || ! wp_verify_nonce( $nonce, LAB_NONCE ) ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}

	foreach ( [ 'lab_home_type', 'lab_location', 'lab_direction', 'lab_year', 'lab_role', 'lab_heading', 'lab_heading_em', 'lab_where' ] as $key ) {
		if ( isset( $_POST[ $key ] ) ) {
			update_post_meta( $post_id, $key, sanitize_text_field( wp_unslash( $_POST[ $key ] ) ) );
		}
	}
	foreach ( [ 'lab_summary', 'lab_brief', 'lab_response' ] as $key ) {
		if ( isset( $_POST[ $key ] ) ) {
			update_post_meta( $post_id, $key, sanitize_textarea_field( wp_unslash( $_POST[ $key ] ) ) );
		}
	}
	foreach ( [ 'lab_hero', 'lab_before', 'lab_after' ] as $key ) {
		if ( isset( $_POST[ $key ] ) ) {
			update_post_meta( $post_id, $key, (int) $_POST[ $key ] );
		}
	}
	foreach ( [ 'lab_details', 'lab_points' ] as $key ) {
		if ( isset( $_POST[ $key ] ) ) {
			update_post_meta( $post_id, $key, lab_clean_list( wp_unslash( $_POST[ $key ] ) ) );
		}
	}
	if ( isset( $_POST['lab_gallery'] ) ) {
		update_post_meta( $post_id, 'lab_gallery', lab_clean_gallery( wp_unslash( $_POST['lab_gallery'] ) ) );
	}
	if ( 'lab_project' === $post->post_type ) {
		update_post_meta( $post_id, 'lab_featured', isset( $_POST['lab_featured'] ) ? 1 : 0 );
	}
}
