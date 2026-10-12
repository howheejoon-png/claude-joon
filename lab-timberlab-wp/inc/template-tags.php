<?php
/** Rendering helpers shared by the templates. */

defined( 'ABSPATH' ) || exit;

/** The large page heading: a custom one if set, otherwise the page title. */
function lab_page_heading( int $post_id ): array {
	$heading = (string) lab_get( $post_id, 'lab_heading' );
	return [
		'text' => lab_known( $heading ) ? $heading : get_the_title( $post_id ),
		'em'   => (string) lab_get( $post_id, 'lab_heading_em' ),
	];
}

/** True when the first section behind the header is a dark one. */
function lab_header_starts_dark(): bool {
	// The front page and a project both open on a dark full-bleed photograph.
	return is_front_page() || is_singular( 'lab_project' );
}

/** Placeholder values should never reach the page as if they were facts. */
function lab_known( ?string $value ): bool {
	$value = trim( (string) $value );
	if ( '' === $value || '—' === $value ) {
		return false;
	}
	return ! preg_match( '/to be confirmed|to be supplied|tbc/i', $value );
}

/** Turn *emphasis* into the greyed display span. */
function lab_emphasis( string $text ): string {
	$escaped = esc_html( $text );
	return preg_replace( '/\*(.+?)\*/', '<em>$1</em>', $escaped );
}

/** Display heading with its greyed second half. */
function lab_heading( string $heading, string $em = '', string $classes = 'display display-lg' ): void {
	printf( '<h2 class="%s" data-reveal="lines">', esc_attr( $classes ) );
	echo esc_html( $heading );
	if ( lab_known( $em ) ) {
		echo ' <em>' . esc_html( $em ) . '</em>';
	}
	echo '</h2>';
}

/** The repeated label / heading / aside block above each section. */
function lab_sec_head( string $label, string $heading, string $em = '', string $aside = '' ): void {
	echo '<div class="sec-head">';
	if ( lab_known( $label ) ) {
		printf( '<div class="sec-head__label label muted" data-reveal="fade"><span>%s</span></div>', esc_html( $label ) );
	}
	if ( lab_known( $heading ) ) {
		echo '<div class="sec-head__title">';
		lab_heading( $heading, $em );
		echo '</div>';
	}
	if ( lab_known( $aside ) ) {
		printf( '<p class="sec-head__aside muted" data-reveal="fade">%s</p>', esc_html( $aside ) );
	}
	echo '</div>';
}

function lab_arrow( string $class = 'arrow' ): string {
	return sprintf(
		'<svg class="%s" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 12L12 2M4 2h8v8"/></svg>',
		esc_attr( $class )
	);
}

function lab_arrow_lg(): string {
	return '<svg class="arrow-lg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 40L40 8M14 8h26v26"/></svg>';
}

/**
 * The brand mark, converted from the client's supplied artwork (LAB_R1.pdf)
 * with every glyph flattened to an outline, so no font file ships.
 *
 * The outlines live once per page in a hidden sprite; each instance is a few
 * hundred bytes of <use>. Every fill is currentColor, so the mark inherits the
 * header's colour and flips with it — ink on paper, paper over a dark hero,
 * ink again on the frosted bar — riding the colour transition already there.
 *
 *   brand   L.A.B beside By Timberlab   3.86 : 1  for the header bar
 *   lockup  the two stacked, as supplied 1.64 : 1  for the full-screen menu
 *   mark    L.A.B alone                 2.11 : 1  for the tab icon
 *
 * The supplied artwork is the stacked lockup. A 72px header bar cannot hold it
 * — the tagline lands at about 6px — so 'brand' sets the same letterforms side
 * by side on one baseline, which is what a horizontal lockup is for.
 */

