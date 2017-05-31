'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (options) {
    var _grid;
    var _ranges = [];
    var _self = this;
    var _handler = new Slick.EventHandler();
    var _inHandler;
    var _options;
    var _defaults = {
        selectActiveRow: true
    };
    var viewModel = options.viewModel,
        //Should be the itemsViewModel reference
    keyFields = options.viewModel.key ? options.viewModel.key.slice() : [],
        containerId = viewModel.id,
        columns = viewModel.columns,
        lastItemSelected = observable(undefined),
        selected = {},
        viewModelItemsSub,
        editStatus = observable(false),
        editValue = observable(""),
        editorCurrentRow = observable(),
        editorCurrentCell = observable(),
        selection = observableArray([]),
        selectionKeys = observableArray([]);
    var onSelectStart = new Subject();
    var onSelect = new Subject(),
        onSelectEnd = new Subject(),
        window,
        document,
        contextWindow,
        $contextMenu,
        lastEditedCell = observable(false),
        flashTimeouts = [];

    function init(grid) {
        _options = _jquery2.default.extend(true, {}, _defaults, options);
        _grid = grid;
        _handler.subscribe(_grid.onActiveCellChanged, wrapHandler(handleActiveCellChange));
        _handler.subscribe(_grid.onKeyDown, wrapHandler(handleKeyDown));
        _handler.subscribe(_grid.onClick, wrapHandler(handleClick));
        _handler.subscribe(_grid.onContextMenu, wrapHandler(handleContextMenu));
        _handler.subscribe(_grid.onCellChange, wrapHandler(handleCellChange));
        _handler.subscribe(_grid.onCellCssStylesChanged, wrapHandler(handleStyleChanged));

        document = grid.getCanvasNode().ownerDocument;
        window = document.defaultView;

        var appendContextMenu = function appendContextMenu(body) {
            $contextMenu = (0, _jquery2.default)(document.querySelector(options.contextMenuSelector));
            $contextMenu.appendTo(body);
            $contextMenu.show(); // contextMenu css class is hidden by default
            body.ownerDocument.childNodes[0].classList.add("noborder");
            $contextMenu.on("click", hideContextWindow);
        };

        if (options.contextMenuWindow != null) {
            //If the window is passed in
            contextWindow = options.contextMenuWindow;
            appendContextMenu(contextWindow.getBody());
        } else if (options.contextMenuSelector != null) {
            //if a selector is passed in build the window
            var curWnd = windowFactory.windowManager.getWindowByElement(grid.getCanvasNode());
            contextWindow = windowFactory.createWindow({
                _isPopup: true,
                debug: "virtualSelection Context Menu",
                autoShow: false,
                resizable: false,
                showTaskbarIcon: false,
                alwaysOnTop: true,
                _parent: curWnd,
                hideOnClose: true,
                _showOnParentShow: false,
                _alwaysAboveParent: true,
                _closeOnLostFocus: true,
                cornerRounding: {
                    "width": 0,
                    "height": 0
                },
                _fitToElement: options.contextMenuSelector
            });

            contextWindow.addEventListener("renderable", appendContextMenu);
        }
        // This gets executed on a timeout because some DOM events and observable subscriptions are out of order when adding new items:
        viewModelItemsSub = viewModel.items.subscribe(wrapTimeoutHandler(function () {
            selectRows();
        }));

        //Set up mouse events to respond to column reordering
        wireColumnArrangment();
    }

    //Hides the right click menu if present
    function hideContextWindow() {
        document.body.removeEventListener('mousedown', hideContextWindow, true);

        if (contextWindow != null && contextWindow.isVisible()) {
            contextWindow.hide();
            window.focus();
            _grid.focus();
        }
    }

    //Sets up drag and drop functions for the grid
    function wireColumnDragDrop(args) {

        //this is where jQuery goes wrong: cannot use document.body since it refers to main; need to search into document (through grid ref)
        var $wndBody = (0, _jquery2.default)(document).find("body");
        var gridColumns;
        var $draggingColumnDiv;
        var $sourceColumnDiv;
        var sourceColumnOrigOpacity;
        var lastColumnId;
        var mouseDownTimeout;
        var endDragXY;

        var parentRow = args.parentRow;
        var triggerColumnMouseOver = args.triggerColumnMouseOver;

        //Get reference to the container window to wire the column listeners
        var wnd = windowmanager.Window.getCurrent();
        wnd.onReady(function () {
            _handler.subscribe(_grid.onColumnsReordered, wrapHandler(wireDragDrop));
            wireDragDrop();
        });

        //Performs initial setup of mouse events for the current columns collection
        function wireDragDrop() {
            //Set the mouse events for all column headers
            gridColumns = _grid.getColumnHeaders();
            gridColumns.forEach(function (col) {
                col.removeEventListener('mousedown', columnMouseDown);
                col.addEventListener('mousedown', columnMouseDown);
            });

            //     gridColumns = _grid.getHeaderRow().children;
            //     for (let i = 0; i < gridColumns.length; i++) {
            //         gridColumns[i].removeEventListener('mousedown', columnMouseDown);
            //         gridColumns[i].addEventListener('mousedown', columnMouseDown);
            //     };
        }

        //Initiate the cell drag animation
        function columnMouseDown(e) {
            if (e.button !== 0) return;

            //Store the current column id
            var $target = (0, _jquery2.default)(e.target);
            if ($target.is("span")) $target = $target.parent();

            lastColumnId = $target.data().column.id;

            //In case this is an accidental click and drag - no need for abort since the column mouseenter's are not wired yet
            parentRow.addEventListener('mouseleave', endDraggingCleanup);
            $wndBody[0].addEventListener('mouseup', endDraggingCleanup);

            //Show the drag icon after a slight delay
            clearTimeout(mouseDownTimeout);

            mouseDownTimeout = setTimeout(function () {
                parentRow.removeEventListener('mouseleave', endDraggingCleanup);

                //Wire the movements and set to abort if the window is exited
                $wndBody[0].addEventListener('mousemove', columnMouseMove);
                $wndBody[0].addEventListener('mouseleave', abortDrop);

                //Wire the columns to reorder - this will happen after the window mouseup clears the drag div
                gridColumns.forEach(function (col) {
                    col.addEventListener('mouseenter', columnMouseEnter);
                });

                //Clone the header and append to body
                $draggingColumnDiv = $target.clone().attr("id", "columnDragCopy").addClass("slick-header-column-dragging").appendTo($wndBody);

                //Show the object
                $draggingColumnDiv.show();
                columnMouseMove(e);

                $sourceColumnDiv = $target;
                sourceColumnOrigOpacity = $target.css("opacity");
                $sourceColumnDiv.css("opacity", 0.2);
            }, 250);
        }

        //Move the drag div with the mouse
        function columnMouseMove(e) {
            //Check for zoom factor - can zoom while dragging so have to do it here every time
            var bodyZoom = $wndBody[0].style.zoom != null && $wndBody[0].style.zoom !== "" ? parseFloat($wndBody[0].style.zoom) : 1;

            var left = (e.pageX - $draggingColumnDiv.width() / 2) / bodyZoom;
            var top = (e.pageY - $draggingColumnDiv.height() / 2) / bodyZoom;
            $draggingColumnDiv.offset({ left: left, top: top });
        }

        //Clean up the DOM when no longer dragging
        function endDraggingCleanup(e) {

            //Preserve the mouseup XY to compare against in mouseenter
            endDragXY = e.clientX.toString() + "," + e.clientY.toString();

            //Clean out timers and events 
            clearTimeout(mouseDownTimeout);
            $wndBody[0].removeEventListener('mousemove', columnMouseMove);
            $wndBody[0].removeEventListener('mouseleave', abortDrop);
            $wndBody[0].removeEventListener('mouseup', endDraggingCleanup);

            //In case the timeout above never completed
            parentRow.removeEventListener('mouseleave', endDraggingCleanup);

            //Reset divs
            if ($draggingColumnDiv != null) $draggingColumnDiv.remove();

            if ($sourceColumnDiv != null) $sourceColumnDiv.css("opacity", sourceColumnOrigOpacity);
        }

        //Reorder the columns
        function columnMouseEnter(e) {

            //Coordinates of the enter must match the drop
            var xy = e.clientX.toString() + "," + e.clientY.toString();
            if (endDragXY !== xy) {
                abortDrop(e);
                return;
            }

            //Get the id of the drag target
            var $target = (0, _jquery2.default)(e.target);
            if ($target.is("span")) $target = $target.parent();

            //Drop column must be different from the selected column
            var dropColumn = $target.data().column;
            if (dropColumn == null || dropColumn.id === lastColumnId) {
                abortDrop(e);
                return;
            }

            //Go to rearrange
            var cols = columns();

            var reorderedIds = cols.select(function (col, idx) {
                return { id: col.id, idx: idx };
            }).toArray();

            //Move the original column
            var oldidx = reorderedIds.first(function (rid) {
                return rid.id === lastColumnId;
            }).idx;

            var newidx = reorderedIds.first(function (rid) {
                return rid.id === dropColumn.id;
            }).idx;

            var newidxoffset = 0;
            var oldidxoffset = 0;

            if (newidx > oldidx) {
                if (newidx - oldidx === 1) newidxoffset++;
            } else {
                oldidxoffset++;
            }

            reorderedIds.splice(newidx + newidxoffset, 0, reorderedIds[oldidx]);
            reorderedIds.splice(oldidx + oldidxoffset, 1);

            //Build the new column array and set the grid which will trigger the reordered event
            var reorderedColumns = [];
            for (var i = 0; i < reorderedIds.length; i++) {
                var origCol = cols.first(function (c) {
                    return c.id === reorderedIds[i].id;
                });
                reorderedColumns.push(origCol);
            }
            columns(reorderedColumns);
            _grid.onColumnsReordered.notify({ grid: _grid }, new Slick.EventData(), _grid);

            //Trigger mouse over for this column so the resize handlers are shown properly
            triggerColumnMouseOver(lastColumnId);
        }

        //Abort any potential move if the mouse leaves the window or columns
        function abortDrop(e) {
            gridColumns.forEach(function (col) {
                col.removeEventListener('mouseenter', columnMouseEnter);
            });

            endDraggingCleanup(e);
        }
    }

    //Sets up column resize functions for the grid and calls for drag/drop wiring
    function wireColumnArrangment() {
        //this is where jQuery goes wrong: cannot use document.body since it refers to main; need to search into document (through grid ref)
        var $wndBody = (0, _jquery2.default)(document).find("body");
        var parentRow;
        var gridColumns;
        var $sourceColumnDiv;
        var $priorColumnDiv;
        var $resizeDivLeft;
        var $resizeDivRight;
        var resizeLastX;
        var sourceColumnId;
        var priorColumnId;
        var resizeTimeout;

        //Get reference to the container window to wire the column listeners
        _grid.onHeaderRowRendered.subscribe(prepArrangement);

        function prepArrangement(e, args) {
            _grid.onHeaderRowRendered.unsubscribe(prepArrangement);
            parentRow = args.headerRow;

            var wnd = windowmanager.Window.getCurrent();
            wnd.onReady(function () {
                _handler.subscribe(_grid.onColumnsReordered, wrapHandler(wireResizing));
                wireResizing();

                //Window and grid are ready so set drag/drop
                var args = {
                    triggerColumnMouseOver: triggerColumnMouseOver,
                    parentRow: parentRow
                };
                wireColumnDragDrop(args);
            });
        }

        //Performs initial setup of mouse events for the current columns collection
        function wireResizing() {
            //Set the mouse events for all column headers
            gridColumns = _grid.getColumnHeaders();
            gridColumns.forEach(function (col) {
                col.removeEventListener('mouseenter', columnMouseOver);
                col.addEventListener('mouseenter', columnMouseOver);
            });

            // gridColumns = _grid.getHeaderRow().children;
            // for (let i = 0; i < gridColumns.length; i++) {
            //     gridColumns[i].removeEventListener('mouseenter', columnMouseOver);
            //     gridColumns[i].addEventListener('mouseenter', columnMouseOver);
            // };
        }

        //Insert the resize div next to the current column header cell
        function columnMouseOver(e) {
            //Do not work up the column divs if currently in a drag - this is faster then unwiring mouseover's
            if (e != null && e.buttons === 1) return;

            //Set the row to cleanup
            endResizingCleanup();
            parentRow.addEventListener('mouseleave', endResizingCleanup);
            $wndBody[0].addEventListener('mouseleave', endResizingCleanup);

            //Store the current column id
            $sourceColumnDiv = (0, _jquery2.default)(e.target);
            if ($sourceColumnDiv.is("span")) $sourceColumnDiv = $sourceColumnDiv.parent();

            sourceColumnId = $sourceColumnDiv.data().column.id;

            //Insert the resize div after a slight delay
            resizeTimeout = setTimeout(function () {
                var offset = $sourceColumnDiv.offset();

                $resizeDivRight = (0, _jquery2.default)('<div id="divResizeRight"></div>').height($sourceColumnDiv.outerHeight()).addClass('slick-resizable-handle').offset({ left: offset.left + $sourceColumnDiv.outerWidth(), top: offset.top }).appendTo($wndBody);

                $resizeDivRight[0].addEventListener('mousedown', resizeDown);

                //Determine the previous column
                var cols = _grid.getColumns();
                var curridx = cols.select(function (c, idx) {
                    return { id: c.id, idx: idx };
                }).first(function (c) {
                    return c.id === sourceColumnId;
                }).idx;

                priorColumnId = curridx > 0 ? cols[curridx - 1].id : null;

                if (priorColumnId != null) {
                    $priorColumnDiv = (0, _jquery2.default)(gridColumns.first(function (c) {
                        return (0, _jquery2.default)(c).data('column').id === priorColumnId;
                    }));

                    $resizeDivLeft = (0, _jquery2.default)('<div id="divResizeLeft"></div>').height($sourceColumnDiv.outerHeight()).addClass('slick-resizable-handle').offset({ left: offset.left, top: offset.top }).appendTo($wndBody);

                    $resizeDivLeft[0].addEventListener('mousedown', resizeDown);
                }
            }, 100);
        }

        //Add listeners for mousemove to adjust column sizes
        function resizeDown(e) {
            if (e.button !== 0) return;

            if (e.srcElement.id === "divResizeRight") {
                var offset = $resizeDivRight.offset();
                $resizeDivRight.offset({ left: offset.left, top: offset.top });

                if ($resizeDivLeft != null) {
                    $resizeDivLeft.remove();
                    $resizeDivLeft = null;
                }
            } else {
                offset = $resizeDivLeft.offset();
                $resizeDivLeft.offset({ left: offset.left, top: offset.top });

                if ($resizeDivRight != null) {
                    $resizeDivRight.remove();
                    $resizeDivRight = null;
                }
            }

            resizeLastX = e.x;

            $wndBody[0].addEventListener('mousemove', resizeMove);
            $wndBody[0].addEventListener('mouseup', resizeUp);
            $wndBody[0].addEventListener('mouseleave', resizeUp);
        }

        //Handle resizing the column and relocating the resize divs
        function resizeMove(e) {
            var diff = e.x - resizeLastX;
            var newwidth;
            var offset;
            var localCol;

            if ($resizeDivRight != null) {

                newwidth = $sourceColumnDiv.outerWidth() + diff;
                _grid.setColumnWidth(sourceColumnId, newwidth);

                offset = $resizeDivRight.offset();
                $resizeDivRight.offset({ left: offset.left + diff, top: offset.top });

                localCol = columns().first(function (c) {
                    return c.id === sourceColumnId;
                });
            } else {
                newwidth = $priorColumnDiv.outerWidth() + diff;
                _grid.setColumnWidth(priorColumnId, newwidth);

                offset = $resizeDivLeft.offset();
                $resizeDivLeft.offset({ left: offset.left + diff, top: offset.top });

                localCol = columns().first(function (c) {
                    return c.id === priorColumnId;
                });
            }

            //Save the width locally
            localCol.width = newwidth;
            resizeLastX = e.x;
        }

        //clean up body listeners
        function resizeUp(e) {
            $wndBody[0].removeEventListener('mousemove', resizeMove);
            $wndBody[0].removeEventListener('mouseup', resizeUp);
            $wndBody[0].removeEventListener('mouseleave', resizeUp);
        }

        //Clean up divs and handlers
        function endResizingCleanup(e) {
            //Abort if entering a resize div
            if (e != null && ($resizeDivRight != null && e.toElement === $resizeDivRight[0] || $resizeDivLeft != null && e.toElement === $resizeDivLeft[0])) return;

            clearTimeout(resizeTimeout);

            if ($resizeDivLeft != null) $resizeDivLeft.remove();

            if ($resizeDivRight != null) $resizeDivRight.remove();

            if (parentRow != null) parentRow.removeEventListener('mouseleave', endResizingCleanup);

            if ($wndBody != null) $wndBody[0].removeEventListener('mouseleave', endResizingCleanup);
        }

        //Simulate mouse over exposed for the benefit of drag-drop
        function triggerColumnMouseOver(columnId) {
            var col = gridColumns.first(function (c) {
                return (0, _jquery2.default)(c).data('column').id === columnId;
            });
            var e = { target: col };
            columnMouseOver(e);
        }
    }

    function destroy() {
        _handler.unsubscribeAll();
        viewModelItemsSub.dispose();
    }

    function wrapTimeoutHandler(handler) {
        return function () {
            setTimeout(handler, 0);
        };
    }

    function wrapHandler(handler) {
        return function () {
            if (!_inHandler) {
                _inHandler = true;
                handler.apply(_grid, arguments);
                _inHandler = false;
            }
        };
    }

    function rangesToRows(ranges) {
        var rows = [];
        for (var i = 0; i < ranges.length; i++) {
            for (var j = ranges[i].fromRow; j <= ranges[i].toRow; j++) {
                rows.push(j);
            }
        }
        return rows;
    }

    function rowsToRanges(rows) {
        var ranges = [];
        var lastCell = _grid.getColumns().length - 1;
        for (var i = 0; i < rows.length; i++) {
            ranges.push(new Slick.Range(rows[i], 0, rows[i], lastCell));
        }
        return ranges;
    }

    function getRowsRange(from, to) {
        var i,
            rows = [];
        for (i = from; i <= to; i++) {
            rows.push(i);
        }
        for (i = to; i < from; i++) {
            rows.push(i);
        }
        return rows;
    }

    function getSelectedRows() {
        return rangesToRows(_ranges);
    }

    function setSelectedRows(rows) {
        setSelectedRanges(rowsToRanges(rows));
    }

    function setSelectedRanges(ranges) {
        _ranges = ranges;
        _self.onSelectedRangesChanged.notify(_ranges);
    }

    function clearSelection() {
        if (getSelectedRows().length > 0) {
            options.contextMenuSelector && (0, _jquery2.default)(options.contextMenuSelector).hide();
            onSelectEnd.next();
        }

        _grid && _grid.setSelectedRows([]);
        selected = {};

        updateSelection();
    }

    function getSelectedRanges() {
        return _ranges;
    }

    function getItemKey(item) {
        // Create a unique key for the item based on the grid's key fields.
        return keyFields.map(function (field) {
            return item[field];
        }).join("|");
    }

    function extractItemKeys(item) {
        return keyFields.reduce(function (keys, field) {
            keys[field] = item[field];
            return keys;
        }, {});
    }

    function updateSelection() {
        var sel = [],
            selKeys = [];

        for (var selectedItemKey in selected) {
            sel.push(selected[selectedItemKey]);
            selKeys.push(extractItemKeys(selected[selectedItemKey]));
        }

        // Update the selection observable:
        selection(sel);
        selectionKeys(selKeys);
    }

    var previousSelection = [];

    //Set the selected rows and store the keys
    function selectRows(callback) {
        if (_grid === undefined) return;

        var its = viewModel.items(),
            selRows = [],
            selectedKeys = Object.keys(selected);

        selectedKeys.forEach(function (selectedItemKey) {
            // Update selected if found in current grid:
            var selectedItem = its.reduce(function (foundItem, gridItem) {
                return getItemKey(gridItem) === selectedItemKey ? gridItem : foundItem;
            }, undefined);

            //Store the selected item
            if (selectedItem != null) {
                selRows.push(selectedItem.index);
                selected[selectedItemKey] = selectedItem;
            }
        });

        _grid.setSelectedRows(selRows);

        if (selectedKeys.length === 0) {
            clearSelection();
        } else {
            highlightSelected({
                rows: selRows,
                grid: _grid
            });
        }

        //Trigger any callback async
        if (callback) setTimeout(function () {
            callback();
        });
    }

    function handleStyleChanged(event, gridObj) {
        if (gridObj.prevHash != null && gridObj.hash != null) {
            var prevSelArray = Object.keys(gridObj.prevHash);
            var currSelArray = Object.keys(gridObj.hash);

            var isSameSelection = prevSelArray.length === currSelArray.length && prevSelArray.every(function (elem, index) {
                return elem === currSelArray[index];
            });

            if (!isSameSelection) {
                gridObj.grid.removeCellCssStyles("state2");
            }
        }
    }

    function highlightSelected(gridObj) {
        if (gridObj.rows.length > 0) {
            var rows = gridObj.rows.sort();
            var isSameSelection = previousSelection.length === rows.length && rows.every(function (elem, index) {
                return elem === previousSelection[index];
            });

            if (!isSameSelection) {
                var hash = {};
                for (var j = 0; j < rows.length; j++) {
                    var innerHash = {};

                    var columns = gridObj.grid.getColumns();
                    for (var i = 0; i < columns.length; i++) {
                        var node = gridObj.grid.getCellNode(rows[j], i);
                        if (node) {
                            var parentClassList = node.parentNode.classList;
                            var rowState = parentClassList[parentClassList.length - 1] === "active" ? parentClassList[parentClassList.length - 2] : parentClassList[parentClassList.length - 1];
                            innerHash[columns[i].id] = rowState;
                        }
                    }

                    hash[rows[j]] = innerHash;
                }

                gridObj.grid.setCellCssStyles("state2", hash);
            }
            previousSelection = gridObj.rows.sort();
        }
    }

    //Copy the selected row objects text to the clipboard
    function selectedToClipboard() {
        if (_grid === undefined) return;

        var selectionText = '';
        var selectedKeys = Object.keys(selected);
        selectedKeys.forEach(function (selectedItemKey) {
            //Get the aggregate of the selected rows
            var selectedItem = selected[selectedItemKey];
            var cols = columns();

            selectionText += cols.map(function (column, cellIndex) {
                var value = selectedItem[column.field],
                    formatter = column.formatter;

                if (formatter === undefined) {
                    return value;
                } else {
                    // If the column has a formatter, call it to get the same text as shown on the grid.
                    // A hidden element is created to grab ONLY the text of the result from the formatter (in case the formatter creates elements).
                    var el = document.createElement("div");
                    el.innerHTML = formatter(selectedItem.index, cellIndex, value, column, selectedItem);

                    // Get only the visible text from the formatter's output - remove any extra spaces or carriage returns
                    return el.innerText.trim();
                }
            }).join("\t") + '\r\n';
        });

        fin.desktop.System.setClipboard(selectionText);
    }

    //Call the grid to commit any edits to the current cell
    function commitCellEdit(continueEditStatus) {
        //Make sure something is being edited to avoid a false positive
        if (_grid == null || _grid.getCellEditor() == null) return;

        //Commits edit otherwise it is lost on blur
        _grid.getEditController().commitCurrentEdit();
        var rowObject = _grid.getData().getItem(editorCurrentRow());

        //Force the VM cell change event if present
        var e = _jquery2.default.extend(true, {}, _grid.getActiveCell());
        e.grid = _grid;
        e.item = rowObject;
        e.cell = editorCurrentCell();
        handleCellChange(null, e, continueEditStatus);

        //Set the edited cell:
        lastEditedCell(_grid.getColumns()[e.cell].id);

        editValue(rowObject == null ? "" : rowObject);
    }

    function handleActiveCellChange(e, data) {
        selectRows();
    }

    //Handles keys: left/up/right/down (37/38/39/40), tab (9), escape (27), ctrl+c (67), enter (13), end (35), home (36)
    function handleKeyDown(evt, data) {

        if (!evt.altKey && !evt.metaKey && (evt.which === 37 || evt.which === 38 || evt.which === 39 || evt.which === 40 || evt.which === 9)) {
            //LEFT/UP/RIGHT/DOWN/TAB keys
            var cell = _grid.getActiveCell();
            if (cell == null) return false;

            //Change the cell position based on the key code
            if (evt.which === 37 || evt.which === 9 && evt.shiftKey) {
                if (cell.cell <= 0) {
                    data.cell = columns().length - 1;
                    data.row = cell.row <= 0 ? _grid.getDataLength() - 1 : cell.row - 1;
                } else {
                    data.cell = cell.cell - 1;
                }
            } else if (evt.which === 38) {
                data.row = cell.row <= 0 ? _grid.getDataLength() - 1 : cell.row - 1;
            } else if (evt.which === 39 || evt.which === 9 && !evt.shiftKey) {
                if (cell.cell >= columns().length - 1) {
                    data.cell = 0;
                    data.row = cell.row >= _grid.getDataLength() - 1 ? 0 : cell.row + 1;
                } else {
                    data.cell = cell.cell + 1;
                }
            } else if (evt.which === 40) {
                data.row = cell.row >= _grid.getDataLength() - 1 ? 0 : cell.row + 1;
            }

            //Use the click handler for consistency
            evt.isFromKeyEvent = true;
            handleClick(evt, data);
            return false;
        } else if (evt.which === 35) {
            //END key
            data.cell = columns().length - 1;
            if (evt.ctrlKey) data.row = _grid.getDataLength() - 1;

            //Use the click handler for consistency
            evt.isFromKeyEvent = true;
            handleClick(evt, data);
            return false;
        } else if (evt.which === 36) {
            //HOME key
            data.cell = 0;
            if (evt.ctrlKey) data.row = 0;

            //Use the click handler for consistency
            evt.isFromKeyEvent = true;
            handleClick(evt, data);
            return false;
        } else if (evt.which === 27) {
            //ESCAPE key
            if (editStatus()) {
                editStatus(false);
            } else {
                options.contextMenuSelector && (0, _jquery2.default)(options.contextMenuSelector).hide();
                clearSelection();
                viewModel.unlockGrid();
            }
        } else if (evt.ctrlKey && evt.which === 67 && !editStatus()) {
            //CTRL+C key - allow it it pass through if in edit mode`    `   `                                   
            options.contextMenuSelector && (0, _jquery2.default)(options.contextMenuSelector).hide();
            selectedToClipboard();
        } else if (evt.which === 13 && editStatus()) {
            //ENTER key and in edit mode - continue with edit mode since the active cell has not changed
            commitCellEdit(true);
            evt.stopImmediatePropagation();
        }

        //Get a reference of the grid back to the calling method
        evt.grid = _grid;
        options.onKeyDown && options.onKeyDown(evt);

        return true;
    }

    //Override the native grid left-click handler to select row and deal with editable cells
    function handleClick(evt, data) {
        //-------------------------------------
        //Store the row key based on the event arguments
        if (evt.isFromKeyEvent === true) var cell = { cell: data.cell, row: data.row };else cell = _grid.getCellFromEvent(evt);

        // Check if selectedItem exists (in virtual window), else don't add to selected:
        var selectedItem = _grid.getDataItem(cell.row),
            selectedItemKey;

        if (selectedItem !== undefined) {
            selectedItemKey = getItemKey(selectedItem);

            if (evt.ctrlKey && !evt.isFromKeyEvent) {
                // Ctrl click
                if (selected[selectedItemKey] === undefined) selected[selectedItemKey] = selectedItem;else if (!evt.isFromContextMenuEvent) delete selected[selectedItemKey];
            } else if ((Object.keys(selected).length === 0 || (evt.isFromKeyEvent || !evt.shiftKey) && !evt.altKey && !evt.metaKey) && !(!evt.ctrlKey && evt.isFromContextMenuEvent && selected[selectedItemKey] != null)) {
                // First or regular click AND not from a right-click on a SELECTED row
                selected = {};
                selected[selectedItemKey] = selectedItem;
                onSelectStart.next();
            }

            //Save cell if currently in edit mode and keep the status until it is determined the new cell is not editable
            editStatus() && commitCellEdit(true);
            updateSelection();
            onSelect.next();
        }

        //-------------------------------------
        //Set the NEW cell in the grid and preserve the data
        _grid.setActiveCell(cell.row, cell.cell);
        lastItemSelected(selectedItem);

        //If this is an editable cell reselect the row and enter edit mode
        if (!columns()[cell.cell].hasOwnProperty("editor")) {
            editStatus(false);
            selectRows();
        } else {
            editStatus(true);
            editorCurrentRow(cell.row);
            editorCurrentCell(cell.cell);

            //Suppress the enter key if using the keyboard so it does not loose focus of the row
            var cellNode = _grid.getCellNode(cell.row, cell.cell);
            cellNode.removeEventListener("keydown", stopCellEnterKey);
            cellNode.addEventListener("keydown", stopCellEnterKey);

            //Make sure the row is selected
            selectRows(function () {
                _grid.editActiveCell();
            });
        };

        function stopCellEnterKey(event) {
            if (event.which === 13) {
                event.stopPropagation();
            }
        };

        if (contextWindow != null) hideContextWindow();

        //Call any onclick handlers
        if (options.onClick) {
            //Set the calling cell incase the click event cannot be associated with the grid - grid was clicked on while in a combobox
            evt.cell = cell;
            evt.grid = _grid;
            options.onClick.call(_grid, evt);
        }

        //Stop any propagation but the grid handlers
        if (evt.stopImmediatePropagation != null) evt.stopImmediatePropagation();
        _grid.focus();

        return false;
    }

    //Override the native grid right-click handler to select row and show context menu
    function handleContextMenu(evt) {
        //Set the cell using the click handler
        var cell = _grid.getCellFromEvent(evt);
        var data = { cell: cell.cell, row: cell.row };

        //Prevent unselecting of a row with a right-click
        evt.isFromContextMenuEvent = true;
        handleClick(evt, data);

        //Show the right-click menu if present and there are no modifier keys
        if (contextWindow && !(evt.shiftKey || evt.altKey || evt.metaKey)) {

            //Make sure the contextWindow clears - do it on the capture phase of the event
            document.body.addEventListener('mousedown', hideContextWindow, true);

            $contextMenu.data("row", cell.row);

            // contextMenu css class is hidden by default
            $contextMenu.show();
            contextWindow.showAt(window.screenLeft + evt.pageX, window.screenTop + evt.pageY, false);
            contextWindow.bringToFront();
            contextWindow.focus();

            if (options.onContextMenu) options.onContextMenu.call(_grid, evt);
        }

        evt.stopImmediatePropagation();
        evt.preventDefault();

        return false;
    }

    //If in edit mode, when user hits enter key this is called, updates  editValue to current edited row
    function handleCellChange(evt, data, continueEditStatus) {
        //Call any event passed in and send it the data collection for the cell
        options.onCellChange && options.onCellChange(data);

        //Clear any possible edits - assume ending edit status unless a value was passed in
        editStatus(continueEditStatus == null ? false : continueEditStatus);
        _grid.resetActiveCell();
    }

    //Causes the grid to refresh by triggering the onViewportChanged event
    function repaintGrid() {
        if (_grid != null) {
            _grid.onViewportChanged.notify({ grid: _grid }, new Slick.EventData(), _grid);
        }
    }

    //Flash the currently selected row when user clicks on bid or ask column in watchList
    function flashSelectedRow() {
        flashTimeouts.forEach(function (t) {
            clearTimeout(t);
        });

        var rows = getSelectedRows();
        var cell = _grid.getActiveCell();

        viewModel.pauseConnectionStream();

        flashTimeouts.push(setTimeout(_grid.flashCell(cell.row, cell.cell), 0));

        var interval = 100;
        for (var i = 0; i < 7; i++) {
            flashTimeouts.push(setTimeout(function () {
                setSelectedRows([]);
            }, i * interval));
            flashTimeouts.push(setTimeout(function () {
                setSelectedRows(rows);
            }, (i + 1) * interval));
        }

        flashTimeouts.push(setTimeout(function () {
            viewModel.unpauseConnectionStream();
        }, (i + 5) * interval));
    }

    function getGrid() {
        return _grid;
    }

    function getColumns() {
        return columns();
    }

    _jquery2.default.extend(this, {
        "getGrid": getGrid,
        "getViewModelColumns": getColumns,
        "getSelectedRows": getSelectedRows,
        "setSelectedRows": setSelectedRows,

        "getSelectedRanges": getSelectedRanges,
        "setSelectedRanges": setSelectedRanges,

        "init": init,
        "destroy": destroy,

        "onSelectedRangesChanged": new Slick.Event(),

        "clearSelection": clearSelection,

        "onSelectStart": onSelectStart,
        "onSelect": onSelect,
        "onSelectEnd": onSelectEnd,

        "editStatus": editStatus,
        "editValue": editValue,
        "lastEditedCell": lastEditedCell,

        "selection": selection,
        "selectionKeys": selectionKeys,
        "lastItemSelected": lastItemSelected,

        "commitCellEdit": commitCellEdit,

        "hideContextWindow": hideContextWindow,
        "repaintGrid": repaintGrid,
        "flashSelectedRow": flashSelectedRow
    });
};

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _knockout = require('knockout');

var _knockout2 = _interopRequireDefault(_knockout);

var _Rx = require('rxjs/Rx');

var _Rx2 = _interopRequireDefault(_Rx);

require('./linq.wrapper.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

'use strict';
var //imports
observable = _knockout2.default.observable,
    observableArray = _knockout2.default.observableArray,
    Subject = _Rx2.default.Subject;

;