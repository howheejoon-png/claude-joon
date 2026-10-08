<?php
/** A single project: a dark photograph to open, then photographs and prose. */
defined( 'ABSPATH' ) || exit;
get_header();

while ( have_posts() ) :
	the_post();
	$id      = get_the_ID();
	$gallery = (array) lab_get( $id, 'lab_gallery', [] );
	$details = (array) lab_get( $id, 'lab_details', [] );
	$before  = (int) lab_get( $id, 'lab_before', 0 );
	$after   = (int) lab_get( $id, 'lab_after', 0 );

	$meta = array_filter( [
		__( 'Property', 'lab' )         => lab_property_type( $id ),
		__( 'Home type', 'lab' )        => (string) lab_get( $id, 'lab_home_type' ),
		__( 'Location', 'lab' )         => (string) lab_get( $id, 'lab_location' ),
		__( 'Design direction', 'lab' ) => (string) lab_get( $id, 'lab_direction' ),
		__( 'Year', 'lab' )             => (string) lab_get( $id, 'lab_year' ),
	], 'lab_known' );

	// The strapline over the hero: only what the client has actually confirmed.
	$strap = implode( ' · ', array_filter(
		[ lab_property_type( $id ), (string) lab_get( $id, 'lab_location' ) ],
		'lab_known'
	) );

	// Group the photographs first: a wide one runs on its own, two upright ones
	// sit side by side. Doing this before the prose means a paragraph can never
	// break up a pair.
	$blocks = [];
	$buffer = [];
	foreach ( $gallery as $item ) {
		if ( 'wide' === (string) ( $item['shape'] ?? 'wide' ) ) {
			if ( $buffer ) {
				$blocks[] = $buffer;
				$buffer   = [];
			}
			$blocks[] = [ $item ];
			continue;
		}
		$buffer[] = $item;
		if ( 2 === count( $buffer ) ) {
			$blocks[] = $buffer;
			$buffer   = [];
		}
	}
	if ( $buffer ) {
		$blocks[] = $buffer;
	}

	// The story is told between the photographs, not stacked above them.
	$says = [];
	foreach ( [ __( 'The brief', 'lab' ) => 'lab_brief', __( 'The response', 'lab' ) => 'lab_response' ] as $label => $key ) {
		if ( lab_known( (string) lab_get( $id, $key ) ) ) {
			$says[] = [ $label, (string) lab_get( $id, $key ) ];
		}
	}
	?>

