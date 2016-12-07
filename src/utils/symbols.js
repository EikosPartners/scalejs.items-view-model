import ko from 'knockout';
import { timeUTCFormatter, timeLocalFormatter } from './formatters';
import { clone } from './coreFunctions';


var selectedSymbolType = ko.observable("ric"),
    areDefaultsShown = ko.observable(false),
    types = {
        bbg: ["bbg", "orderBbg"],
        ric: ["ric", "orderRic"]
    },
    allTypes = ["bbg", "ric", "orderBbg", "orderRic"],
    watchListDefaultColumnNames = ['defaultAccount', 'defaultOrderType', 'defaultCentsOrBps', 'defaultLimitAway', 'defaultGateway', 'defaultVenue', 'defaultQty', 'defaultTif', 'defaultAlgo'],
    symbolTypes = ko.observableArray(["ric", "bbg"]),
    selectedTimeType = ko.observable("Local"),
    timeTypes = ["Local", "UTC"],
    timeFunctions = [timeUTCFormatter, timeLocalFormatter],
    timeFormatters = {
        UTC: timeUTCFormatter,
        Local: timeLocalFormatter
    };

function getTimeFormatter() {
    return timeFormatters[selectedTimeType()];
}

function subscribeToSymbolType(columns) {
    var originalColumns = columns().map(clone),
        columnSub,
        startIndex;

    //columns().some(function (c, i) {
    //    startIndex = i;
    //    return allTypes.indexOf(c.id) > -1; //loops exits when the first match occurs between the columns and the array of types, sets startIndex = index of one of the types
    //});

    return ko.computed(function () {
        var type = selectedSymbolType(),
            timeType = selectedTimeType(),
            currentColumns = columns.peek(),    //current columns displayed when type or timeType is changed
            newColumns,
            newColumn;

        currentColumns.some(function (c, i) {
            startIndex = i;
            return allTypes.indexOf(c.id) > -1; //loops exits when the first match occurs between the columns and the array of types, sets startIndex = index of one of the types
        });

        newColumns = currentColumns.filter(function (c) {
            return allTypes.indexOf(c.id) === -1;          
        });                                             //newColumns is array of all columns except "ric" and "bbg"
        newColumn = originalColumns.filter(function (c) {
            return types[type].indexOf(c.id) >= 0;
        });                                             //grabs column object from original columns array that matches the selected type

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

export {
    symbolTypes,
    timeTypes,
    selectedSymbolType,
    subscribeToSymbolType,
    watchListDefaultColumnNames,
    selectedTimeType,
    areDefaultsShown,
    getTimeFormatter
}
