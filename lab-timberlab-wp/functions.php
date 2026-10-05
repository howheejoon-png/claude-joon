<?php
/**
 * L.A.B by Timberlab — theme bootstrap.
 *
 * Deliberately dependency-free: no ACF or other paid plugin is required.
 * Custom fields are native meta boxes so the client owns the whole stack.
 */

defined( 'ABSPATH' ) || exit;

define( 'LAB_VERSION', '1.0.0' );
define( 'LAB_DIR', get_template_directory() );
define( 'LAB_URI', get_template_directory_uri() );

require_once LAB_DIR . '/inc/setup.php';
require_once LAB_DIR . '/inc/assets.php';
require_once LAB_DIR . '/inc/post-types.php';
require_once LAB_DIR . '/inc/fields.php';
require_once LAB_DIR . '/inc/meta-boxes.php';
require_once LAB_DIR . '/inc/options.php';
require_once LAB_DIR . '/inc/nav.php';
require_once LAB_DIR . '/inc/template-tags.php';
require_once LAB_DIR . '/inc/enquiry.php';
require_once LAB_DIR . '/inc/seed.php';