<article class="pd">
	<section class="pd-hero is-dark" data-header="dark">
		<div class="pd-hero__media" data-hero-frame>
			<?php
			// The optional hero photograph, as on the homepage; the cover otherwise.
			$lede = (int) lab_get( $id, 'lab_hero', 0 ) ?: (int) get_post_thumbnail_id( $id );
			echo lab_image( $lede, 'hero', get_the_title(), true );
			?>
		</div>
		<div class="container pd-hero__inner">
			<div class="page-hero__crumb label" data-hero-fade>
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'lab' ); ?></a><span>/</span>
				<a href="<?php echo esc_url( (string) get_post_type_archive_link( 'lab_project' ) ); ?>"><?php esc_html_e( 'Projects', 'lab' ); ?></a>
			</div>
			<?php if ( $strap ) : ?>
				<div class="pd-hero__label label" data-hero-fade><?php echo esc_html( $strap ); ?></div>
			<?php endif; ?>
			<h1 class="display pd-hero__title" data-hero-title><?php the_title(); ?></h1>
		</div>
	</section>

	<?php if ( lab_known( (string) lab_get( $id, 'lab_summary' ) ) || $meta ) : ?>
	<section class="pd-intro">
		<div class="container pd-intro__grid">
			<?php if ( lab_known( (string) lab_get( $id, 'lab_summary' ) ) ) : ?>
				<div class="pd-intro__copy">
					<div class="label label--signal" data-reveal="fade"><?php esc_html_e( 'The project', 'lab' ); ?></div>
					<p class="pd-intro__summary" data-reveal="lines"><?php echo esc_html( lab_get( $id, 'lab_summary' ) ); ?></p>
				</div>
			<?php endif; ?>
			<?php if ( $meta ) : ?>
				<dl class="pd-hero__meta" data-reveal="fade">
					<?php foreach ( $meta as $label => $value ) : ?>
						<div><dt><?php echo esc_html( $label ); ?></dt><dd><?php echo esc_html( $value ); ?></dd></div>
					<?php endforeach; ?>
				</dl>
			<?php endif; ?>
		</div>
	</section>
	<?php endif; ?>

	<?php
	// Space the paragraphs evenly through the photographs, so a short gallery
	// does not leave one stranded at the end.
	$step = max( 2, (int) floor( count( $blocks ) / ( count( $says ) + 1 ) ) );
	?>
	<?php if ( $blocks || $says ) : ?>
	<section class="container pd-flow">
		<?php foreach ( $blocks as $b => $block ) : ?>
			<?php if ( 0 === $b % $step && $says ) : ?>
				<?php lab_pd_say( array_shift( $says ) ); ?>
			<?php endif; ?>

			<?php if ( count( $block ) > 1 ) : ?>
				<div class="pd-flow__pair">
					<?php foreach ( $block as $one ) : ?>
						<figure>
							<div class="frame" data-reveal="clip">
								<?php echo lab_image( (int) $one['id'], 'tall', (string) ( $one['alt'] ?? '' ) ); ?>
							</div>
						</figure>
					<?php endforeach; ?>
				</div>
			<?php else : ?>
				<figure class="pd-flow__full">
					<div class="frame" data-reveal="clip">
						<?php echo lab_image( (int) $block[0]['id'], (string) ( $block[0]['shape'] ?? 'wide' ), (string) ( $block[0]['alt'] ?? '' ) ); ?>
					</div>
				</figure>
			<?php endif; ?>
		<?php endforeach; ?>

		<?php
		// Anything the run of photographs was too short to carry still gets said.
		foreach ( $says as $say ) {
			lab_pd_say( $say );
		}
		?>
	</section>
	<?php endif; ?>

	<?php if ( $details ) : ?>
	<section class="pd-details">
		<div class="container pd-details__grid">
			<div class="pd-details__copy">
				<div class="label label--signal" data-reveal="fade"><?php esc_html_e( 'Design details', 'lab' ); ?></div>
				<?php lab_heading( __( 'Materials and', 'lab' ), __( 'making.', 'lab' ), 'display display-md' ); ?>
			</div>
			<ul class="pd-details__list" data-stagger>
				<?php foreach ( $details as $i => $detail ) : ?>
					<li><span><?php echo esc_html( lab_number( $i ) ); ?></span><?php echo esc_html( $detail ); ?></li>
				<?php endforeach; ?>
			</ul>
		</div>
	</section>
	<?php endif; ?>

	<?php if ( $before && $after ) : ?>
	<section class="ba">
		<div class="container">
			<?php lab_sec_head( __( 'Before / after', 'lab' ), __( 'Before,', 'lab' ), __( 'and after.', 'lab' ), __( 'Drag to compare.', 'lab' ) ); ?>
			<div class="ba__wrap" data-ba data-reveal="fade">
				<?php
				echo wp_get_attachment_image( $before, 'lab-wide', false, [ 'class' => 'ba__before', 'alt' => esc_attr__( 'Before renovation', 'lab' ) ] );
				echo wp_get_attachment_image( $after, 'lab-wide', false, [ 'class' => 'ba__after', 'alt' => esc_attr__( 'After renovation', 'lab' ) ] );
				?>
				<div class="ba__handle" data-ba-handle></div>
				<span class="ba__label ba__label--before"><?php esc_html_e( 'Before', 'lab' ); ?></span>
				<span class="ba__label ba__label--after"><?php esc_html_e( 'After', 'lab' ); ?></span>
				<input class="ba__range" type="range" min="0" max="100" value="50" aria-label="<?php esc_attr_e( 'Compare before and after', 'lab' ); ?>">
			</div>
		</div>
	</section>
	<?php endif; ?>

	<?php
	$all  = lab_projects();
	$ids  = wp_list_pluck( $all, 'ID' );
	$pos  = array_search( $id, $ids, true );
	$next = false !== $pos ? ( $all[ ( $pos + 1 ) % count( $all ) ] ?? null ) : null;
	?>
	<?php if ( $next && $next->ID !== $id ) : ?>
		<a class="next" href="<?php echo esc_url( get_permalink( $next ) ); ?>">
			<div class="frame frame--shade frame--tint" data-parallax="10">
				<?php echo lab_image( (int) get_post_thumbnail_id( $next ), 'hero', '' ); ?>
			</div>
			<div class="container next__inner">
				<div class="label">
					<?php
					$bits = array_filter( [ __( 'Next project', 'lab' ), lab_property_type( $next->ID ), (string) lab_get( $next->ID, 'lab_location' ) ], 'lab_known' );
					echo esc_html( implode( ' — ', $bits ) );
					?>
				</div>
				<h2 class="display"><?php echo esc_html( get_the_title( $next ) ); ?></h2>
			</div>
		</a>
	<?php endif; ?>
</article>

<?php endwhile; ?>
<?php get_footer(); ?>