/** The glyph outlines, emitted once per page. */
function lab_logo_sprite(): string {
	return '<svg class="logo-sprite" width="0" height="0" aria-hidden="true" focusable="false"><defs><path id="font_2_47" d="M.2919922 .17675781 .29003907 0H.020996094V.015136719H.063964847V.62109377H.020996094V.63623049H.1899414V.62109377H.14697266V.015136719H.16992188C.20182292 .015136719 .2261556 .028076172 .24291992 .053955079 .25968424 .079833988 .2709961 .12076823 .27685548 .17675781H.2919922Z"/><path id="font_2_36" d="M.37402345 0H.20898438V.015136719H.25L.21484375 .17822266H.100097659C.083496097 .096191409 .07519531 .051757814 .07519531 .044921876 .07519531 .025065104 .08577474 .015136719 .106933597 .015136719H.12988281V0H0V.015136719H.013183594C.037597658 .015136719 .053222658 .0320638 .060058595 .06591797L.17675781 .64501956H.19580078L.33398438 .015136719H.37402345V0M.21191406 .1928711 .15576172 .4560547 .103027347 .1928711H.21191406Z"/><path id="font_2_37" d="M.23291016 .32421876C.26416017 .31510417 .28767906 .2972819 .3034668 .27075196 .31925456 .244222 .32714845 .20898438 .32714845 .16503906 .32714845 .11425781 .31730143 .07405599 .29760743 .044433595 .27791343 .014811198 .25179038 0 .21923828 0H.020996094V.015136719H.063964847V.62109377H.020996094V.63623049H.20898438C.2421875 .63623049 .26912437 .6217448 .28979493 .59277346 .31046549 .56380209 .32080079 .5255534 .32080079 .47802735 .32080079 .44091798 .3129069 .40885417 .29711915 .38183595 .2813314 .35481773 .25992839 .33626304 .23291016 .32617188V.32421876M.2319336 .38183595V.55908206C.2319336 .58121749 .22875977 .5970866 .22241211 .60668948 .21606446 .6162923 .2055664 .62109377 .19091797 .62109377H.14697266V.3330078H.18408203C.21598308 .3330078 .2319336 .34928385 .2319336 .38183595M.23583985 .076171878V.25390626C.23583985 .29654948 .21988933 .3178711 .18798828 .3178711H.14697266V.015136719H.18896485C.22021485 .015136719 .23583985 .03548177 .23583985 .076171878Z"/><path id="font_2_92" d="M.32080079 .41601563C.30419923 .41503907 .29223634 .41129557 .2849121 .40478517 .2775879 .39827476 .27034507 .38134767 .2631836 .3540039L.13476563-.119140628C.118489589-.18033855 .09358724-.2109375 .060058595-.2109375 .045084638-.2109375 .032470704-.2064616 .022216797-.19750977 .011962891-.18855794 .0068359377-.17708333 .0068359377-.16308594 .0068359377-.15006511 .010579427-.13964844 .018066407-.13183594 .025553385-.12402344 .03548177-.12011719 .047851564-.12011719 .05826823-.12011719 .06656901-.12296549 .072753909-.12866211 .078938808-.13435872 .08203125-.14176433 .08203125-.1508789 .08203125-.15901692 .08024088-.16601563 .076660159-.171875 .075683597-.17350261 .07519531-.17447917 .07519531-.17480469 .07519531-.17903646 .07714844-.18115235 .08105469-.18115235 .08528646-.18115235 .09073893-.17504883 .09741211-.1628418 .10408529-.15063477 .11051432-.13297527 .11669922-.10986328L.14990235 .014160156 .03515625 .41601563H0V.43115235H.1538086V.41601563H.110839847L.1850586 .1430664 .22460938 .29248048C.23697917 .33870445 .24365235 .36417643 .2446289 .36889649 .24560547 .37361656 .24609375 .37858073 .24609375 .38378907 .24609375 .3922526 .24308269 .3997396 .23706055 .40625 .2310384 .4127604 .22395833 .41601563 .21582031 .41601563H.19482422V.43115235H.32080079V.41601563Z"/><path id="font_2_55" d="M.34716798 .46777345H.33203126C.32714845 .5218099 .31640626 .5608724 .2998047 .58496096 .28320313 .6090495 .25830079 .62109377 .22509766 .62109377V.015136719H.2680664V0H.099121097V.015136719H.14208985V.62109377C.108561199 .62109377 .083496097 .6090495 .06689453 .58496096 .05029297 .5608724 .039713544 .5218099 .03515625 .46777345H.020019532V.63623049H.34716798V.46777345Z"/><path id="font_2_76" d="M.09814453 .63623049C.10986328 .63623049 .11995443 .6319987 .12841797 .62353518 .13688152 .6150716 .14111328 .6048177 .14111328 .59277346 .14111328 .5810547 .13688152 .57096359 .12841797 .5625 .11995443 .55403646 .10986328 .5498047 .09814453 .5498047 .08610026 .5498047 .075927738 .55403646 .06762695 .5625 .059326173 .57096359 .05517578 .5810547 .05517578 .59277346 .05517578 .6048177 .059326173 .6150716 .06762695 .62353518 .075927738 .6319987 .08610026 .63623049 .09814453 .63623049M.17822266 0H.018066407V.015136719H.060058595V.41601563H.018066407V.43115235H.13623047V.015136719H.17822266V0Z"/><path id="font_2_80" d="M.5180664 0H.37304688V.015136719H.39990235V.35791017C.39990235 .37451173 .3972982 .3876953 .39208985 .39746095 .3868815 .40722657 .3798828 .41210938 .37109376 .41210938 .3577474 .41210938 .34358726 .40120445 .32861329 .37939454 .3136393 .35758464 .30615235 .33577476 .30615235 .31396485V.015136719H.3330078V0H.203125V.015136719H.22998047V.35791017C.22998047 .37451173 .2273763 .3876953 .22216797 .39746095 .21695964 .40722657 .20996094 .41210938 .20117188 .41210938 .1875 .41210938 .17325847 .40120445 .15844727 .37939454 .14363607 .35758464 .13623047 .33577476 .13623047 .31396485V.015136719H.16308594V0H.018066407V.015136719H.060058595V.4140625H.018066407V.43115235H.13623047V.37304688C.15836589 .41764323 .1883138 .4399414 .22607422 .4399414 .2693685 .4399414 .29508464 .41634117 .30322267 .36914063 .32666017 .41634117 .35758464 .4399414 .3959961 .4399414 .42171226 .4399414 .44148765 .43107096 .45532228 .41333009 .4691569 .3955892 .47607423 .37044273 .47607423 .33789063V.015136719H.5180664V0Z"/><path id="font_2_69" d="M.13623047 .40283204C.15283203 .42692057 .17382813 .43896485 .19921875 .43896485 .23535156 .43896485 .2655436 .41805015 .28979493 .3762207 .31404624 .33439128 .32617188 .28092448 .32617188 .21582031 .32617188 .15071614 .31404624 .09733073 .28979493 .055664064 .2655436 .0139973959 .23535156-.0068359377 .19921875-.0068359377 .17382813-.0068359377 .15283203 .0050455729 .13623047 .028808594V0H.018066407V.015136719H.060058595V.62109377H.018066407V.63623049H.13623047V.40283204M.24511719 .110839847V.32080079C.24511719 .3523763 .240153 .37679038 .23022461 .39404298 .22029622 .41129557 .20654297 .41992188 .18896485 .41992188 .17692058 .41992188 .16512044 .41341148 .15356446 .40039063 .14200847 .38736979 .13623047 .37223307 .13623047 .35498048V.07714844C.13623047 .059895833 .14200847 .044759115 .15356446 .03173828 .16512044 .018717448 .17692058 .012207031 .18896485 .012207031 .20654297 .012207031 .22029622 .020833334 .23022461 .038085939 .240153 .055338544 .24511719 .079589847 .24511719 .110839847Z"/><path id="font_2_72" d="M.2758789 .20507813H.111816409V.10595703C.111816409 .07633463 .118001308 .052897138 .1303711 .03564453 .14274089 .018391928 .15820313 .009765625 .17675781 .009765625 .19824219 .009765625 .2163086 .021484375 .23095703 .044921876 .24560547 .068359378 .2548828 .10139974 .25878907 .14404297H.27490235C.27067057 .09261068 .25976563 .05460612 .2421875 .030029297 .22460938 .005452474 .19889324-.0068359377 .16503906-.0068359377 .12207031-.0068359377 .08894857 .0126953129 .06567383 .051757814 .04239909 .09082031 .030761719 .14615886 .030761719 .21777344 .030761719 .28938804 .041748048 .3441569 .0637207 .38208009 .08569336 .42000328 .11783854 .43896485 .16015625 .43896485 .1985677 .43896485 .22745769 .4194336 .24682617 .3803711 .26619468 .3413086 .2758789 .2828776 .2758789 .20507813M.19824219 .22216797V.35205079C.19824219 .37451173 .19482422 .39208985 .18798828 .40478517 .18115235 .41748048 .171875 .42382813 .16015625 .42382813 .1451823 .42382813 .13338216 .41601563 .12475586 .40039063 .116129558 .38476563 .111816409 .36393229 .111816409 .33789063V.22216797H.19824219Z"/><path id="font_2_85" d="M.1381836 .39892579C.15055339 .4256185 .17154949 .43896485 .20117188 .43896485 .21712239 .43896485 .23071289 .43359376 .24194336 .42285157 .25317384 .41210938 .25878907 .39908854 .25878907 .38378907 .25878907 .37174479 .2548828 .36140953 .24707031 .3527832 .23925781 .3441569 .22916667 .33984376 .21679688 .33984376 .20572917 .33984376 .1965332 .34350587 .18920899 .35083009 .18188477 .3581543 .17822266 .36686198 .17822266 .37695313 .17822266 .38509117 .1821289 .39518229 .1899414 .40722657 .19254558 .41080729 .19384766 .41308595 .19384766 .4140625 .19384766 .41861979 .19124349 .42089845 .18603516 .42089845 .17366536 .42089845 .16227214 .41227214 .15185547 .39501954 .1414388 .37776695 .13623047 .3577474 .13623047 .33496095V.015136719H.17822266V0H.018066407V.015136719H.060058595V.41601563H.018066407V.43115235H.13623047V.39892579H.1381836Z"/><path id="font_2_79" d="M.17822266 0H.018066407V.015136719H.060058595V.62109377H.018066407V.63623049H.13623047V.015136719H.17822266V0Z"/><path id="font_2_68" d="M.296875 .06298828C.296875 .041178388 .2915853 .024251303 .28100587 .012207031 .27042643 .00016276042 .2553711-.005859375 .23583985-.005859375 .20621746-.005859375 .18733724 .009114583 .17919922 .0390625 .16455078 .009114583 .13883464-.005859375 .10205078-.005859375 .07861328-.005859375 .059244794 .0032552083 .043945314 .021484375 .028645834 .039713544 .020996094 .063964847 .020996094 .09423828 .020996094 .11735026 .027018229 .13785808 .0390625 .15576172 .05110677 .17366536 .07373047 .19335938 .106933597 .21484375 .14697266 .24088542 .16894531 .25797526 .17285156 .26611329V.37695313C.17285156 .39160157 .1685384 .40307618 .15991211 .41137696 .15128581 .41967774 .13964844 .42382813 .125 .42382813 .115234378 .42382813 .10579427 .42154948 .09667969 .4169922 .0875651 .4124349 .08300781 .40804038 .08300781 .4038086 .08300781 .3976237 .08626302 .39274089 .09277344 .38916017 .106770839 .3816732 .11376953 .37027995 .11376953 .35498048 .11376953 .34358726 .11010742 .33406578 .1027832 .32641603 .095458988 .31876628 .08626302 .3149414 .07519531 .3149414 .0625 .3149414 .052164716 .31925456 .044189454 .32788087 .03621419 .33650718 .032226564 .34716798 .032226564 .35986329 .032226564 .38004557 .042561849 .39827476 .06323242 .41455079 .08390299 .4308268 .10888672 .43896485 .1381836 .43896485 .16845703 .43896485 .1944987 .4268392 .2163086 .4025879 .23811849 .37833659 .24902344 .3474935 .24902344 .3100586V.04296875C.24902344 .028320313 .2537435 .020996094 .2631836 .020996094 .2758789 .020996094 .28222657 .038411458 .28222657 .07324219H.296875V.06298828M.17285156 .080078128V.24511719C.16764324 .2389323 .15901692 .23160808 .14697266 .22314453 .12809246 .20947266 .115722659 .1965332 .10986328 .18432617 .104003909 .17211914 .10107422 .15673828 .10107422 .1381836V.06689453C.10107422 .036295576 .111979167 .020996094 .13378906 .020996094 .14290364 .020996094 .1516927 .026529948 .16015625 .037597658 .1686198 .048665365 .17285156 .06282552 .17285156 .080078128Z"/><path id="font_3_17" d="M.16796875 .048828126C.16796875 .03483073 .16227214 .02319336 .1508789 .013916016 .13948567 .004638672 .12613933 0 .110839847 0 .07242838 0 .053222658 .016276041 .053222658 .048828126 .053222658 .08691406 .07584635 .10595703 .12109375 .10595703 .13574219 .10595703 .14746094 .100097659 .15625 .088378909 .1640625 .077311199 .16796875 .0641276 .16796875 .048828126Z"/></defs></svg>';
}

