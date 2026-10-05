/* Repeaters, media pickers and drag-to-reorder for the theme's fields. */
( function ( $ ) {
	'use strict';

	var rowIndex = Date.now();

	function openMedia( options, onPick ) {
		var frame = wp.media( options );
		frame.on( 'select', function () {
			onPick( frame.state().get( 'selection' ) );
		} );
		frame.open();
	}

	// Single image fields
	$( document ).on( 'click', '[data-lab-media-pick]', function ( e ) {
		e.preventDefault();
		var $field = $( this ).closest( '[data-lab-media]' );
		openMedia(
			{ title: 'Choose image', library: { type: 'image' }, multiple: false },
			function ( selection ) {
				var item = selection.first().toJSON();
				var thumb = ( item.sizes && item.sizes.medium ) ? item.sizes.medium.url : item.url;
				$field.find( '[data-lab-media-input]' ).val( item.id );
				$field.find( '[data-lab-media-preview]' ).html( '<img src="' + thumb + '" alt="">' );
			}
		);
	} );

	$( document ).on( 'click', '[data-lab-media-clear]', function ( e ) {
		e.preventDefault();
		var $field = $( this ).closest( '[data-lab-media]' );
		$field.find( '[data-lab-media-input]' ).val( 0 );
		$field.find( '[data-lab-media-preview]' ).empty();
	} );

	// Simple and multi-column repeaters
	$( document ).on( 'click', '[data-lab-repeat-add]', function ( e ) {
		e.preventDefault();
		var $wrap = $( this ).closest( '[data-lab-repeat]' );
		var html = $wrap.find( '[data-lab-repeat-tpl]' ).html().split( '__i__' ).join( String( rowIndex++ ) );
		$wrap.find( '[data-lab-repeat-rows]' ).append( html ).find( ':input' ).last().trigger( 'focus' );
	} );

	$( document ).on( 'click', '[data-lab-repeat-remove]', function ( e ) {
		e.preventDefault();
		$( this ).closest( '[data-lab-repeat-row]' ).remove();
	} );

	// Gallery: add several images at once
	$( document ).on( 'click', '[data-lab-gallery-add]', function ( e ) {
		e.preventDefault();
		var $wrap = $( this ).closest( '[data-lab-gallery]' );
		openMedia(
			{ title: 'Add photographs', library: { type: 'image' }, multiple: 'add' },
			function ( selection ) {
				selection.each( function ( model ) {
					var item = model.toJSON();
					var thumb = ( item.sizes && item.sizes.thumbnail ) ? item.sizes.thumbnail.url : item.url;
					var html = $wrap.find( '[data-lab-gallery-tpl]' ).html().split( '__i__' ).join( String( rowIndex++ ) );
					var $row = $( html );
					$row.find( 'input[type="hidden"]' ).val( item.id );
					$row.find( '.lab-gal__thumb' ).html( '<img src="' + thumb + '" alt="">' );
					if ( item.alt ) {
						$row.find( 'input[type="text"]' ).val( item.alt );
					}
					$wrap.find( '[data-lab-gallery-items]' ).append( $row );
				} );
			}
		);
	} );

	$( document ).on( 'click', '[data-lab-gallery-remove]', function ( e ) {
		e.preventDefault();
		$( this ).closest( '[data-lab-gallery-item]' ).remove();
	} );

	$( function () {
		if ( ! $.fn.sortable ) {
			return;
		}
		$( '[data-lab-gallery-items]' ).sortable( { handle: '.lab-gal__handle', items: '> [data-lab-gallery-item]' } );
		$( '[data-lab-repeat-rows]' ).sortable( { handle: '.lab-gal__handle', items: '> [data-lab-repeat-row]' } );
	} );
}( jQuery ) );
