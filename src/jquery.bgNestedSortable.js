(function($) {

	/**
	 * Name: bgNestedSortable
	 * Author: Henrik Alm�r for AGoodId
	 *
	 * This plugin controls expand/collapse and drag/drop of nested structures presented
	 * in table form.
	 *
	 * Dependencies: jQuery, jQueryUI Core, jQuery UI Draggable, jQuery UI Droppable
	 *
	 * @param settings: JavaScript object of settings
	 *
	 * TODO: Enable dropping at root level
	 * TODO: Add/remove toggle buttons in function insertAfter and insertBefore
	 * TODO: Refactor insertAfter, insertBefore and append functions for better code reuse
	 * TODO: Implement validation to prevent dropping a parent in it's own child or descendant
	 */

	$.fn.bgNestedSortable = function(settings) {
		var config = {
			'tolerance':			1,
			'interval':				30,
			'expandCollapse':	true,
			'dragAndDrop':		true,
			'initHidden':			true,
			'dataClass':			'nested-data',
			'parentClass':		'has-children'
		};
		
		if (settings) $.extend(config, settings);
		
		this.each(function() {
			var self = this;

			$(self).data('config', config);
			
			var lastRun = 0;
			var lastMousePos = { x: 0, y: 0 };
			var dropAction = false;
			var dropTarget = false;

			var draggableConfig = {
				appendTo:	'body',
				revert:		'invalid',
				revertDuration:		0,
				drag:			function(e, ui) {

										// Check for throttling
										var thisRun = new Date().getTime();
										if(thisRun - lastRun < config.interval)
											return;
      
										lastRun = thisRun;
										
										// Check if mouse position has changed
										var thisMousePos = { x: e.pageX, y: e.pageY };
										if ( thisMousePos.x == lastMousePos.x && thisMousePos.y == lastMousePos.y )
											return;
										
										lastMousePos = thisMousePos;
										
										/**
										 * Whenever an element is dragged we need to determine what action
										 * to take once the dragging stops. We need to know this action in
										 * the drag event in order to be able to show a correctly positioned
										 * drop indicator.
										 */

										var targetRow = $(self).find('.ui-droppable-hover');
										var distance = 0;
										var offset;
										var height;

										if (targetRow.length > 0) {
											var distance = getDistance(e.pageX, e.pageY, targetRow);
										
											offset = targetRow.offset();
											height = targetRow.height();
											
											var curDropAction = getDropAction(e.pageY, offset.top, height);
											
											/**
											 * Check if a drop action was found and if so update the stored
											 * drop action.
											 */
											
											if (curDropAction) {
												hideDropIndicator(self);
												showDropIndicator(dropAction, targetRow);

												dropAction =  curDropAction;
												dropTarget = targetRow;
											}
										} else if (dropTarget) {
											var distance = getDistance(e.pageX, e.pageY, dropTarget);
										}
										
										/**
										 * Unset the drop action and drop target if the distance from
										 * cursor to element edge is greater than the specified tolerance.
										 */
										
										if (parseInt(config.tolerance) < parseInt(distance)) {
											hideDropIndicator(self);

											dropAction = false;
											dropTarget = false;
										}
									},
				stop:			function(e, ui) {

										/**
										 * Because draggables can be dropped between elements, the droppable
										 * drop event does not always fire. Therefor we need to move the 
										 * actions that would normally belong to a droppable drop event to
										 * the draggable stop event. What we do here is check if a drop 
										 * action is set, and if so execute the function corresponding to 
										 * that action.
										 *
										 * ui.helper is the clone (visible while dragging).
										 * e.target is the original draggable.
										 * dropTarget is the target that we should append to.
										 */

										switch(dropAction) {
											case 'append':
												setParentClass(self, ui.helper);
												removeFamily(self, $(e.target));
												$(e.target).remove();
												
												appendFamily(self, ui.helper, dropTarget);
												break;

											case 'insertBefore':
												removeFamily(self, $(e.target));
												$(e.target).remove();
													
												insertFamilyBefore(self, ui.helper, dropTarget);
												break;

											case 'insertAfter':
												removeFamily(self, $(e.target));
												$(e.target).remove();
													
												insertFamilyAfter(self, ui.helper, dropTarget);
												break;

											default:
												break;
										}

										hideDropIndicator(self);
									},
				helper:		function(e, ui) {

										/**
										 * This helper takes a dragged row and clones it to a new 
										 * table in a div. This is needed to be able to show the 
										 * dragged element on screen.
										 */

										var helper = 
											$('<div class="nested-table-item-dragging"><table></table></div>')
											.find('table').append($(e.target).closest('tr').clone());

										return getFamily(self, helper, $(e.target).closest('tr')).end();
									}
			};

			var droppableConfig = {
				tolerance:		'pointer',
				activeClass:	'ui-droppable-active',
				hoverClass:		'ui-droppable-hover',
				drop:					function() {}
			};
			
			$(self).find('tr').draggable(draggableConfig).droppable(droppableConfig)
				.data('init', true);
			
			// If a hovered item i not initiated as a draggable/droppable, 
			// initiate it (for live items)
			$(self).find('tr').live('mouseover', function() {
				if (!$(this).data('init')) {
					$(this).data('init', true);
					$(this).draggable(draggableConfig).droppable(droppableConfig);
				}
			});

			// Hide (or show) all children on init
			if (config.initHidden) {
				$(self).find("tr[class*='child-of-']").hide();
				$(self).find("tr[class*='" + config.parentClass + "']").addClass('collapsed');
			} else {
				$(self).find("tr[class*='" + config.parentClass + "']").addClass('expanded');
			}
		
			// Prepend expand/collapse-links to all rows that have children
			$(self).find('tr.' + config.parentClass + ' td.' + config.dataClass)
				.prepend('<a href="" class="expand-collapse"></a>');
			
			// Assign click handlers to expand/collapse-links
			$(self).find('a.expand-collapse').live('click', function(e) {
				$(this).closest('tr').toggleClass('collapsed').toggleClass('expanded');
				toggleChildren(self, $(this).closest('tr'));

				e.preventDefault();
			});
		});
		
		return this;
	};
	
	/**
	 * Private function toggleChildren. Runs recursively to toggle all children and 
	 * grand-children when an expand/collapse-link is clicked.
	 *
	 * @param container: containing element used to control the scope of the function.
	 * @param parent: the parent element
	 */

	function toggleChildren(container, parent) {
		var parentId = parent.attr('id');
		var expandedChildren = $(container).find('.child-of-' + parentId + '.expanded');

		$(container).find('.child-of-' + parentId).each(function() {
			$(this).toggle();
		});
		
		if ( expandedChildren.length > 0 ) {
			expandedChildren.each(function() {
				toggleChildren(container, $(this));
			});
		}
	};
	
	/**
	 * Private function getFamily. Recursively fetches all children and grand-children
	 * of the selected element and returns them as a jQuery-object.
	 *
	 * @param container: the containing element.
	 * @param draggable: the draggable jQuery object that the family is appended to
	 * @param parent: the parent item to use as starting point when looking for descendants
	 */
	
	function getFamily(container, helper, parent) {
		var config = $(container).data('config');

		$(container).find('.child-of-' + parent.attr('id')).each(function() {
			helper.append($(this).clone());
			
			if ($(this).hasClass(config.parentClass)) {
				getFamily(container, helper, $(this));
			}
		});
		
		return helper;
	}
	
	/**
	 * Private function appendFamily. Appends the dropped family at the right place
	 * in the table.
	 *
	 * @param container: the containing element
	 * @param family: the draggable helper object
	 * @param target: the droppable target row
	 */
	
	function appendFamily(container, family, target) {
		var config = $(container).data('config');

		var targetLevel = getLevel($(target).attr('class'));
		var firstChildLevel = getLevel(family.find('table tbody')
			.find('tr:first-child').attr('class'));
		
		// Set parent for top-level children
		family.find('table tbody tr.level' + firstChildLevel).each(function() {
			setParent(target, this);
		});
		// Set level for all children
		family.find('table tbody').children().each(function() {
			setLevel(targetLevel, firstChildLevel, this);
		});
		
		$(target).addClass(config.parentClass + ' expanded').find('td.' + config.dataClass)
		if ( $(target).find('td.' + config.dataClass + ' a.expand-collapse').length <= 0 ) {
			$(target).find('td.' + config.dataClass)
				.prepend('<a href="" class="expand-collapse"></a>');
		}

		family.find('table tbody').children().insertAfter($(target));
	}
	
	/**
	 * Private function insertFamilyBefore.
	 *
	 * @param container: the containing element
	 * @param family: the draggable helper object
	 * @param target: the droppable target row
	 */

	function insertFamilyBefore(container, family, target) {
		var config = $(container).data('config');
		var targetParent = getParent(container, target);

		if (false == targetParent) {
			//
		} else {
			var targetLevel = getLevel($(targetParent).attr('class'));
			var firstChildLevel = getLevel(family.find('table tbody')
				.find('tr:first-child').attr('class'));
			
			// Set parent for top-level children
			family.find('table tbody tr.level' + firstChildLevel).each(function() {
				setParent(targetParent, this);
			});

			// Set level for all children
			family.find('table tbody').children().each(function() {
				setLevel(targetLevel, firstChildLevel, this);
			});
		
			$(targetParent).addClass(config.parentClass + ' expanded').find('td.' + config.dataClass)
			if ( $(targetParent).find('td.' + config.dataClass + ' a.expand-collapse').length <= 0 ) {
				$(targetParent).find('td.' + config.dataClass)
					.prepend('<a href="" class="expand-collapse"></a>');
			}
		}

		family.find('table tbody').children().insertBefore($(target));
	}
	
	/**
	 * Private function insertFamilyAfter.
	 *
	 * @param container: the containing element
	 * @param family: the draggable helper object
	 * @param target: the droppable target row
	 */

	function insertFamilyAfter(container, family, target) {
		var config = $(container).data('config');
		var targetParent = getParent(container, target);

		var targetLevel = getLevel($(targetParent).attr('class'));
		var firstChildLevel = getLevel(family.find('table tbody')
			.find('tr:first-child').attr('class'));

		// Set parent for top-level children
		family.find('table tbody tr.level' + firstChildLevel).each(function() {
			setParent(targetParent, this);
		});

		// Set level for all children
		family.find('table tbody').children().each(function() {
			setLevel(targetLevel, firstChildLevel, this);
		});
		
		$(targetParent).addClass(config.parentClass + ' expanded').find('td.' + config.dataClass)
		if ( $(targetParent).find('td.' + config.dataClass + ' a.expand-collapse').length <= 0 ) {
			$(targetParent).find('td.' + config.dataClass)
				.prepend('<a href="" class="expand-collapse"></a>');
		}

		family.find('table tbody').children().insertAfter($(target));
	}
	
	/**
	 * Private function removeFamily. Removes the original table rows of after they
	 * have been dropped and appended at a different place in the table.
	 *
	 * @param container: the containing element
	 * @param parent: the parent row
	 */
	
	function removeFamily(container, parent) {
		var config = $(container).data('config');

		$(container).find('.child-of-' + parent.attr('id')).each(function() {			
			if ($(this).hasClass(config.parentClass)) {
				removeFamily(container, $(this));
			}
			
			$(this).remove();
		});
	}
	
	/**
	 * Private function getLevel. Searches a class string for "level##" and returns
	 * an integer.
	 *
	 * @param class: string
	 */
	
	function getLevel(class) {
		var startPos = class.indexOf('level') + 5;
		var endPos = class.indexOf(' ', startPos);

		return ( endPos != -1 ) ? parseInt( class.substring(startPos, endPos) )
														: parseInt( class.substring(startPos) );
	}
	
	/**
	 * Private function setLevel. Sets the level of a dropped element.
	 *
	 * @param rootLevel: base level
	 * @param firstChildLevel: level of the first child
	 * @param child: jQuery element
	 */
	
	function setLevel(rootLevel, firstChildLevel, child) {
		var curLevel = getLevel($(child).attr('class'));
		var newLevel = rootLevel + 1 + (curLevel - firstChildLevel);
		
		$(child).removeClass('level' + curLevel);
		$(child).addClass('level' + newLevel);
	}
	
	/**
	 * Private function setParent. Assigns a row the correct parent row by
	 * class name
	 *
	 * @param container: the containing element
	 * @param child: child object
	 */
	
	function getParent(container, child) {
		var parentClass = getParentClass(child);
		var parentId = parentClass.substring(9);

		return (false == parentClass) ? false : $(container).find('#' + parentId);
	}
	
	/**
	 * Private function setParent. Assigns a row the correct parent row by 
	 * class name
	 *
	 * @param parent: parent object
	 * @param child: child object
	 */
	
	function setParent(parent, child) {
		var curClass = getParentClass(child);

		$(child).removeClass(curClass);
		$(child).addClass('child-of-' + $(parent).attr('id'));
	}
	
	/**
	 * Private function getParentClass.
	 *
	 * @param child: child object
	 */
	
	function getParentClass(child) {
		var class = $(child).attr('class');
		var startPos = class.indexOf('child-of-');
		var endPos = class.indexOf(' ', startPos);

		if (-1 == startPos) {
			return false;
		}

		return (-1 != endPos) ? class.substring(startPos, endPos)
													: class.substring(startPos);
	}
	
	/**
	 * Private function setParentClass. When a row has been dropped, we need
	 * to determine wether it's parent row (if there is one) has other children
	 * or if the parentClass should be removed.
	 *
	 * @param container: the containing element
	 * @param child: the row that has been dropped
	 */
	
	function setParentClass(container, child) {
		var config = $(container).data('config');

		var class = $(child).attr('class');
		var startPos = class.indexOf('child-of-') + 9;
		var endPos = class.indexOf(' ', startPos);
		var parentId = ( endPos != -1 ) ? class.substring(startPos, endPos)
																		: class.substring(startPos);

		if ( $(container).find('.child-of-' + parentId).length < 2 ) {
			$(container).find('#' + parentId).removeClass(config.parentClass + ' expanded collapsed')
				.find('a.expand-collapse').remove();
		}
	}
	
	/**
	 * Private function getDropAction. Determines what drop action to take by
	 * determining mouse position compared to the droppable row
	 *
	 * @param mouseY: mouse y-position
	 *�@param targetY: target rows top left corner y-coord
	 * @param height: target rows height
	 */
	
	function getDropAction(mouseY, targetY, height) {
		var droppableRange = {top: targetY, bottom: targetY + height};
		var topRange = {top: targetY, bottom: targetY + (height * 0.2)};
		var bottomRange = {top: targetY + height - (height * 0.2), bottom: targetY + height};
										
		var dropAction = false;

		dropAction = ( mouseY > droppableRange.top && mouseY < droppableRange.bottom )
										? 'append' : dropAction;

		dropAction = ( mouseY > topRange.top && mouseY < topRange.bottom )
										? 'insertBefore' : dropAction;

		dropAction = ( mouseY > bottomRange.top && mouseY < bottomRange.bottom )
										? 'insertAfter' : dropAction;
		
		return dropAction;
	}
	
	/**
	 * Private function showDropIndicator.
	 *
	 * @param dropAction: the action to be taken on drop
	 * @param target: the target droppable
	 */

	function showDropIndicator(dropAction, target) {
		target.removeClass('bg-nested-table-droppable-append-hover');
		target.siblings().removeClass('bg-nested-table-droppable-hover');
	
		switch(dropAction) {
			case 'append':
				target.addClass('bg-nested-table-droppable-append-hover');
				break;

			case 'insertBefore':
				showDropIndicatorBar(dropAction, target);
				break;

			case 'insertAfter':
				showDropIndicatorBar(dropAction, target);
				break;

			default:
				break;
		}
	}
	
	/**
	 * Private function showDropIndicatorBar.
	 *
	 * @param dropAction: the action to be taken on drop
	 * @param target: the target droppable
	 */
	
	function showDropIndicatorBar(dropAction, target) {
		var maxW = parseInt(target.parent('tbody').find('tr:first-child td.nested-data').width());
		var delta = parseInt(maxW - target.find('td.nested-data').width());
		
		var offset = target.find('td.nested-data').offset();

		var top = ('insertBefore' == dropAction)
								? parseInt(offset.top)
								: parseInt(offset.top + target.find('td.nested-data').height());

		var left = parseInt(offset.left + delta);
		
		var w = parseInt(target.width() - delta);

		$('body').append('<div class="drop-indicator-bar" style="height: 1px; width: '
												+ w + 'px; position: absolute; top: '
												+ top + 'px; left: '
												+ left + 'px;"></div>');
	}
	
	/**
	 * Private function hideDropIndicator.
	 *
	 * @param container: the containing element
	 */
	
	function hideDropIndicator(container) {
		$(container).find('tr').removeClass('bg-nested-table-droppable-append-hover');
		$('.drop-indicator-bar').remove();
			//.removeClass('bg-nested-table-droppable-before-hover')
			//.removeClass('bg-nested-table-droppable-after-hover');
	}
	
	/**
	 * Private function getDistance. Gets the distance from the mouse cursor
	 * to the targets edges.
	 *
	 * @param mouseX: mouse x position
	 * @param mouseY: mouse y position
	 * @param target: the target object
	 */
	
	function getDistance(mouseX, mouseY, target) {
		var center = getCenter(target);
		var vector = { x: Math.abs(mouseX-center.x), y: Math.abs(mouseY-center.y) };
		var edgeDistance = {	x: vector.x - (target.width() / 2),
													y: vector.y - (target.height() / 2) };

		return Math.max(edgeDistance.x, edgeDistance.y);
	}
	
	/**
	 * Private function getCenter. Gets the x and y of an objects center
	 *
	 * @param target: the target object
	 */

	function getCenter(target) {
		var offset = $(target).offset();

		return {
			x:offset.left+ ($(target).width() / 2),
			y:offset.top + ($(target).height() / 2)
		}
	}
})(jQuery);