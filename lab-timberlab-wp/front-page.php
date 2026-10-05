<?php
/** Homepage. */
defined( 'ABSPATH' ) || exit;
get_header();

$featured = lab_featured_projects();
$lead     = $featured[0] ?? null;
$poster   = $lead ? ( (int) lab_get( $lead->ID, 'lab_hero', 0 ) ?: (int) get_post_thumbnail_id( $lead ) ) : 0;
// Sources are ordered WebM-then-MP4, mobile-then-desktop: the browser takes the first it can play.
$sources = [];
foreach ( [ 'video_mobile_webm', 'video_mobile', 'video_desktop_webm', 'video_desktop' ] as $key ) {
	$id = (int) lab_opt( $key, 0 );
	if ( ! $id ) {
		continue;
	}
	$url = (string) wp_get_attachment_url( $id );
	if ( ! $url ) {
		continue;
	}
	$sources[] = [
		'url'   => $url,
		'type'  => (string) get_post_mime_type( $id ),
		'media' => str_contains( $key, 'mobile' ) ? '(max-width: 899px)' : '',
	];
}
?>

<section class="hero is-dark" data-header="dark">
	<div class="hero__bg frame" data-hero-img data-hero-frame>
		<?php echo lab_image( $poster, 'hero', $lead ? get_the_title( $lead ) : '', true ); ?>
		<?php if ( $sources ) : ?>
			<video class="hero__video" muted loop playsinline preload="metadata" aria-hidden="true" tabindex="-1" data-hero-video>
				<?php foreach ( $sources as $source ) : ?>
					<source src="<?php echo esc_url( $source['url'] ); ?>" type="<?php echo esc_attr( $source['type'] ); ?>"<?php echo $source['media'] ? ' media="' . esc_attr( $source['media'] ) . '"' : ''; ?>>
				<?php endforeach; ?>
			</video>
		<?php endif; ?>
	</div>

	<div class="container hero__inner">
		<div class="hero__bottom">
			<h1 class="display hero__title" data-hero-title><?php echo nl2br( esc_html( (string) lab_opt( 'hero_heading' ) ) ); ?></h1>
			<?php if ( lab_known( (string) lab_opt( 'hero_line' ) ) ) : ?>
				<p class="hero__line" data-hero-fade><span class="tick"></span><?php echo esc_html( lab_opt( 'hero_line' ) ); ?></p>
			<?php endif; ?>
		</div>
	</div>

	<div class="hero__scroll label" data-hero-fade aria-hidden="true"><span><?php esc_html_e( 'Scroll', 'lab' ); ?></span><span class="rule"></span></div>
</section>

<?php if ( lab_known( (string) lab_opt( 'intro_text' ) ) ) : ?>
<section class="intro" id="about">
	<div class="container intro__grid">
		<div class="intro__label label muted" data-reveal="fade"><?php echo esc_html( lab_opt( 'intro_label' ) ); ?></div>
		<p class="intro__text" data-reveal="lines"><?php echo wp_kses_post( lab_emphasis( (string) lab_opt( 'intro_text' ) ) ); ?></p>
		<div class="intro__side" data-reveal="fade">
			<?php if ( lab_known( (string) lab_opt( 'intro_aside' ) ) ) : ?>
				<p><?php echo esc_html( lab_opt( 'intro_aside' ) ); ?></p>
			<?php endif; ?>
			<a class="link" href="<?php echo esc_url( lab_page_url( 'studio' ) ); ?>"><?php esc_html_e( 'About the studio', 'lab' ); ?> <?php echo lab_arrow(); ?></a>
		</div>
	</div>
</section>
<?php endif; ?>

