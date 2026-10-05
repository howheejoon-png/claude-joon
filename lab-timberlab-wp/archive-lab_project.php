<?php
/** Projects index, with the property-type filter. */
defined( 'ABSPATH' ) || exit;
get_header();

$term     = is_tax( 'lab_property_type' ) ? get_queried_object() : null;
$projects = $term instanceof WP_Term
	? lab_projects( [ 'tax_query' => [ [ 'taxonomy' => 'lab_property_type', 'field' => 'term_id', 'terms' => $term->term_id ] ] ] )
	: lab_projects();
$types    = get_terms( [ 'taxonomy' => 'lab_property_type', 'hide_empty' => true ] );
$heading  = $term instanceof WP_Term ? $term->name : get_post_type_object( 'lab_project' )->labels->name;
$active   = $term instanceof WP_Term ? $term->slug : 'all';
?>
<section class="page-hero">
	<div class="container page-hero__grid">
		<div class="page-hero__title">
			<div class="page-hero__crumb label muted">
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'lab' ); ?></a><span>/</span><span><?php echo esc_html( $heading ); ?></span>
			</div>
			<h1 class="display display-xl" data-hero-title><?php echo esc_html( $heading ); ?></h1>
		</div>
		<p class="page-hero__aside" data-hero-fade><?php esc_html_e( 'Every home is shown as it was handed over. Filter by the kind of home you live in, or will.', 'lab' ); ?></p>
	</div>
</section>

<section class="section-sm" style="padding-top:0">
	<div class="container">
		<div class="filter" data-hero-fade>
			<div class="pills" role="tablist" data-filter data-active="<?php echo esc_attr( $active ); ?>">
				<button class="pill" role="tab" type="button" data-type="all" aria-selected="true"><?php esc_html_e( 'All', 'lab' ); ?></button>
				<?php foreach ( (array) $types as $term ) : ?>
					<?php if ( $term instanceof WP_Term ) : ?>
						<button class="pill" role="tab" type="button" data-type="<?php echo esc_attr( $term->slug ); ?>" aria-selected="false"><?php echo esc_html( $term->name ); ?></button>
					<?php endif; ?>
				<?php endforeach; ?>
			</div>
			<div class="filter__count" data-filter-count></div>
		</div>

		<div class="pgrid" data-grid>
			<?php foreach ( $projects as $i => $project ) : ?>
				<?php
				$slugs = wp_get_post_terms( $project->ID, 'lab_property_type', [ 'fields' => 'slugs' ] );
				$slug  = is_array( $slugs ) && $slugs ? $slugs[0] : '';
				ob_start();
				lab_project_card( $project, [ 'shape' => 'wide', 'eager' => $i < 2 ] );
				$card = ob_get_clean();
				// Tag the card so the filter can show and hide it client-side.
				echo str_replace( '<a class="proj ', '<a data-type="' . esc_attr( $slug ) . '" class="proj ', $card );
				?>
			<?php endforeach; ?>
		</div>
	</div>
</section>

<?php get_footer(); ?>