/** One instance of the mark: 'brand', 'lockup' or 'mark'. */
function lab_logo( string $variant = 'brand' ): string {
	return match ( $variant ) {
		'lockup' => '<svg class="logo logo--lockup" viewBox="0.85 10.22 84.8 51.8" fill="currentColor" aria-hidden="true" focusable="false"><use href="#font_2_47" transform="matrix(60.548,0,0,-60.997,0,49.902)"/><use href="#font_2_36" transform="matrix(60.548,0,0,-60.997,30.577,49.902)"/><use href="#font_2_37" transform="matrix(60.548,0,0,-60.997,65.452,49.902)"/><use href="#font_2_37" transform="matrix(9.735,0,0,-10.166,47.483,59.453)"/><use href="#font_2_92" transform="matrix(9.735,0,0,-10.166,50.988,59.453)"/><use href="#font_2_55" transform="matrix(9.735,0,0,-10.166,55.992,59.453)"/><use href="#font_2_76" transform="matrix(9.735,0,0,-10.166,59.565,59.453)"/><use href="#font_2_80" transform="matrix(9.735,0,0,-10.166,61.444,59.453)"/><use href="#font_2_69" transform="matrix(9.735,0,0,-10.166,66.633,59.453)"/><use href="#font_2_72" transform="matrix(9.735,0,0,-10.166,70.108,59.453)"/><use href="#font_2_85" transform="matrix(9.735,0,0,-10.166,73.078,59.453)"/><use href="#font_2_79" transform="matrix(9.735,0,0,-10.166,75.657,59.453)"/><use href="#font_2_68" transform="matrix(9.735,0,0,-10.166,77.565,59.453)"/><use href="#font_2_69" transform="matrix(9.735,0,0,-10.166,80.535,59.453)"/><use href="#font_3_17" transform="matrix(18.04,0,0,-18.04,59.144,49.966)"/><use href="#font_3_17" transform="matrix(18.04,0,0,-18.04,22.865,49.948)"/></svg>',
		'mark' => '<svg class="logo logo--mark" viewBox="0.85 10.22 84.8 40.18" fill="currentColor" aria-hidden="true" focusable="false"><use href="#font_2_47" transform="matrix(60.548,0,0,-60.997,0,49.902)"/><use href="#font_2_36" transform="matrix(60.548,0,0,-60.997,30.577,49.902)"/><use href="#font_2_37" transform="matrix(60.548,0,0,-60.997,65.452,49.902)"/><use href="#font_3_17" transform="matrix(18.04,0,0,-18.04,59.144,49.902)"/><use href="#font_3_17" transform="matrix(18.04,0,0,-18.04,22.865,49.902)"/></svg>',
		default => '<svg class="logo logo--brand" viewBox="0.85 10.22 155.233 40.18" fill="currentColor" aria-hidden="true" focusable="false"><use href="#font_2_47" transform="matrix(60.548,0,0,-60.997,0,49.902)"/><use href="#font_2_36" transform="matrix(60.548,0,0,-60.997,30.577,49.902)"/><use href="#font_2_37" transform="matrix(60.548,0,0,-60.997,65.452,49.902)"/><use href="#font_2_37" transform="matrix(16.55,0,0,-17.282,94.251,49.902)"/><use href="#font_2_92" transform="matrix(16.55,0,0,-17.282,100.209,49.902)"/><use href="#font_2_55" transform="matrix(16.55,0,0,-17.282,108.715,49.902)"/><use href="#font_2_76" transform="matrix(16.55,0,0,-17.282,114.789,49.902)"/><use href="#font_2_80" transform="matrix(16.55,0,0,-17.282,117.983,49.902)"/><use href="#font_2_69" transform="matrix(16.55,0,0,-17.282,126.805,49.902)"/><use href="#font_2_72" transform="matrix(16.55,0,0,-17.282,132.713,49.902)"/><use href="#font_2_85" transform="matrix(16.55,0,0,-17.282,137.761,49.902)"/><use href="#font_2_79" transform="matrix(16.55,0,0,-17.282,142.146,49.902)"/><use href="#font_2_68" transform="matrix(16.55,0,0,-17.282,145.39,49.902)"/><use href="#font_2_69" transform="matrix(16.55,0,0,-17.282,150.438,49.902)"/><use href="#font_3_17" transform="matrix(18.04,0,0,-18.04,59.144,49.902)"/><use href="#font_3_17" transform="matrix(18.04,0,0,-18.04,22.865,49.902)"/></svg>',
	};
}

