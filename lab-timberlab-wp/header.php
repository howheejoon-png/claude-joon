<?php defined( 'ABSPATH' ) || exit; ?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="theme-color" content="#F3F3F1">
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<a class="sr-only" href="#main"><?php esc_html_e( 'Skip to content', 'lab' ); ?></a>

<?php $nav = lab_nav_items(); ?>

<header id="site-header" class="site-header<?php echo lab_header_starts_dark() ? ' on-dark' : ''; ?>">
	<div class="container">
		<a class="brand" href="<?php echo esc_url( home_url( '/' ) ); ?>" aria-label="<?php esc_attr_e( 'L.A.B by Timberlab — home', 'lab' ); ?>">
			<span class="brand__mark">L<span class="dot">.</span>A<span class="dot">.</span>B</span>
			<span class="brand__by"><?php esc_html_e( 'by Timberlab', 'lab' ); ?></span>
		</a>
		<nav class="nav" aria-label="<?php esc_attr_e( 'Primary', 'lab' ); ?>">
			<?php foreach ( $nav as $item ) : ?>
				<a href="<?php echo esc_url( $item['url'] ); ?>"<?php echo $item['current'] ? ' aria-current="page"' : ''; ?>><?php echo esc_html( $item['label'] ); ?></a>
			<?php endforeach; ?>
		</nav>
		<div class="header-cta">
			<a class="btn" href="<?php echo esc_url( lab_contact_url() ); ?>"><span class="btn__dot"></span><?php echo esc_html( lab_opt( 'cta_label' ) ); ?></a>
			<button class="menu-btn" type="button" aria-controls="site-menu" aria-expanded="false">
				<span><?php esc_html_e( 'Menu', 'lab' ); ?></span><span class="bars"></span>
			</button>
		</div>
	</div>
</header>

<div id="site-menu" class="menu" aria-hidden="true">
	<div class="menu__brand"><span class="brand__mark">L<span class="dot">.</span>A<span class="dot">.</span>B</span></div>
	<button class="menu__close" type="button">
		<span><?php esc_html_e( 'Close', 'lab' ); ?></span>
		<svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13"/></svg>
	</button>
	<ul class="menu__list">
		<li><a href="<?php echo esc_url( home_url( '/' ) ); ?>"><span><span class="idx">01</span><?php esc_html_e( 'Home', 'lab' ); ?></span></a></li>
		<?php foreach ( $nav as $i => $item ) : ?>
			<li><a href="<?php echo esc_url( $item['url'] ); ?>"><span><span class="idx"><?php echo esc_html( lab_number( $i + 1 ) ); ?></span><?php echo esc_html( $item['label'] ); ?></span></a></li>
		<?php endforeach; ?>
	</ul>
	<?php $c = lab_contact(); ?>
	<div class="menu__foot">
		<div>
			<strong><?php echo esc_html( lab_opt( 'cta_label' ) ); ?></strong>
			<a href="<?php echo esc_url( lab_contact_url() ); ?>"><?php esc_html_e( 'Tell us about your home', 'lab' ); ?> <?php echo lab_arrow(); ?></a>
		</div>
		<div>
			<strong><?php esc_html_e( 'Contact', 'lab' ); ?></strong>
			<?php if ( $c['email'] ) : ?><a href="mailto:<?php echo esc_attr( $c['email'] ); ?>"><?php echo esc_html( $c['email'] ); ?></a><br><?php endif; ?>
			<?php echo esc_html( $c['phone'] ); ?>
		</div>
	</div>
</div>

<main id="main">
