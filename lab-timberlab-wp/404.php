<?php
/** Not found. */
defined( 'ABSPATH' ) || exit;
get_header();
?>
<section class="page-hero" style="min-height:60svh">
	<div class="container page-hero__grid">
		<div class="page-hero__title">
			<h1 class="display display-xl" data-hero-title><?php esc_html_e( 'Not here.', 'lab' ); ?></h1>
		</div>
		<div class="page-hero__aside" data-hero-fade>
			<p><?php esc_html_e( 'That page has moved or never existed.', 'lab' ); ?></p>
			<p style="margin-top:1rem">
				<a class="link" href="<?php echo esc_url( (string) get_post_type_archive_link( 'lab_project' ) ); ?>"><?php esc_html_e( 'See the projects', 'lab' ); ?> <?php echo lab_arrow(); ?></a>
			</p>
		</div>
	</div>
</section>
<?php get_footer(); ?>