/** Map a layout shape onto a registered image size. */
function lab_size_for( string $shape ): string {
	return match ( $shape ) {
		'tall'   => 'lab-tall',
		'square' => 'lab-square',
		'land'   => 'lab-land',
		'hero'   => 'lab-hero',
		default  => 'lab-wide',
	};
}

/** An <img> with the designed placeholder as a fallback when nothing is set. */
function lab_image( int $attachment_id, string $shape = 'wide', string $alt = '', bool $eager = false ): string {
	$size = lab_size_for( $shape );
	if ( $attachment_id && wp_attachment_is_image( $attachment_id ) ) {
		return wp_get_attachment_image( $attachment_id, $size, false, [
			'alt'           => $alt,
			'loading'       => $eager ? 'eager' : 'lazy',
			'decoding'      => 'async',
			'fetchpriority' => $eager ? 'high' : 'auto',
		] );
	}
	$n = ( abs( crc32( $alt . $shape ) ) % 8 ) + 1;
	return sprintf(
		'<img src="%s" alt="%s" loading="lazy" decoding="async">',
		esc_url( LAB_URI . '/img/placeholders/ph-' . $n . '.svg' ),
		esc_attr( $alt )
	);
}

/** The property type a project is filed under. */
function lab_property_type( int $post_id ): string {
	$terms = get_the_terms( $post_id, 'lab_property_type' );
	if ( ! $terms || is_wp_error( $terms ) ) {
		return '';
	}
	return $terms[0]->name;
}

