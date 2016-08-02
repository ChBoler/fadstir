
var Galapagos = {};

Y.use('node', function(Y) {

	Galapagos.Site = (function(){

		var $productPage;

		function init() {

			$productPage = Y.one('.collection-type-products');

			if( $productPage && $productPage.hasClass('view-list') ) Galapagos.ProductList.init();
			if( $productPage && $productPage.hasClass('view-item') ) Galapagos.ProductItem.init();

			addDesktopTouchscreenClass();
			addMediaQueryBreakpointClass();
			bindEventListeners();

		}

		function addDesktopTouchscreenClass() {

			if (Y.one('html').hasClass('touch')) {
				var mousemoveDetection = Y.on('mousemove', function(){
					Y.one('body').addClass('galapagos-desktop-touchscreen');
					mousemoveDetection.detach();
				});
			}

		}

		function addMediaQueryBreakpointClass() {

			if( document.documentElement.clientWidth <= 724 ) {
				if (Y.one('.catnav-container')) Y.one('.nav-container').prepend(Y.one('.catnav-list'));
				Y.one('html').addClass('tablet-breakpoint-mixin');
			} else {
				if (Y.one('.catnav-container')) Y.one('.catnav-container').prepend(Y.one('.catnav-list'));
				Y.one('html').removeClass('tablet-breakpoint-mixin');
			}

		}

		function bindEventListeners() {
			Y.on('resize', addMediaQueryBreakpointClass);
		}

		function getDocWidth() {
			return Y.one(document).get('docWidth');
		}

		function getDocHeight() {
			return Y.one(document).get('docHeight');
		}

		return {
			init:init,
			getDocWidth: getDocWidth,
			getDocHeight:  getDocHeight
		}

	}());


	Galapagos.TweakListener = (function(){

		function listen(tweakName, callBack) {

			if (Y.Global) {
				Y.Global.on('tweak:change', Y.bind(function(f){
					if ((f.getName() == tweakName) && (typeof callBack === 'function')) {
						callBack(f.getValue());
					}
				}));
			}

		}

		return {
			listen:listen
		}

	}());


	Galapagos.ProductItem = (function(){

		var cat;
		var $imageContainer;
		var $images;
		var imageZoomInstances = [];

		function init() {

			cat = Y.QueryString.parse(location.search.substring(1)).category;
			$imageContainer = Y.one('#jsProductItemImages');
			$images = $imageContainer.all('img[data-src]');

			if ( cat ) setCatCrumb();
			loadProductDetailImages();

			bindEventListeners();
			bindTweakListeners();
			buildProductDetailImagesLightbox();

		}

		function bindEventListeners() {

			Y.on('resize', function(){
				loadProductDetailImages();
			});

		}

		function setCatCrumb() {

			var $catCrumb = Y.one('#jsCategoryCrumb');
			var $catCrumbLink = $catCrumb.one('a');
			var catCrumbHref = $catCrumbLink.getAttribute('href');

			//var $mobileCatCrumbLink = Y.one('#jsMobileCategoryCrumb');

			$catCrumbLink.set('text', cat).setAttribute('href', catCrumbHref + '?category=' + encodeURIComponent(cat));
			//$mobileCatCrumbLink.setAttribute('href', catCrumbHref + '?category=' + encodeURIComponent(cat));

			$catCrumb.removeClass('galapagos-display-none');

		}

		function loadProductDetailImages() {

			var imageZoomEnabled = Y.one('.tweak-product-item-image-zoom-enabled');

			$images.each(function(image) {

				ImageLoader.load(image.removeAttribute('data-load'), { load:true });

				if (imageZoomEnabled) {
					image.on('load', function() {
						instantiateImageZoom(image);
					});
				}
			});

		}

		function instantiateImageZoom(image) {
			imageZoomInstances.push(new Y.Squarespace.ImageZoom({
				host: image.get('parentNode'),
				behavior: 'hover',
				zoom: parseFloat(Y.Squarespace.Template.getTweakValue('tweak-product-item-image-zoom-factor'))
			}));
		}

		function destroyImageZoomInstances() {
			if (!imageZoomInstances || imageZoomInstances.length < 1) {
			  return;
			}

			Y.Array.each(imageZoomInstances, function(zoomInstance){
			  zoomInstance.destroy(true);
			});
		}

		function buildProductDetailImagesLightbox() {

			if ($images.size() >= 1 ) {

				var lightboxSet = [];

				$images.each(function(image) {
					lightboxSet.push({
						content: image
					});
				});

				// Only show controls for size > 1
				var hasControls = $images.size() > 1;

				$imageContainer.delegate('click', function(e) {

					var lightbox = new Y.Squarespace.Lightbox2({
						controls: {
							previous: hasControls,
							next: hasControls
						},
						set: lightboxSet,
						currentSetIndex: $images.indexOf(e.target)
					});

					lightbox.render();

				}, 'img', this);

			}
		}

		function bindTweakListeners() {

			if (Y.Global) {
				Y.Global.on('tweak:close', function() {
					if (Y.one('.collection-type-products.view-item')) {
						destroyImageZoomInstances();
						if (Y.one('.tweak-product-item-image-zoom-enabled')) {
							$images.each(function(image){
								instantiateImageZoom(image);
							});
						}
					}
				}, this);
			}
		}

		return {
			init:init
		}

	}());


	Galapagos.ProductList = (function(){

		var $catNav,
			$productGrid,
			$productGridOrphans,
			$productGridImages,
			$orphanProducts,
			productCount,
			maxGridUnit,
			orphanProductCount,
			isGridBuilt;


		function init() {

			$catNav = Y.one('#jsCatNav');
			$productGrid = Y.one('#jsProductGrid');
			$productGridOrphans = Y.one('#jsProductGridOrphans');

			if (!Y.UA.mobile && Y.one('.show-alt-image-on-hover:not(.product-info-style-overlay)')) {
				$productGridImages = $productGrid.all('img[data-src]');
			} else {
				$productGridImages = $productGrid.all('img.productlist-image--main[data-src]');
			}

			productCount = $productGrid.all('.productlist-item').size();
			maxGridUnit = 8;
			orphanProductCount;
			isGridBuilt = false;

			bindEventListeners();
			bindTweakListeners();
			if($catNav) setActiveCategory();
			if(Y.one('body').hasClass('product-grid-style-organic')) {
				buildGrid();
			} else {
				$productGrid.removeClass('loading').removeClass('loading-height');
				loadGridImages($productGridImages);
			}

		}

		function bindEventListeners() {

			Y.on('resize', function(){
				loadGridImages($productGridImages);
			});

		}

		function buildGrid() {

			for (var i = maxGridUnit; i > 0; i--) {

				orphanProductCount = productCount % i;

				if(productCount <= maxGridUnit || i > 4) {

					if(0 === orphanProductCount) {

						$productGrid.addClass('item-grid-' + i);

						isGridBuilt = true;
						break;

					}

				} else {

					if(0 === productCount % 9) {  // if productCount is a multiple of 9, use the 9-grid.  we use 9-grid only for multiples of 9 because 8-grid looks more interesting.

						$productGrid.addClass('item-grid-' + 9);

					} else { // otherwise, use the 8-grid and put the remainder into the orphan div

						$productGrid.addClass('item-grid-' + maxGridUnit);
						$orphanProducts = Y.all('.productlist-item').slice((productCount % maxGridUnit) * -1);

						$productGridOrphans
							.append($orphanProducts)
							.addClass('item-grid-' + productCount % maxGridUnit);
					}

					isGridBuilt = true;
					break;

				}

			}

			if(isGridBuilt) {
				$productGrid.removeClass('loading').removeClass('loading-height');
				loadGridImages();
			}

		}

		function setActiveCategory() {

			var catNavItemCount = $catNav.all('.catnav-item').size();

			for (var i = catNavItemCount - 1; i > 0; i--) {

				var $item = $catNav.all('.catnav-item').item(i);
				var $link = $item.one('.catnav-link');
				var category = Y.QueryString.parse(location.search.substring(1)).category;
				var href = Y.QueryString.parse($link.getAttribute('href').substring(2)).category;

				if(category && href && category === href) {
					$item.addClass('active-link');
				}
				else if(!category) {
					$catNav.one('#jsCatNavRoot').addClass('active-link');
				}

			}

		}

		function loadGridImages() {
			$productGridImages.each(function(image) {
				ImageLoader.load(image.removeAttribute('data-load'), { load: true });

				image.on('load', function(){
					if (image.hasClass('productlist-image--main.has-alt-image')) {
						image.siblings('.productlist-image--alt').removeClass('galapagos-hidden');
					}
				});
			});
		}

		function bindTweakListeners() {

			if (Y.Global) {

				Y.Global.on(['tweak:beforeopen', 'tweak:close', 'tweak:reset'], function() {
					setTimeout(function(){
						Galapagos.ProductList.init();
					}, 1000);
				});

				Y.Global.on(['tweak:beforeopen'], function() {
					setTimeout(function(){
						Galapagos.ProductList.init();
						$productGrid.one('.productlist-item').addClass('is-hovered');
					}, 1000);
				});

				Y.Global.on(['tweak:close'], function() {
					setTimeout(function(){
						Galapagos.ProductList.init();
						$productGrid.one('.productlist-item').removeClass('is-hovered');
					}, 1000);
				});

			}

			Galapagos.TweakListener.listen('product-grid-style', function(value) {

				if('Organic' === value) {
					buildGrid();
				} else {
					$productGrid.append($orphanProducts);
					loadGridImages();
				}
			});

			Galapagos.TweakListener.listen('product-info-style', function(value) {

				if('Overlay' === value) {
					$productGrid.one('.productlist-item').addClass('is-hovered');
				} else {
					$productGrid.one('.productlist-item').removeClass('is-hovered');
				}

			});

			Galapagos.TweakListener.listen('productImageAspectRatio', function(value) {
				loadGridImages();
			});

			Galapagos.TweakListener.listen('productImageSpacing', function(value) {
				loadGridImages();
			});

		}

		return {
			init:init
		}


	}());


	Y.on('domready', function() {

		Galapagos.Site.init();

	});

});
