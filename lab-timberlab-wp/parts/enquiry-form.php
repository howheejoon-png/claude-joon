<?php
/** The enquiry form. Posts to admin-ajax; falls back to a normal POST without JS. */
defined( 'ABSPATH' ) || exit;

$compact = ! empty( $args['compact'] );
$types   = get_terms( [ 'taxonomy' => 'lab_property_type', 'hide_empty' => false ] );
$statuses = [
	__( 'New / key collection soon', 'lab' ),
	__( 'Resale', 'lab' ),
	__( 'Currently living in it', 'lab' ),
];
?>
<form class="form" method="post" novalidate data-lab-enquiry>
	<div class="form__row form__row--2">
		<div class="field">
			<label for="f-name"><?php esc_html_e( 'Name', 'lab' ); ?></label>
			<input id="f-name" name="name" type="text" placeholder="<?php esc_attr_e( 'Your name', 'lab' ); ?>" required autocomplete="name">
		</div>
		<div class="field">
			<label for="f-phone"><?php esc_html_e( 'Phone', 'lab' ); ?></label>
			<input id="f-phone" name="phone" type="tel" placeholder="+65" autocomplete="tel">
		</div>
	</div>
	<div class="field">
		<label for="f-email"><?php esc_html_e( 'Email', 'lab' ); ?></label>
		<input id="f-email" name="email" type="email" placeholder="you@example.com" required autocomplete="email">
	</div>

	<?php if ( $types && ! is_wp_error( $types ) ) : ?>
		<div class="field">
			<span class="field__label"><?php esc_html_e( 'Property type', 'lab' ); ?></span>
			<div class="pills" role="group" aria-label="<?php esc_attr_e( 'Property type', 'lab' ); ?>">
				<?php foreach ( $types as $term ) : ?>
					<label class="pill"><input type="radio" name="propertyType" value="<?php echo esc_attr( $term->name ); ?>" class="sr-only"><?php echo esc_html( $term->name ); ?></label>
				<?php endforeach; ?>
			</div>
		</div>
	<?php endif; ?>

	<div class="field">
		<span class="field__label"><?php esc_html_e( 'Property status', 'lab' ); ?></span>
		<div class="pills" role="group" aria-label="<?php esc_attr_e( 'Property status', 'lab' ); ?>">
			<?php foreach ( $statuses as $status ) : ?>
				<label class="pill"><input type="radio" name="propertyStatus" value="<?php echo esc_attr( $status ); ?>" class="sr-only"><?php echo esc_html( $status ); ?></label>
			<?php endforeach; ?>
		</div>
	</div>

	<?php if ( ! $compact ) : ?>
		<div class="form__row form__row--2">
			<div class="field">
				<label for="f-budget"><?php esc_html_e( 'Approximate budget', 'lab' ); ?> <span class="optional"><?php esc_html_e( '(optional)', 'lab' ); ?></span></label>
				<select id="f-budget" name="budget">
					<option value=""><?php esc_html_e( 'Select a range', 'lab' ); ?></option>
					<?php foreach ( [ 'Under S$30k', 'S$30k – S$60k', 'S$60k – S$100k', 'S$100k – S$200k', 'Above S$200k' ] as $range ) : ?>
						<option><?php echo esc_html( $range ); ?></option>
					<?php endforeach; ?>
				</select>
			</div>
			<div class="field">
				<label for="f-timeline"><?php esc_html_e( 'Renovation timeline', 'lab' ); ?> <span class="optional"><?php esc_html_e( '(optional)', 'lab' ); ?></span></label>
				<select id="f-timeline" name="timeline">
					<option value=""><?php esc_html_e( 'Select a timeline', 'lab' ); ?></option>
					<?php foreach ( [ 'Within 3 months', '3 – 6 months', '6 – 12 months', 'Just exploring' ] as $when ) : ?>
						<option><?php echo esc_html( $when ); ?></option>
					<?php endforeach; ?>
				</select>
			</div>
		</div>
	<?php endif; ?>

	<div class="field">
		<label for="f-msg"><?php esc_html_e( 'Tell us about your home', 'lab' ); ?> <span class="optional"><?php esc_html_e( '(optional)', 'lab' ); ?></span></label>
		<textarea id="f-msg" name="message" rows="3" placeholder="<?php esc_attr_e( 'Floor plan, moodboard links, what matters most to you…', 'lab' ); ?>"></textarea>
	</div>

	<p class="lab-hp" aria-hidden="true">
		<label><?php esc_html_e( 'Company', 'lab' ); ?><input type="text" name="company" tabindex="-1" autocomplete="off"></label>
	</p>

	<div class="form__foot">
		<button class="btn" type="submit"><span class="btn__dot"></span><?php esc_html_e( 'Send enquiry', 'lab' ); ?></button>
		<p class="form__note"><?php esc_html_e( 'We reply within two working days. No obligation, no hard sell.', 'lab' ); ?></p>
	</div>

	<div class="form__success" role="status">
		<p class="display display-sm"><?php esc_html_e( "Thank you. We'll be in touch shortly.", 'lab' ); ?></p>
	</div>
</form>