/** Tags under a project card — unconfirmed fields are simply omitted. */
function lab_project_tags( int $post_id ): array {
	$tags = [
		lab_property_type( $post_id ),
		(string) lab_get( $post_id, 'lab_home_type' ),
		(string) lab_get( $post_id, 'lab_location' ),
		(string) lab_get( $post_id, 'lab_direction' ),
	];
	return array_values( array_filter( $tags, 'lab_known' ) );
}

/**
 * A project card as used on the homepage sequence and the Projects index.
 *
 * @param array{shape?:string,number?:string,show_number?:bool,eager?:bool,parallax?:int} $args
 */
function lab_project_card( WP_Post $post, array $args = [] ): void {
	$shape    = $args['shape'] ?? 'wide';
	$number   = $args['number'] ?? '';
	$parallax = (int) ( $args['parallax'] ?? 6 );
	$type     = lab_property_type( $post->ID );
	$title    = get_the_title( $post );
	$alt      = trim( $title . ' — ' . implode( ', ', lab_project_tags( $post->ID ) ), ' —,' );

	printf(
		'<a class="proj proj--%s" href="%s" aria-label="%s">',
		esc_attr( $shape ),
		esc_url( get_permalink( $post ) ),
		esc_attr( $title )
	);

	if ( ! empty( $args['show_number'] ) && $number ) {
		printf( '<div class="proj__num" aria-hidden="true">%s', esc_html( $number ) );
		if ( $type ) {
			printf( '<sup>%s</sup>', esc_html( $type ) );
		}
		echo '</div>';
	}

	printf(
		'<div class="frame frame--shade" data-reveal="clip"%s>',
		$parallax > 0 ? ' data-parallax="' . $parallax . '"' : ''
	);
	echo lab_image( (int) get_post_thumbnail_id( $post ), $shape, $alt, ! empty( $args['eager'] ) );
	echo '</div>';

	echo '<div class="proj__meta">';
	printf( '<h3 class="proj__title">%s</h3>', esc_html( $title ) );
	$tags = ( $args['tags'] ?? true ) ? lab_project_tags( $post->ID ) : [];
	if ( $tags ) {
		echo '<ul class="proj__tags">';
		foreach ( $tags as $tag ) {
			printf( '<li>%s</li>', esc_html( $tag ) );
		}
		echo '</ul>';
	}
	echo '</div></a>';
}

