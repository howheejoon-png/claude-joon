<?php
defined( 'ABSPATH' ) || exit;
$c     = lab_contact();
$nav   = lab_nav_items();
// This column is headed "Homes", so it lists only the kinds of home — the
// "Kind of home" box on each property type decides. Commercial work is a
// property type but not a kind of home, and the client asked for it out.
$types = get_terms( [
	'taxonomy'   => 'lab_property_type',
	'hide_empty' => true,
	'meta_query' => [ [ 'key' => 'lab_is_home', 'value' => '1' ] ],
] );
?>
</main>

<footer id="site-footer" class="site-footer is-dark" data-header="dark">
	<div class="container">
		<div class="foot-cta">
			<div class="foot-cta__title">
				<?php lab_heading( (string) lab_opt( 'foot_heading' ), (string) lab_opt( 'foot_em' ), 'display display-lg' ); ?>
			</div>
			<div class="foot-cta__side" data-reveal="fade">
				<?php if ( lab_known( (string) lab_opt( 'foot_aside' ) ) ) : ?>
					<p class="muted measure-narrow"><?php echo esc_html( lab_opt( 'foot_aside' ) ); ?></p>
				<?php endif; ?>
				<a class="btn" href="<?php echo esc_url( lab_contact_url() ); ?>"><span class="btn__dot"></span><?php echo esc_html( lab_opt( 'cta_label' ) ); ?></a>
			</div>
		</div>

		<div class="foot-grid">
			<div class="foot-col">
				<h4><?php esc_html_e( 'Studio', 'lab' ); ?></h4>
				<ul>
					<?php if ( $c['address'] ) : ?>
						<li><a href="<?php echo esc_url( $c['map_url'] ); ?>" target="_blank" rel="noopener"><?php echo wp_kses_post( implode( '<br>', array_map( 'esc_html', $c['address'] ) ) ); ?></a></li>
					<?php endif; ?>
					<?php if ( $c['hours'] ) : ?>
						<li class="muted" style="margin-top:.75rem">
							<?php foreach ( $c['hours'] as $row ) : ?>
								<?php echo esc_html( trim( ( $row['days'] ?? '' ) . ' · ' . ( $row['time'] ?? '' ), ' ·' ) ); ?><br>
							<?php endforeach; ?>
						</li>
					<?php endif; ?>
				</ul>
			</div>
			<div class="foot-col">
				<h4><?php esc_html_e( 'Navigate', 'lab' ); ?></h4>
				<ul>
					<li><a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'lab' ); ?></a></li>
					<?php foreach ( $nav as $item ) : ?>
						<li><a href="<?php echo esc_url( $item['url'] ); ?>"><?php echo esc_html( $item['label'] ); ?></a></li>
					<?php endforeach; ?>
				</ul>
			</div>
			<div class="foot-col">
				<h4><?php esc_html_e( 'Homes', 'lab' ); ?></h4>
				<ul>
					<?php foreach ( (array) $types as $term ) : ?>
						<?php if ( $term instanceof WP_Term ) : ?>
							<li><a href="<?php echo esc_url( (string) get_term_link( $term ) ); ?>"><?php echo esc_html( $term->name ); ?></a></li>
						<?php endif; ?>
					<?php endforeach; ?>
				</ul>
			</div>
			<div class="foot-col">
				<h4><?php esc_html_e( 'Contact', 'lab' ); ?></h4>
				<ul>
					<?php if ( $c['email'] ) : ?><li><a href="mailto:<?php echo esc_attr( $c['email'] ); ?>"><?php echo esc_html( $c['email'] ); ?></a></li><?php endif; ?>
					<?php if ( $c['phone'] ) : ?><li><a href="tel:<?php echo esc_attr( $c['tel'] ); ?>"><?php echo esc_html( $c['phone'] ); ?></a></li><?php endif; ?>
					<?php if ( $c['whatsapp'] ) : ?><li><a href="<?php echo esc_url( $c['whatsapp'] ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'WhatsApp', 'lab' ); ?></a></li><?php endif; ?>
					<?php if ( $c['socials'] ) : ?>
						<li style="margin-top:.75rem">
							<?php
							$links = [];
							foreach ( $c['socials'] as $s ) {
								if ( ! empty( $s['label'] ) && ! empty( $s['url'] ) ) {
									$links[] = sprintf( '<a href="%s" target="_blank" rel="noopener">%s</a>', esc_url( $s['url'] ), esc_html( $s['label'] ) );
								}
							}
							echo wp_kses_post( implode( ' &nbsp;/&nbsp; ', $links ) );
							?>
						</li>
					<?php endif; ?>
				</ul>
			</div>
		</div>

		<div class="foot-bottom">
			<span>&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> Timberlab Pte Ltd. <?php esc_html_e( 'L.A.B is a brand of Timberlab Pte Ltd.', 'lab' ); ?></span>
			<?php if ( lab_known( (string) lab_opt( 'foot_note' ) ) ) : ?>
				<span><?php echo esc_html( lab_opt( 'foot_note' ) ); ?></span>
			<?php endif; ?>
		</div>
		<div class="foot-wordmark" aria-hidden="true">L.A.B</div>
	</div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
