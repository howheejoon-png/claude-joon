<?php
/**
 * Template Name: Contact
 */
defined( 'ABSPATH' ) || exit;
get_header();
$c = lab_contact();
?>
<section class="contact-page">
	<div class="container enquiry__grid">
		<div class="enquiry__copy">
			<div class="page-hero__crumb label muted">
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'lab' ); ?></a><span>/</span><span><?php the_title(); ?></span>
			</div>
			<h1 class="display display-xl" data-hero-title>
				<?php echo esc_html( lab_opt( 'enq_heading' ) ); ?>
				<?php if ( lab_known( (string) lab_opt( 'enq_em' ) ) ) : ?><em><?php echo esc_html( lab_opt( 'enq_em' ) ); ?></em><?php endif; ?>
			</h1>
			<?php if ( lab_known( (string) lab_opt( 'enq_aside' ) ) ) : ?>
				<p class="muted measure-narrow" data-hero-fade><?php echo esc_html( lab_opt( 'enq_aside' ) ); ?></p>
			<?php endif; ?>
			<?php lab_contact_list( true ); ?>
		</div>
		<div class="enquiry__form" data-hero-fade>
			<?php get_template_part( 'parts/enquiry-form' ); ?>
		</div>
	</div>

	<?php if ( $c['address'] ) : ?>
		<div class="container">
			<a class="contact-map" href="<?php echo esc_url( $c['map_url'] ); ?>" target="_blank" rel="noopener">
				<span class="contact-map__label label"><?php esc_html_e( 'Find the studio', 'lab' ); ?></span>
				<span class="contact-map__addr"><?php echo wp_kses_post( implode( '<br>', array_map( 'esc_html', $c['address'] ) ) ); ?></span>
				<span class="link"><?php esc_html_e( 'Open in Google Maps', 'lab' ); ?> <?php echo lab_arrow(); ?></span>
			</a>
		</div>
	<?php endif; ?>
</section>
<?php get_footer(); ?>
