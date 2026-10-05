<?php
/**
 * Theme settings: the wording and details that sit outside the post types.
 * One schema drives both the form and the save handler.
 */

defined( 'ABSPATH' ) || exit;

const LAB_OPTION = 'lab_options';

function lab_options_schema(): array {
	return [
		'home' => [
			'title'  => __( 'Homepage', 'lab' ),
			'fields' => [
				'hero_heading'   => [ 'type' => 'textarea', 'label' => __( 'Hero headline', 'lab' ), 'help' => __( 'Keep it to a few words. Press Enter where you want the line to break.', 'lab' ), 'rows' => 2 ],
				'hero_line'      => [ 'type' => 'text', 'label' => __( 'Hero line', 'lab' ), 'help' => __( 'The short line under the headline.', 'lab' ) ],
				'intro_label'    => [ 'type' => 'text', 'label' => __( 'Studio statement — label', 'lab' ) ],
				'intro_text'     => [ 'type' => 'textarea', 'label' => __( 'Studio statement', 'lab' ), 'help' => __( 'Wrap words in *asterisks* to grey them for emphasis.', 'lab' ), 'rows' => 3 ],
				'intro_aside'    => [ 'type' => 'textarea', 'label' => __( 'Studio statement — supporting text', 'lab' ), 'rows' => 3 ],
				'work_label'     => [ 'type' => 'text', 'label' => __( 'Projects — label', 'lab' ) ],
				'work_heading'   => [ 'type' => 'text', 'label' => __( 'Projects — heading', 'lab' ) ],
				'work_em'        => [ 'type' => 'text', 'label' => __( 'Projects — heading (greyed half)', 'lab' ), 'help' => __( 'The second half of the heading, shown in grey.', 'lab' ) ],
				'work_aside'     => [ 'type' => 'textarea', 'label' => __( 'Projects — supporting text', 'lab' ), 'rows' => 2 ],
				'svc_label'      => [ 'type' => 'text', 'label' => __( 'Services — label', 'lab' ) ],
				'svc_heading'    => [ 'type' => 'text', 'label' => __( 'Services — heading', 'lab' ) ],
				'svc_em'         => [ 'type' => 'text', 'label' => __( 'Services — heading (greyed half)', 'lab' ) ],
				'svc_aside'      => [ 'type' => 'textarea', 'label' => __( 'Services — supporting text', 'lab' ), 'rows' => 2 ],
				'svc_link_label' => [ 'type' => 'text', 'label' => __( 'Services — link line', 'lab' ) ],
				'svc_link_text'  => [ 'type' => 'text', 'label' => __( 'Services — link wording', 'lab' ) ],
				'proc_label'     => [ 'type' => 'text', 'label' => __( 'Process — label', 'lab' ) ],
				'proc_heading'   => [ 'type' => 'text', 'label' => __( 'Process — heading', 'lab' ) ],
				'proc_em'        => [ 'type' => 'text', 'label' => __( 'Process — heading (greyed half)', 'lab' ) ],
				'cred_label'     => [ 'type' => 'text', 'label' => __( 'Why L.A.B — label', 'lab' ) ],
				'cred_heading'   => [ 'type' => 'text', 'label' => __( 'Why L.A.B — heading', 'lab' ) ],
				'cred_em'        => [ 'type' => 'text', 'label' => __( 'Why L.A.B — heading (greyed half)', 'lab' ) ],
				'cred_aside'     => [ 'type' => 'textarea', 'label' => __( 'Why L.A.B — supporting text', 'lab' ), 'rows' => 2 ],
				'quote_text'     => [ 'type' => 'textarea', 'label' => __( 'Testimonial', 'lab' ), 'help' => __( 'Leave blank to hide the testimonial panel.', 'lab' ), 'rows' => 3 ],
				'quote_by'       => [ 'type' => 'text', 'label' => __( 'Testimonial attribution', 'lab' ) ],
				'enq_label'      => [ 'type' => 'text', 'label' => __( 'Enquiry — label', 'lab' ) ],
				'enq_heading'    => [ 'type' => 'text', 'label' => __( 'Enquiry — heading', 'lab' ) ],
				'enq_em'         => [ 'type' => 'text', 'label' => __( 'Enquiry — heading (greyed half)', 'lab' ) ],
				'enq_aside'      => [ 'type' => 'textarea', 'label' => __( 'Enquiry — supporting text', 'lab' ), 'rows' => 2 ],
			],
		],
		'media' => [
			'title'  => __( 'Hero video', 'lab' ),
			'fields' => [
				'video_desktop_webm' => [ 'type' => 'media', 'label' => __( 'Hero video — desktop (WebM)', 'lab' ), 'help' => __( 'Preferred format: smaller, and supported by more browsers. Muted and looping, roughly 8–12 seconds.', 'lab' ) ],
				'video_desktop'      => [ 'type' => 'media', 'label' => __( 'Hero video — desktop (MP4)', 'lab' ), 'help' => __( 'Fallback for Safari and older browsers. Supply both formats where you can.', 'lab' ) ],
				'video_mobile_webm'  => [ 'type' => 'media', 'label' => __( 'Hero video — mobile (WebM)', 'lab' ), 'help' => __( 'A smaller encode for phones.', 'lab' ) ],
				'video_mobile'       => [ 'type' => 'media', 'label' => __( 'Hero video — mobile (MP4)', 'lab' ) ],
			],
		],
		'studio' => [
			'title'  => __( 'Studio figures', 'lab' ),
			'fields' => [
				'figures' => [
					'type'  => 'rows',
					'label' => __( 'The studio in numbers', 'lab' ),
					'help'  => __( 'Shown on the Studio page, counting up as the visitor scrolls to them. Leave the value blank to show a dash instead.', 'lab' ),
					'cols'  => [
						'value'  => [ 'label' => __( 'Number', 'lab' ), 'type' => 'text' ],
						'suffix' => [ 'label' => __( 'Suffix (e.g. +)', 'lab' ), 'type' => 'text' ],
						'label'  => [ 'label' => __( 'Label', 'lab' ), 'type' => 'text' ],
					],
				],
				'figures_note' => [ 'type' => 'text', 'label' => __( 'Note under the figures', 'lab' ), 'help' => __( 'Leave blank once the real numbers are in place.', 'lab' ) ],
			],
		],
		'contact' => [
			'title'  => __( 'Contact', 'lab' ),
			'fields' => [
				'address'   => [ 'type' => 'textarea', 'label' => __( 'Studio address', 'lab' ), 'help' => __( 'One line per row.', 'lab' ), 'rows' => 3 ],
				'map_url'   => [ 'type' => 'text', 'label' => __( 'Google Maps link', 'lab' ) ],
				'phone'     => [ 'type' => 'text', 'label' => __( 'Phone (as displayed)', 'lab' ) ],
				'phone_raw' => [ 'type' => 'text', 'label' => __( 'Phone (for the tap-to-call link)', 'lab' ), 'help' => __( 'Digits only, with the country code. For example +6589938778.', 'lab' ) ],
				'email'     => [ 'type' => 'text', 'label' => __( 'Email', 'lab' ) ],
				'whatsapp'  => [ 'type' => 'text', 'label' => __( 'WhatsApp link', 'lab' ), 'help' => __( 'For example https://wa.me/6589938778. Leave blank to hide it.', 'lab' ) ],
				'hours'     => [
					'type'  => 'rows',
					'label' => __( 'Opening hours', 'lab' ),
					'cols'  => [
						'days' => [ 'label' => __( 'Days', 'lab' ), 'type' => 'text' ],
						'time' => [ 'label' => __( 'Hours', 'lab' ), 'type' => 'text' ],
					],
				],
				'socials' => [
					'type'  => 'rows',
					'label' => __( 'Social links', 'lab' ),
					'cols'  => [
						'label' => [ 'label' => __( 'Name', 'lab' ), 'type' => 'text' ],
						'url'   => [ 'label' => __( 'Link', 'lab' ), 'type' => 'text' ],
					],
				],
				'cta_label' => [ 'type' => 'text', 'label' => __( 'Call-to-action button wording', 'lab' ) ],
				'foot_heading' => [ 'type' => 'text', 'label' => __( 'Footer heading', 'lab' ) ],
				'foot_em'      => [ 'type' => 'text', 'label' => __( 'Footer heading (greyed half)', 'lab' ) ],
				'foot_aside'   => [ 'type' => 'textarea', 'label' => __( 'Footer supporting text', 'lab' ), 'rows' => 2 ],
				'foot_note'    => [ 'type' => 'text', 'label' => __( 'Footer small print', 'lab' ) ],
			],
		],
	];
}

