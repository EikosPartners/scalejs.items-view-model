'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (config, createServerConnection) {
    var // imports
    observable = _knockout2.default.observable,
        observableArray = _knockout2.default.observableArray,

    //Subject = rx.Subject,     //not in use
    isObservable = _knockout2.default.isObservable,
        computed = _knockout2.default.computed,
        merge = coreFuncs.merge,

    //clone = coreFuncs.clone,      //not in use
    Observable = _Rx2.default.Observable,
        containerId = config.containerId,
        columns = config.columns,
        keyFields = config.keyFields,
        selectionOptions = config.selectionOptions,
        defaultSorting = config.defaultSorting,
        filterInputThrottle = config.filterInputThrottle,
        viewportThrottle = config.viewportThrottle,


    // emsblotter
    serverConnection = createServerConnection(containerId),
        //calls the function createView from createViewFactory

    // vars
    selectedItem = observableArray([]),
        items = observableArray([]),
        viewCount = observable(0),
        viewport = observable({ top: 0, bottom: 10 }),
        sorting = observable(defaultSorting),
        top = 0,

    //queryId,
    currentFilters = [],
        sub = [],
        messageHandlers = {},
        eventHandlers = {},
        currentQuery = observable(),

    // Selection Model:
    viewModel,
        clearGridLockTimeout;

    // Apply defaults for each column:
    columns().forEach(function (column) {
        if (column.formatter == null) {
            column.formatter = _formatters.defaultFormatter;
        }
    });

    // observables

    var cols = columns().filter(function (column) {
        return column.filter;
    }),
        lastFiltersJson,
        filtersObservable = computed(function () {
        var filters = [];

        for (var i = 0; i < cols.length; i += 1) {
            var filterValue = cols[i].filter.value();

            if (filterValue != null) {
                for (var j = 0; j < filterValue.length; j += 1) {
                    var f = {
                        column: cols[i].field,
                        op: filterValue[j].op,
                        values: filterValue[j].values
                    };

                    if (filterValue[j].tag != null) f.tag = filterValue[j].tag;

                    if (filterValue[j].logicOperator != null) f.logicOperator = filterValue[j].logicOperator;

                    filters.push(f);
                }
            }
        }

        // Reset View:
        var json = JSON.stringify(filters);
        if (lastFiltersJson !== json) {
            var count = viewCount();
            viewCount(0);
            viewCount(count);
        }

        lastFiltersJson = json;
        return filters;
    });

    var viewportObservable = computed(function () {
        var vp = viewport(),
            size = vp.bottom - vp.top;

        return {
            start: Math.max(0, vp.top - size),
            size: 3 * size
        };
    });

    var userObservable = computed(function () {
        var vp = viewportObservable();

        return {
            start: vp.start,
            size: vp.size,
            filters: filtersObservable(),
            sort: sorting()
        };
    }).extend({ throttle: viewportThrottle });

    // subscriptions

    function subscribeToUser() {
        function _query(window) {
            var query = {
                containerId: containerId,
                start: window.start,
                count: window.size,
                filters: window.filters,
                sort: window.sort
            };

            triggerEvent(eventHandlers["onBeforeQuery"], query);
            currentQuery(query);
            serverConnection.query(currentQuery());
            triggerEvent(eventHandlers["onQuery"]);
        }
        _query(userObservable());
        return userObservable.subscribe(_query);
    }

    function subscribeToWindowItems() {
        return serverConnection.windowBus.subscribe(function (response) {
            // Ignore responses to a previous request
            //if (response.requestId !== serverConnection.requestId) return; // Handled in createViewFactory

            response.start = Math.max(response.args[0].start || 0, 0);

            //index corresponds to row id #
            response.list.forEach(function (item, index) {
                item.index = response.start + index;
            });

            triggerEvent(eventHandlers["onWindow"], response.list);

            viewCount(response.args[0].filteredCount || 0);
            items(response.list); //sends data to slick grid
        });
    }

    function subscribeToQuickSearchInput() {
        return Observable.fromArray(columns().filter(function (column) {
            return column.filter && column.filter.quickSearch;
        })).selectMany(function (column) {
            return Observable.fromKoObservable(column.filter.quickSearch).where(function (quickSearchValue) {
                return quickSearchValue !== undefined;
            }).select(function (quickSearchExpression) {
                return merge({ column: column.field }, quickSearchExpression);
            });
        }).throttle(filterInputThrottle).subscribe(function (quickSearchExpression) {
            // Temporary workaround until a better quickSearch method is used to query the backend:
            var values = serverConnection.quickSearch(quickSearchExpression);

            columns().first(function (column) {
                return column.field === quickSearchExpression.column;
            }).filter.values(values);
        });
    }

    // disposal
    function dispose() {
        // accounts is defined by orders which relies on the accountsObservable in the model
        // when the blotter is disposed, accounts must also be disposed
        // also any manual subscriptions must be disposed
        sub.forEach(function (s) {
            s.dispose();
        });
        serverConnection.dispose();
        items.removeAll();
        filtersObservable.dispose();
        viewportObservable.dispose();
        userObservable.dispose();
    }

    // keep track of all subscriptions for disposal
    sub.concat([subscribeToUser(), subscribeToWindowItems(), (0, _symbols.subscribeToSymbolType)(columns)]);

    // if (serverConnection.quickSearch !== undefined) {
    //    sub.push(subscribeToQuickSearchInput());
    // }

    function registerMessageHandler(jsonType, handler) {
        messageHandlers[jsonType] = messageHandlers[jsonType] || [];
        messageHandlers[jsonType].push(handler);
    }

    function registerEventHandler(eventName, handler) {
        eventHandlers[eventName] = eventHandlers[eventName] || [];
        eventHandlers[eventName].push(handler);
    }

    function triggerEvent(handlers, message) {
        if (handlers !== undefined) {
            handlers.forEach(function (handler) {
                handler(message);
            });
        }
    }

    sub.push(serverConnection.messageBus.subscribe(function (message) {
        if (messageHandlers[message.jsonType] === undefined) {
            console.warn("[WARN] Unknown message received:", message);
        } else {
            triggerEvent(messageHandlers[message.jsonType], message);
        }
    }));

    viewModel = {
        id: containerId,
        selectedItem: selectedItem,
        items: items,
        viewCount: viewCount,
        viewport: viewport,
        sorting: sorting,
        top: top,
        key: keyFields,
        //queryId: queryId,
        columns: columns,
        dispose: dispose,
        currentQuery: currentQuery,
        serverConnection: serverConnection,
        registerMessageHandler: registerMessageHandler,
        registerEventHandler: registerEventHandler
    };

    viewModel.selectionModel = new _virtualSelectionModel2.default(merge({
        viewModel: viewModel
    }, selectionOptions));

    viewModel.unlockGrid = function (vm) {
        clearTimeout(clearGridLockTimeout);

        //If this was called directly and not via setTimeout
        if (vm == null) vm = this;

        vm.selectionModel.hideContextWindow();
        vm.serverConnection.query(vm.currentQuery());
        triggerEvent(eventHandlers["onQuery"]);
    };

    //Un-pause the stream coming for the server connection
    viewModel.pauseConnectionStream = function () {
        serverConnection.paused = true;
    };

    //Pause the stream coming for the server connection
    viewModel.unpauseConnectionStream = function () {
        serverConnection.paused = false;
    };

    sub.push(viewModel.selectionModel.onSelect.subscribe(function () {
        // Resume normal requests/responses after selection is cleared for 5 seconds.
        clearTimeout(clearGridLockTimeout);
        clearGridLockTimeout = setTimeout(viewModel.unlockGrid, 5000, viewModel);
    }));

    viewModel.serverConnection.connection.hasConnected.subscribe(function (connected) {
        if (connected) return;

        viewModel.items.removeAll();
        viewModel.viewCount(0);
        viewModel.selectionModel.repaintGrid();
    });

    return viewModel;
};

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _knockout = require('knockout');

var _knockout2 = _interopRequireDefault(_knockout);

var _Rx = require('rxjs/Rx');

var _Rx2 = _interopRequireDefault(_Rx);

var _symbols = require('./utils/symbols');

var _formatters = require('./utils/formatters');

var _coreFunctions = require('./utils/coreFunctions');

var coreFuncs = _interopRequireWildcard(_coreFunctions);

var _virtualSelectionModel = require('./utils/virtualSelectionModel');

var _virtualSelectionModel2 = _interopRequireDefault(_virtualSelectionModel);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;