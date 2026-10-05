<?php
/** Fallback listing. */
defined( 'ABSPATH' ) || exit;
get_header();
?>
<section class="page-hero">
	<div class="container page-hero__grid">
		<div class="page-hero__title"><h1 class="display display-xl" data-hero-title><?php echo esc_html( wp_get_document_title() ); ?></h1></div>
	</div>
</section>
<section class="section-sm" style="padding-top:0">
	<div class="container">
		<?php if ( have_posts() ) : ?>
			<ul class="svc-list">
				<?php
				while ( have_posts() ) :
					the_post();
					?>
					<li class="svc"><h3 class="svc__title"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3></li>
				<?php endwhile; ?>
			</ul>
			<?php the_posts_pagination(); ?>
		<?php else : ?>
			<p class="lead"><?php esc_html_e( 'Nothing here yet.', 'lab' ); ?></p>
		<?php endif; ?>
	</div>
</section>
<?php get_footer(); ?>