function lab_defaults(): array {
	return [
		'hero_heading' => "Your home,\nthought through.",
		'hero_line'    => 'A design-and-build studio for Singapore homes.',
		'intro_label'  => 'The studio',
		'intro_text'   => 'We *draw* the home, then we *build* it. One studio, one contract and one point of contact from the first site visit to the last screw, so what you approve on paper is what you get on site.',
		'intro_aside'  => 'We are a Singapore design-and-build practice working across public and private housing. Every project starts with a plan, and every plan is costed before anything is built.',
		'work_label'   => 'Selected projects',
		'work_heading' => 'Homes we have drawn',
		'work_em'      => 'and built.',
		'work_aside'   => 'Each project is shown as it was lived in after handover.',
		'svc_label'    => 'What we do',
		'svc_heading'  => 'Design, build and everything',
		'svc_em'       => 'in between.',
		'svc_aside'    => 'A full-service studio: we design the home, then we build it.',
		'svc_link_label' => 'HDB · BTO · Condominium · Landed',
		'svc_link_text'  => 'View our works',
		'proc_label'   => 'How it works',
		'proc_heading' => 'From plan',
		'proc_em'      => 'to place.',
		'cred_label'   => 'Why L.A.B',
		'cred_heading' => 'Built on',
		'cred_em'      => 'method, not promises.',
		'cred_aside'   => 'Credibility should be shown, not claimed.',
		'quote_text'   => '',
		'quote_by'     => '',
		'enq_label'    => 'Start a project',
		'enq_heading'  => 'Tell us about',
		'enq_em'       => 'your space.',
		'enq_aside'    => "A few details are enough to begin. We'll come back with a time to talk, and if it makes sense, a visit to your home.",
		'figures'      => [],
		'figures_note' => '',
		'address'      => "47 Jln Pemimpin, #04-05\nHalcyon 2, Singapore 577200",
		'map_url'      => 'https://www.google.com/maps/search/?api=1&query=47+Jln+Pemimpin+%2304-05+Halcyon+2+Singapore+577200',
		'phone'        => '+65 8993 8778',
		'phone_raw'    => '+6589938778',
		'email'        => 'sales@timberlab.sg',
		'whatsapp'     => 'https://wa.me/6589938778',
		'hours'        => [
			[ 'days' => 'Monday – Friday', 'time' => '9am – 6pm' ],
			[ 'days' => 'Saturday', 'time' => '9am – 12pm' ],
			[ 'days' => 'Sunday', 'time' => 'Closed' ],
		],
		'socials'      => [],
		'cta_label'    => 'Start a project',
		'foot_heading' => "Let's talk about",
		'foot_em'      => 'your home.',
		'foot_aside'   => 'Whether you have a floor plan and a moodboard or only a move-in date, the first conversation is free and without obligation.',
		'foot_note'    => '',
		'video_desktop' => 0,
		'video_mobile'  => 0,
		'video_desktop_webm' => 0,
		'video_mobile_webm'  => 0,
	];
}