/** One narrative beat set between the photographs on a project page. */
function lab_pd_say( array $say ): void {
	printf(
		'<div class="pd-flow__say measure" data-reveal="fade"><h2>%s</h2><p>%s</p></div>',
		esc_html( $say[0] ),
		esc_html( $say[1] )
	);
}

/** Fetch projects in their editor-defined order. */
function lab_projects( array $args = [] ): array {
	return get_posts( wp_parse_args( $args, [
		'post_type'      => 'lab_project',
		'posts_per_page' => -1,
		'orderby'        => [ 'menu_order' => 'ASC', 'date' => 'DESC' ],
	] ) );
}

/** Projects ticked for the homepage sequence (max six). */
function lab_featured_projects(): array {
	$featured = lab_projects( [
		'posts_per_page' => 6,
		'meta_query'     => [ [ 'key' => 'lab_featured', 'value' => '1' ] ],
	] );
	return $featured ?: array_slice( lab_projects( [ 'posts_per_page' => 6 ] ), 0, 6 );
}

/** Zero-padded sequence number for a project's position on the page. */
function lab_number( int $index ): string {
	return str_pad( (string) ( $index + 1 ), 2, '0', STR_PAD_LEFT );
}

/** Contact details, assembled once. */
function lab_contact(): array {
	return [
		'address'  => array_values( array_filter( array_map( 'trim', explode( "\n", (string) lab_opt( 'address' ) ) ) ) ),
		'map_url'  => (string) lab_opt( 'map_url' ),
		'phone'    => (string) lab_opt( 'phone' ),
		'tel'      => (string) lab_opt( 'phone_raw' ),
		'email'    => (string) lab_opt( 'email' ),
		'whatsapp' => (string) lab_opt( 'whatsapp' ),
		'hours'    => (array) lab_opt( 'hours', [] ),
		'socials'  => (array) lab_opt( 'socials', [] ),
	];
}

