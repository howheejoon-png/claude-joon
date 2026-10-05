<?php
/** Default page. */
defined( 'ABSPATH' ) || exit;
get_header();
while ( have_posts() ) :
	the_post();
	?>
	<section class="page-hero">
		<div class="container page-hero__grid">
			<div class="page-hero__title">
				<h1 class="display display-xl" data-hero-title><?php the_title(); ?></h1>
			</div>
			<?php if ( has_excerpt() ) : ?>
				<p class="page-hero__aside" data-hero-fade><?php echo esc_html( get_the_excerpt() ); ?></p>
			<?php endif; ?>
		</div>
	</section>
	<section class="section-sm" style="padding-top:0">
		<div class="container"><div class="measure prose"><?php the_content(); ?></div></div>
	</section>
	<?php
endwhile;
get_footer();
