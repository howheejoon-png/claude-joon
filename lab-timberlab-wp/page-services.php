<?php
/**
 * Template Name: Services
 */
defined( 'ABSPATH' ) || exit;
get_header();

$services = get_posts( [ 'post_type' => 'lab_service', 'posts_per_page' => -1, 'orderby' => [ 'menu_order' => 'ASC', 'date' => 'ASC' ] ] );
$steps    = get_posts( [ 'post_type' => 'lab_step', 'posts_per_page' => -1, 'orderby' => [ 'menu_order' => 'ASC', 'date' => 'ASC' ] ] );
$types    = get_terms( [ 'taxonomy' => 'lab_property_type', 'hide_empty' => false ] );
?>
<section class="page-hero">
	<div class="container page-hero__grid">
		<div class="page-hero__title">
			<div class="page-hero__crumb label muted">
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'lab' ); ?></a><span>/</span><span><?php the_title(); ?></span>
			</div>
			<h1 class="display display-xl" data-hero-title><?php the_title(); ?></h1>
		</div>
		<?php if ( has_excerpt() ) : ?>
			<p class="page-hero__aside" data-hero-fade><?php echo esc_html( get_the_excerpt() ); ?></p>
		<?php endif; ?>
	</div>
</section>

<section class="container">
	<?php foreach ( $services as $i => $service ) : ?>
		<article class="svc-full" id="<?php echo esc_attr( (string) $service->post_name ); ?>">
			<div class="svc-full__num" data-reveal="fade"><?php echo esc_html( lab_number( $i ) ); ?></div>
			<div class="svc-full__body">
				<h2 class="display" data-reveal="lines"><?php echo esc_html( get_the_title( $service ) ); ?></h2>
				<?php if ( lab_known( (string) lab_get( $service->ID, 'lab_summary' ) ) ) : ?>
					<p data-reveal="fade"><?php echo esc_html( lab_get( $service->ID, 'lab_summary' ) ); ?></p>
				<?php endif; ?>
				<?php $points = (array) lab_get( $service->ID, 'lab_points', [] ); ?>
				<?php if ( $points ) : ?>
					<ul data-stagger>
						<?php foreach ( $points as $point ) : ?>
							<li><?php echo esc_html( $point ); ?></li>
						<?php endforeach; ?>
					</ul>
				<?php endif; ?>
				<a class="link" href="<?php echo esc_url( lab_contact_url() ); ?>" data-reveal="fade"><?php esc_html_e( 'Discuss this for your home', 'lab' ); ?> <?php echo lab_arrow(); ?></a>
			</div>
			<div class="svc-full__media">
				<div class="frame" data-reveal="clip" data-parallax="6">
					<?php echo lab_image( (int) get_post_thumbnail_id( $service ), 'land', (string) get_the_title( $service ) ); ?>
				</div>
			</div>
		</article>
	<?php endforeach; ?>
</section>

<?php if ( $steps ) : ?>
<section class="process-lite">
	<div class="container">
		<?php lab_sec_head( (string) lab_opt( 'proc_label' ), __( 'Four steps,', 'lab' ), __( 'one team.', 'lab' ) ); ?>
		<div class="process-lite__grid" data-stagger>
			<?php foreach ( $steps as $i => $step ) : ?>
				<div class="plite">
					<div class="plite__num"><?php echo esc_html( lab_number( $i ) ); ?></div>
					<h3><?php echo esc_html( get_the_title( $step ) ); ?></h3>
					<?php if ( lab_known( (string) lab_get( $step->ID, 'lab_summary' ) ) ) : ?>
						<p><?php echo esc_html( lab_get( $step->ID, 'lab_summary' ) ); ?></p>
					<?php endif; ?>
				</div>
			<?php endforeach; ?>
		</div>
	</div>
</section>
<?php endif; ?>

<?php if ( $types && ! is_wp_error( $types ) ) : ?>
<section class="types" style="padding-top:0">
	<div class="container">
		<div class="sec-head" style="margin-bottom:var(--s-6)">
			<div class="sec-head__label label muted" data-reveal="fade"><span><?php esc_html_e( 'Every kind of Singapore home', 'lab' ); ?></span></div>
		</div>
		<div class="types__grid" data-stagger>
			<?php foreach ( $types as $term ) : ?>
				<div class="type">
					<h3 class="type__name"><?php echo esc_html( $term->name ); ?></h3>
					<?php if ( $term->description ) : ?>
						<p><?php echo esc_html( $term->description ); ?></p>
					<?php endif; ?>
					<a class="link" href="<?php echo esc_url( (string) get_term_link( $term ) ); ?>">
						<?php
						/* translators: %s: property type, e.g. HDB */
						printf( esc_html__( 'See %s projects', 'lab' ), esc_html( $term->name ) );
						?>
						<?php echo lab_arrow(); ?>
					</a>
				</div>
			<?php endforeach; ?>
		</div>
	</div>
</section>
<?php endif; ?>

<?php get_footer(); ?>