<?php if ( $featured ) : ?>
<section class="work" id="work">
	<div class="container">
		<?php lab_sec_head( (string) lab_opt( 'work_label' ), (string) lab_opt( 'work_heading' ), (string) lab_opt( 'work_em' ), (string) lab_opt( 'work_aside' ) ); ?>

		<?php
		// Slot shapes are fixed by the design; projects flow into them in order.
		$slots = [
			[ 'item' => 'a', 'cards' => [ [ 'shape' => 'wide', 'parallax' => 10 ] ] ],
			[ 'item' => 'b', 'cards' => [ [ 'shape' => 'tall' ], [ 'shape' => 'square' ] ] ],
			[ 'item' => 'c', 'cards' => [ [ 'shape' => 'land', 'parallax' => 10 ] ] ],
			[ 'item' => 'd', 'cards' => [ [ 'shape' => 'square' ], [ 'shape' => 'tall' ] ] ],
		];
		$n = 0;
		foreach ( $slots as $slot ) {
			$cards = [];
			foreach ( $slot['cards'] as $card ) {
				if ( ! isset( $featured[ $n ] ) ) {
					break;
				}
				$cards[] = [ 'post' => $featured[ $n ], 'card' => $card, 'index' => $n ];
				$n++;
			}
			if ( ! $cards ) {
				continue;
			}
			printf( '<div class="work__item work__item--%s">', esc_attr( $slot['item'] ) );
			foreach ( $cards as $entry ) {
				lab_project_card( $entry['post'], [
					'shape'       => $entry['card']['shape'],
					'parallax'    => $entry['card']['parallax'] ?? 6,
					'number'      => lab_number( $entry['index'] ),
					'show_number' => true,
					'eager'       => $entry['index'] < 2,
				] );
			}
			echo '</div>';
		}
		?>

		<div class="work__all" data-reveal="fade">
			<a class="link-lg" href="<?php echo esc_url( (string) get_post_type_archive_link( 'lab_project' ) ); ?>">
				<span><?php esc_html_e( 'All projects', 'lab' ); ?></span><?php echo lab_arrow_lg(); ?>
			</a>
		</div>
	</div>
</section>
<?php endif; ?>

<?php
$services = get_posts( [
	'post_type'      => 'lab_service',
	'posts_per_page' => -1,
	'orderby'        => [ 'menu_order' => 'ASC', 'date' => 'ASC' ],
] );
?>
<?php if ( $services ) : ?>
<section class="services" id="services">
	<div class="container">
		<?php lab_sec_head( (string) lab_opt( 'svc_label' ), (string) lab_opt( 'svc_heading' ), (string) lab_opt( 'svc_em' ), (string) lab_opt( 'svc_aside' ) ); ?>

		<div class="services__grid">
			<div class="services__list">
				<div class="svc-list" data-services data-reveal="fade">
					<?php foreach ( $services as $i => $service ) : ?>
						<div class="svc<?php echo 0 === $i ? ' is-open' : ''; ?>" data-i="<?php echo esc_attr( (string) $i ); ?>" tabindex="0" role="button" aria-expanded="<?php echo 0 === $i ? 'true' : 'false'; ?>">
							<div class="svc__num"><?php echo esc_html( lab_number( $i ) ); ?></div>
							<h3 class="svc__title"><?php echo esc_html( get_the_title( $service ) ); ?></h3>
							<?php if ( lab_known( (string) lab_get( $service->ID, 'lab_summary' ) ) ) : ?>
								<p class="svc__desc"><?php echo esc_html( lab_get( $service->ID, 'lab_summary' ) ); ?></p>
							<?php endif; ?>
							<?php $points = (array) lab_get( $service->ID, 'lab_points', [] ); ?>
							<div class="svc__more"><div>
								<?php if ( $points ) : ?>
									<ul>
										<?php foreach ( $points as $point ) : ?>
											<li><?php echo esc_html( $point ); ?></li>
										<?php endforeach; ?>
									</ul>
								<?php endif; ?>
							</div></div>
							<span class="svc__plus" aria-hidden="true"></span>
						</div>
					<?php endforeach; ?>
				</div>
			</div>

			<div class="services__side">
				<div class="svc-media" data-services-media data-reveal="fade">
					<?php foreach ( $services as $i => $service ) : ?>
						<?php
						$thumb = (int) get_post_thumbnail_id( $service );
						if ( ! $thumb ) {
							continue;
						}
						echo wp_get_attachment_image( $thumb, 'lab-tall', false, [
							'alt'     => '',
							'class'   => 0 === $i ? 'is-active' : '',
							'loading' => 'lazy',
						] );
						?>
					<?php endforeach; ?>
					<div class="svc-media__cap label" data-cap><?php echo esc_html( get_the_title( $services[0] ) ); ?></div>
				</div>
			</div>
		</div>
	</div>

	<div class="container">
		<a class="svc-more-link" href="<?php echo esc_url( (string) get_post_type_archive_link( 'lab_project' ) ); ?>" data-reveal="fade">
			<span class="label muted"><?php echo esc_html( lab_opt( 'svc_link_label' ) ); ?></span>
			<span class="svc-more-link__cta"><?php echo esc_html( lab_opt( 'svc_link_text' ) ); ?><?php echo lab_arrow_lg(); ?></span>
		</a>
	</div>