/** The contact list beside the enquiry form. */
function lab_contact_list( bool $with_hours = false ): void {
	$c = lab_contact();
	echo '<ul class="enquiry__alt" data-reveal="fade">';
	if ( $c['address'] ) {
		printf(
			'<li><span>%s</span><a href="%s" target="_blank" rel="noopener">%s</a></li>',
			esc_html__( 'Studio', 'lab' ),
			esc_url( $c['map_url'] ),
			wp_kses_post( implode( '<br>', array_map( 'esc_html', $c['address'] ) ) )
		);
	}
	if ( $c['phone'] ) {
		printf(
			'<li><span>%s</span><a href="tel:%s">%s</a></li>',
			esc_html__( 'Phone', 'lab' ),
			esc_attr( $c['tel'] ),
			esc_html( $c['phone'] )
		);
	}
	if ( $c['email'] ) {
		printf(
			'<li><span>%s</span><a href="mailto:%s">%s</a></li>',
			esc_html__( 'Email', 'lab' ),
			esc_attr( $c['email'] ),
			esc_html( $c['email'] )
		);
	}
	if ( $with_hours && $c['hours'] ) {
		printf( '<li><span>%s</span><span class="hours">', esc_html__( 'Opening hours', 'lab' ) );
		foreach ( $c['hours'] as $row ) {
			printf( '<span><i>%s</i><b>%s</b></span>', esc_html( $row['days'] ?? '' ), esc_html( $row['time'] ?? '' ) );
		}
		echo '</span></li>';
	}
	echo '</ul>';
}
