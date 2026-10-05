<?php
/**
 * Template Name: Studio
 */
defined( 'ABSPATH' ) || exit;
get_header();

$figures = array_values( array_filter( (array) lab_opt( 'figures', [] ), static fn( $f ) => ! empty( $f['label'] ) ) );
$values  = get_posts( [
	'post_type'      => 'lab_principle',
	'posts_per_page' => -1,
	'orderby'        => [ 'menu_order' => 'ASC', 'date' => 'ASC' ],
	'meta_query'     => [ [ 'key' => 'lab_where', 'value' => 'studio' ] ],
] );
$team    = get_posts( [ 'post_type' => 'lab_person', 'posts_per_page' => -1, 'orderby' => [ 'menu_order' => 'ASC', 'date' => 'ASC' ] ] );
?>
<section class="page-hero">
	<div class="container page-hero__grid">
		<div class="page-hero__title">
			<div class="page-hero__crumb label muted">
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'lab' ); ?></a><span>/</span><span><?php the_title(); ?></span>
			</div>
			<?php $head = lab_page_heading( (int) get_the_ID() ); ?>
			<h1 class="display display-xl" data-hero-title><?php echo esc_html( $head['text'] ); ?><?php if ( lab_known( $head['em'] ) ) : ?> <em><?php echo esc_html( $head['em'] ); ?></em><?php endif; ?></h1>
		</div>
		<?php if ( has_excerpt() ) : ?>
			<p class="page-hero__aside" data-hero-fade><?php echo esc_html( get_the_excerpt() ); ?></p>
		<?php endif; ?>
	</div>
</section>

<section class="studio-intro">
	<div class="container studio-intro__grid<?php echo has_post_thumbnail() ? '' : ' studio-intro__grid--text-only'; ?>">
		<div class="studio-intro__text" data-reveal="fade">
			<?php
			while ( have_posts() ) {
				the_post();
				the_content();
			}
			?>
		</div>
		<?php if ( has_post_thumbnail() ) : ?>
			<div class="studio-intro__media">
				<div class="frame frame--shade" data-reveal="clip" data-parallax="8">
					<?php echo wp_get_attachment_image( (int) get_post_thumbnail_id(), 'lab-tall', false, [ 'alt' => '' ] ); ?>
				</div>
			</div>
		<?php endif; ?>
	</div>
</section>

<?php if ( $figures ) : ?>
<section class="section-sm" style="padding-top:0">
	<div class="container">
		<div class="sec-head" style="margin-bottom:var(--s-6)">
			<div class="sec-head__label label muted" data-reveal="fade"><span><?php esc_html_e( 'The studio in numbers', 'lab' ); ?></span></div>
		</div>
		<div class="figures" data-stagger>
			<?php foreach ( $figures as $figure ) : ?>
				<?php $value = trim( (string) ( $figure['value'] ?? '' ) ); ?>
				<div class="figure">
					<div class="figure__val"<?php echo is_numeric( $value ) ? ' data-count="' . esc_attr( $value ) . '" data-suffix="' . esc_attr( (string) ( $figure['suffix'] ?? '' ) ) . '"' : ''; ?>>
						<?php echo esc_html( is_numeric( $value ) ? '—' : ( $value ?: '—' ) ); ?>
					</div>
					<div class="figure__key"><?php echo esc_html( (string) ( $figure['label'] ?? '' ) ); ?></div>
				</div>
			<?php endforeach; ?>
		</div>
		<?php if ( lab_known( (string) lab_opt( 'figures_note' ) ) ) : ?>
			<p style="margin-top:var(--s-5)"><span class="placeholder-note"><?php echo esc_html( lab_opt( 'figures_note' ) ); ?></span></p>
		<?php endif; ?>
	</div>
</section>
<?php endif; ?>

<?php if ( $values ) : ?>
<section class="values">
	<div class="container">
		<?php lab_sec_head( __( 'How we think', 'lab' ), __( 'Four things we', 'lab' ), __( 'hold to.', 'lab' ) ); ?>
		<div class="values__grid" data-stagger>
			<?php foreach ( $values as $i => $value ) : ?>
				<div class="value">
					<div class="value__num"><?php echo esc_html( lab_number( $i ) ); ?></div>
					<div>
						<h3><?php echo esc_html( get_the_title( $value ) ); ?></h3>
						<?php if ( lab_known( (string) lab_get( $value->ID, 'lab_summary' ) ) ) : ?>
							<p><?php echo esc_html( lab_get( $value->ID, 'lab_summary' ) ); ?></p>
						<?php endif; ?>
					</div>
				</div>
			<?php endforeach; ?>
		</div>
	</div>
</section>
<?php endif; ?>

<?php if ( $team ) : ?>
<section class="team">
	<div class="container">
		<?php lab_sec_head( __( 'The team', 'lab' ), __( 'The people who', 'lab' ), __( 'draw and build.', 'lab' ) ); ?>
		<div class="team__grid" data-stagger>
			<?php foreach ( $team as $person ) : ?>
				<div class="person">
					<div class="frame"><?php echo lab_image( (int) get_post_thumbnail_id( $person ), 'tall', (string) get_the_title( $person ) ); ?></div>
					<div class="person__name"><?php echo esc_html( get_the_title( $person ) ); ?></div>
					<?php if ( lab_known( (string) lab_get( $person->ID, 'lab_role' ) ) ) : ?>
						<div class="person__role"><?php echo esc_html( lab_get( $person->ID, 'lab_role' ) ); ?></div>
					<?php endif; ?>
				</div>
			<?php endforeach; ?>
		</div>
	</div>
</section>
<?php endif; ?>

<?php get_footer(); ?>
