'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getTimeFormatter = exports.areDefaultsShown = exports.selectedTimeType = exports.watchListDefaultColumnNames = exports.subscribeToSymbolType = exports.selectedSymbolType = exports.timeTypes = exports.symbolTypes = undefined;

var _knockout = require('knockout');

var _knockout2 = _interopRequireDefault(_knockout);

var _formatters = require('./formatters');

var _coreFunctions = require('./coreFunctions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var selectedSymbolType = _knockout2.default.observable("ric"),
    areDefaultsShown = _knockout2.default.observable(false),
    types = {
    bbg: ["bbg", "orderBbg"],
    ric: ["ric", "orderRic"]
},
    allTypes = ["bbg", "ric", "orderBbg", "orderRic"],
    watchListDefaultColumnNames = ['defaultAccount', 'defaultOrderType', 'defaultCentsOrBps', 'defaultLimitAway', 'defaultGateway', 'defaultVenue', 'defaultQty', 'defaultTif', 'defaultAlgo'],
    symbolTypes = _knockout2.default.observableArray(["ric", "bbg"]),
    selectedTimeType = _knockout2.default.observable("Local"),
    timeTypes = ["Local", "UTC"],
    timeFunctions = [_formatters.timeUTCFormatter, _formatters.timeLocalFormatter],
    timeFormatters = {
    UTC: _formatters.timeUTCFormatter,
    Local: _formatters.timeLocalFormatter
};

function getTimeFormatter() {
    return timeFormatters[selectedTimeType()];
}

function subscribeToSymbolType(columns) {
    var originalColumns = columns().map(_coreFunctions.clone),
        columnSub,
        startIndex;

    //columns().some(function (c, i) {
    //    startIndex = i;
    //    return allTypes.indexOf(c.id) > -1; //loops exits when the first match occurs between the columns and the array of types, sets startIndex = index of one of the types
    //});

    return _knockout2.default.computed(function () {
        var type = selectedSymbolType(),
            timeType = selectedTimeType(),
            currentColumns = columns.peek(),
            //current columns displayed when type or timeType is changed
        newColumns,
            newColumn;

        currentColumns.some(function (c, i) {
            startIndex = i;
            return allTypes.indexOf(c.id) > -1; //loops exits when the first match occurs between the columns and the array of types, sets startIndex = index of one of the types
        });

        newColumns = currentColumns.filter(function (c) {
            return allTypes.indexOf(c.id) === -1;
        }); //newColumns is array of all columns except "ric" and "bbg"
        newColumn = originalColumns.filter(function (c) {
            return types[type].indexOf(c.id) >= 0;
        }); //grabs column object from original columns array that matches the selected type

        if (newColumn.length > 0) {
            newColumns.splice(startIndex, 0, newColumn[0]); //adds the newColumn (whichever has been selected) back into newColumns
            if (timeType != null) {
                newColumns.forEach(function (c) {
                    if (timeFunctions.indexOf(c.formatter) >= 0) {
                        c.formatter = timeFormatters[timeType];
                    }
                });
            }
            columns(newColumns);
        }
    });
}

selectedTimeType.subscribe(function (timeType) {
    console.debug("New Time Type:", timeType);
});

exports.symbolTypes = symbolTypes;
exports.timeTypes = timeTypes;
exports.selectedSymbolType = selectedSymbolType;
exports.subscribeToSymbolType = subscribeToSymbolType;
exports.watchListDefaultColumnNames = watchListDefaultColumnNames;
exports.selectedTimeType = selectedTimeType;
exports.areDefaultsShown = areDefaultsShown;
exports.getTimeFormatter = getTimeFormatter;