</section>
<?php endif; ?>

<?php get_template_part( 'parts/process' ); ?>

<?php
$principles = get_posts( [
	'post_type'      => 'lab_principle',
	'posts_per_page' => -1,
	'orderby'        => [ 'menu_order' => 'ASC', 'date' => 'ASC' ],
	'meta_query'     => [
		'relation' => 'OR',
		[ 'key' => 'lab_where', 'value' => 'home' ],
		[ 'key' => 'lab_where', 'compare' => 'NOT EXISTS' ],
	],
] );
$quote = (string) lab_opt( 'quote_text' );
?>
<?php if ( $principles || lab_known( $quote ) ) : ?>
<section class="cred" id="why">
	<div class="container">
		<?php lab_sec_head( (string) lab_opt( 'cred_label' ), (string) lab_opt( 'cred_heading' ), (string) lab_opt( 'cred_em' ), (string) lab_opt( 'cred_aside' ) ); ?>
		<div class="cred__grid">
			<?php if ( $principles ) : ?>
				<div class="principles" data-stagger>
					<?php foreach ( $principles as $i => $principle ) : ?>
						<div class="principle">
							<div class="principle__num"><?php echo esc_html( lab_number( $i ) ); ?></div>
							<div>
								<h3><?php echo esc_html( get_the_title( $principle ) ); ?></h3>
								<?php if ( lab_known( (string) lab_get( $principle->ID, 'lab_summary' ) ) ) : ?>
									<p><?php echo esc_html( lab_get( $principle->ID, 'lab_summary' ) ); ?></p>
								<?php endif; ?>
							</div>
						</div>
					<?php endforeach; ?>
				</div>
			<?php endif; ?>

			<?php if ( lab_known( $quote ) ) : ?>
				<figure class="quote" data-reveal="fade">
					<div class="quote__mark" aria-hidden="true">&ldquo;</div>
					<blockquote><?php echo esc_html( $quote ); ?></blockquote>
					<?php if ( lab_known( (string) lab_opt( 'quote_by' ) ) ) : ?>
						<figcaption><?php echo esc_html( lab_opt( 'quote_by' ) ); ?></figcaption>
					<?php endif; ?>
				</figure>
			<?php endif; ?>
		</div>
	</div>
</section>
<?php endif; ?>

<section class="enquiry" id="enquire" style="background:var(--paper-2)">
	<div class="container enquiry__grid">
		<div class="enquiry__copy">
			<div class="label label--signal" data-reveal="fade"><?php echo esc_html( lab_opt( 'enq_label' ) ); ?></div>
			<?php lab_heading( (string) lab_opt( 'enq_heading' ), (string) lab_opt( 'enq_em' ) ); ?>
			<?php if ( lab_known( (string) lab_opt( 'enq_aside' ) ) ) : ?>
				<p class="muted measure-narrow" data-reveal="fade"><?php echo esc_html( lab_opt( 'enq_aside' ) ); ?></p>
			<?php endif; ?>
			<?php lab_contact_list(); ?>
		</div>
		<div class="enquiry__form" data-reveal="fade">
			<?php get_template_part( 'parts/enquiry-form' ); ?>
		</div>
	</div>
</section>

<?php get_footer(); ?>