/** Read one setting, falling back to the shipped default. */
function lab_opt( string $key, mixed $fallback = null ): mixed {
	static $cache = null;
	if ( null === $cache ) {
		$cache = wp_parse_args( (array) get_option( LAB_OPTION, [] ), lab_defaults() );
	}
	if ( array_key_exists( $key, $cache ) && '' !== $cache[ $key ] && [] !== $cache[ $key ] ) {
		return $cache[ $key ];
	}
	return $fallback ?? ( lab_defaults()[ $key ] ?? '' );
}

add_action( 'admin_menu', function (): void {
	add_menu_page(
		__( 'L.A.B settings', 'lab' ),
		__( 'L.A.B settings', 'lab' ),
		'manage_options',
		'lab-settings',
		'lab_settings_page',
		'dashicons-admin-customizer',
		24
	);
} );

function lab_settings_page(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$saved  = false;
	$schema = lab_options_schema();

	if ( isset( $_POST['lab_settings_nonce'] ) ) {
		$nonce = sanitize_text_field( wp_unslash( $_POST['lab_settings_nonce'] ) );
		if ( wp_verify_nonce( $nonce, 'lab_settings' ) ) {
			$raw   = isset( $_POST[ LAB_OPTION ] ) ? wp_unslash( $_POST[ LAB_OPTION ] ) : [];
			$clean = [];
			foreach ( $schema as $section ) {
				foreach ( $section['fields'] as $key => $field ) {
					$value = $raw[ $key ] ?? '';
					$clean[ $key ] = match ( $field['type'] ) {
						'textarea' => sanitize_textarea_field( (string) $value ),
						'media'    => (int) $value,
						'rows'     => lab_clean_rows( $value, $field['cols'] ),
						default    => sanitize_text_field( (string) $value ),
					};
				}
			}
			update_option( LAB_OPTION, $clean );
			$saved = true;
		}
	}

	$values = wp_parse_args( (array) get_option( LAB_OPTION, [] ), lab_defaults() );

	echo '<div class="wrap lab-settings"><h1>' . esc_html__( 'L.A.B settings', 'lab' ) . '</h1>';
	if ( $saved ) {
		echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'Settings saved.', 'lab' ) . '</p></div>';
	}
	echo '<form method="post">';
	wp_nonce_field( 'lab_settings', 'lab_settings_nonce' );

	foreach ( $schema as $section ) {
		echo '<h2>' . esc_html( $section['title'] ) . '</h2>';
		echo '<div class="lab-settings__grid">';
		foreach ( $section['fields'] as $key => $field ) {
			$name  = LAB_OPTION . '[' . $key . ']';
			$value = $values[ $key ] ?? '';
			$help  = $field['help'] ?? '';
			switch ( $field['type'] ) {
				case 'textarea':
					lab_field_textarea( $name, (string) $value, $field['label'], $help, $field['rows'] ?? 3 );
					break;
				case 'media':
					lab_field_media( $name, (int) $value, $field['label'], $help );
					break;
				case 'rows':
					lab_field_rows( $name, (array) $value, $field['cols'], $field['label'], $help );
					break;
				default:
					lab_field_text( $name, (string) $value, $field['label'], $help );
			}
		}
		echo '</div>';
	}

	submit_button( __( 'Save settings', 'lab' ) );
	echo '</form></div>';
}
