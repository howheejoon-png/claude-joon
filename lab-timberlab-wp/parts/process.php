<?php
/** The scroll-driven "From plan to place" section. */
defined( 'ABSPATH' ) || exit;

$steps = get_posts( [
	'post_type'      => 'lab_step',
	'posts_per_page' => -1,
	'orderby'        => [ 'menu_order' => 'ASC', 'date' => 'ASC' ],
] );
if ( ! $steps ) {
	return;
}
?>
<section class="process is-dark" id="process" data-header="dark">
	<div class="process__sticky">
		<div class="process__canvas" aria-hidden="true"></div>
		<div class="process__fallback" aria-hidden="true">
			<img src="<?php echo esc_url( LAB_URI . '/assets/placeholders/plan-fallback.svg' ); ?>" alt="">
		</div>

		<div class="container process__steps" data-steps aria-live="polite">
			<?php foreach ( $steps as $i => $step ) : ?>
				<div class="step<?php echo 0 === $i ? ' is-active' : ''; ?>">
					<div class="step__card">
						<div class="step__num"><?php echo esc_html( lab_number( $i ) ); ?></div>
						<h3 class="step__title"><?php echo esc_html( get_the_title( $step ) ); ?></h3>
						<?php if ( lab_known( (string) lab_get( $step->ID, 'lab_summary' ) ) ) : ?>
							<p><?php echo esc_html( lab_get( $step->ID, 'lab_summary' ) ); ?></p>
						<?php endif; ?>
						<?php $tags = (array) lab_get( $step->ID, 'lab_points', [] ); ?>
						<?php if ( $tags ) : ?>
							<ul>
								<?php foreach ( $tags as $tag ) : ?>
									<li><?php echo esc_html( $tag ); ?></li>
								<?php endforeach; ?>
							</ul>
						<?php endif; ?>
					</div>
				</div>
			<?php endforeach; ?>
		</div>

		<div class="container process__head">
			<div>
				<div class="label label--signal" style="margin-bottom:.75rem"><?php echo esc_html( lab_opt( 'proc_label' ) ); ?></div>
				<?php lab_heading( (string) lab_opt( 'proc_heading' ), (string) lab_opt( 'proc_em' ), 'display' ); ?>
			</div>
			<div class="process__progress label muted">
				<span data-step-label>01</span>
				<div class="bar"><i></i></div>
				<span><?php echo esc_html( lab_number( count( $steps ) - 1 ) ); ?></span>
			</div>
		</div>
	</div>
	<div class="process__track" aria-hidden="true" data-step-count="<?php echo esc_attr( (string) count( $steps ) ); ?>" style="height: calc(100svh * <?php echo esc_attr( (string) max( 1, count( $steps ) - 1 ) ); ?>)"></div>
</section>
