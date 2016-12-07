import { has } from './coreFunctions';


function defaultFormatter(row, cell, value, columnDef, dataContext) {
    return value == null ? "" : ("" + value);
}

function repeat(str, times) {
    var res = '';
    while (times > 0) {
        if ((times & 1) === 1) res += str;
        str += str;
        times >>= 1;
    }
    return res;
}

// ~ 1000x faster than native solution:
function formatNumber(number, minDigits, maxDigits, allowQualifiers) {
    //Check of k and m qualifiers
    if (allowQualifiers) {
        var proposed = number.toString().toLowerCase().replace(/,/gi, '').trim();

        if (proposed.indexOf('k', proposed.length - 1) !== -1)
            number = Number(proposed.substring(0, proposed.length - 1)) * 1000;
        else if (proposed.indexOf('m', proposed.length - 1) !== -1)
            number = Number(proposed.substring(0, proposed.length - 1)) * 1000000;
        else
            number = Number(proposed);
    }

    var sign = (number < 0);
    number = Math.abs(number);

    // We don't use bitwise to truncate to a integer, so we can support large numbers:
    var integer = Math.floor(number),
        // Fraction is scaled to maxDigits:
        fractionBase = Math.round((number - integer) * Math.pow(10, maxDigits)),
        str = '';

    if (isNaN(integer) || isNaN(fractionBase)) return NaN;

    // Add fraction part:
    if (minDigits > 0) {
        if (fractionBase > 0) {
            var digit = maxDigits;
            while (digit > minDigits && (fractionBase % 10) === 0) {
                fractionBase *= 0.1;
                digit -= 1;
            }
            str = fractionBase + '';
            str = "." + repeat('0', digit - str.length) + str;
        } else {
            str = "." + repeat('0', minDigits);
        }
    }

    // Loop through integer:
    var part;
    if (integer === 0) {
        str = '0' + str;
    } else {
        do {
            part = integer % 1000;
            integer = Math.floor(integer * 0.001);
            if (integer != 0) {
                // If we still have more digits after this section, pad this part:
                // We don't use repeat() because hardcoding the conversions below are MUCH faster:
                if (part === 0) part = '000';
                else if (part < 10) part = '00' + part;
                else if (part < 100) part = '0' + part;
                str = "," + part + str;
            } else {
                str = part + str;
            }
        } while (integer !== 0)
    }

    if (sign) str = '-' + str;

    return str;
}

function priceFormatter(row, cell, value, columnDef, dataContext) {
    return has(value) ? formatNumber(+value, 2, 5, true) : '';//(+value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 });
}

function timeFormatter(row, cell, value, columnDef, dataContext) {
    return has(value) ? date.toString(value, 'yyyy-MM-dd HH:mm:ss.fff') : '';
}

function timeLocalFormatter(row, cell, value, columnDef, dataContext) {
    //return has(value) ? value.substr(0, 10) + ' ' + value.substr(11, 12) : ''; // Faster
    return (has(value) && value != "") ? date.toString(value, 'yyyy-MM-dd HH:mm:ss.fff') : '';
}

function timeUTCFormatter(row, cell, value, columnDef, dataContext) {
    return (has(value) && value != "") ? value.substr(0, 10) + ' ' + value.substr(11, 12) : ''; // Faster
    //return has(value) ? XDate(value).toUTCString('yyyy-MM-dd HH:mm:ss.fff') : '';
}

function isBoolFormatter(row, cell, value, columnDef, dataContext) {
    return has(value) ? (value ? 'YES' : 'NO') : 'NO';
}

function isYesNoFormatter(row, cell, value, columnDef, dataContext) {
    return has(value) ? (value.toLowerCase() === "yes" ? 'YES' : 'NO') : 'NO';
}

function buySellFormatter(row, cell, value, columnDef, dataContext) {
    var css;
    if (value) {
        //old formatting with arrows next to buy or sell text
        //css = value.toUpperCase() === 'BUY' ? 'iconBuy' : 'iconSell';
        //return '<div class="color: ' + css + '">' + value + '</div>';

        //new formatting, no arrows, green/red background with white font
        side = value.toUpperCase() === 'BUY' ? 'buy-side-cell' : 'sell-side-cell';
        return '<div class="' + side + '">' + value + '</div>';
    }

    return '';
}

function buySellMiniFormatter(row, cell, value, columnDef, dataContext) {
    var css;
    if (value) {
        //new formatting, no arrows, green/red background with white font
        side = value.toUpperCase()[0] === 'B' ? 'buy-side-cell' : 'sell-side-cell';
        return '<div class="' + side + '">' + value + '</div>';
    }

    return '';
}

function progressBarFormatter(row, cell, value, columnDef, dataContext) {
    if (value) {
        var filledQty = value,
            totalQty = dataContext.qty,
            fullHeightBar = "height: 100%;",
            shortBar = "position: absolute;bottom: 0%;height: 30%;",
            barStyle = fullHeightBar,
            percentComplete,
            color;

        percentComplete = totalQty === 0 ? 100 : Math.round((filledQty / totalQty) * 100);
        value = has(value) ? formatNumber(value, 0, 0) : '';
        
        if (dataContext.state === "CANCELLED") {
            color = percentComplete === 100 ? "progress-bar-cancelled-done" : "progress-bar-cancelled-remaining";
        } else {
            color = percentComplete === 100 ? "progress-bar-done" : "progress-bar-remaining";
        }

        return '<span style="position:absolute;right:0%;padding-right:2px;">' + value + '</span>\n\
        <div style="' + barStyle + 'width: ' + percentComplete + '%;" div class="' + color + '"></div>';
    } else {
        return has(value) ? formatNumber(value, 2, 2) : '';
        //return has(value) ? text.numberFormat(value, 0, '.', ',') : '';;
    }
}

function algoFormatter(row, cell, value, columnDef, dataContext) {
    var algo = '';
    if (value == null || value === '')
        return algo;

    //Parse the algo
    try {
        var algoObj = JSON.parse(value);
    } catch (e) {
        return value;
    }

    //Should only be one gateway
    var gatewayname = Object.keys(algoObj).firstOrDefault();
    if (gatewayname != null)
        //should only be one algo
        algo = Object.keys(algoObj[gatewayname]).firstOrDefault();

    return algo;
}


//jslint unparam:true
function moneyFormatter(row, cell, value, columnDef, dataContext) {
    if (has(value)) {
        if (Math.abs(value) >= 1000000) {
            // Convert from 1234567 to 1.23mm:
            return formatNumber(Math.round(value / 10000) / 100, 2, 2) + 'mm';
            //return text.numberFormat(Math.round(value / 10000) / 100, 2, '.', ',') + 'mm';
        } else {
            // Convert from 1234 to 1.23km:
            return formatNumber(Math.round(value / 10) / 100, 2, 2) + 'k';
            //return text.numberFormat(Math.round(value / 10) / 100, 2, '.', ',') + 'k';
        }
    } else {
        return '';
    }
}

function moneyFormatterMM(row, cell, value, columnDef, dataContext) {
    if (has(value)) {
        // Convert from 1234567 to 1.23mm:
        return formatNumber(Math.round(value / 10000) / 100, 2, 2) + 'mm';
        //return text.numberFormat(Math.round(value / 10000) / 100, 2, '.', ',') + 'mm';
    } else {
        return '';
    }
}

function moneyFormatterK(row, cell, value, columnDef, dataContext) {
    if (has(value)) {
        // Convert from 1234 to 1.23km:
        return formatNumber(Math.round(value / 10) / 100, 2, 2) + 'k';
        //return text.numberFormat(Math.round(value / 10) / 100, 2, '.', ',') + 'k';
    } else {
        return '';
    }
}
//jslint unparam:false

function testFormatter(row, cell, value, columnDef, dataContext) {
    return '<div data-class="order-popup" style="background:yellow;">'+ value + '</div>'
}

function mdQualityFormatter(row, cell, value, columnDef, dataContext) {
    if (value == null) {
        value = "";
    }

    //Configure the class for the potential wrapper div
    var cssCell = "";

    //Real-time or delayed flag
    if (dataContext.mdQuality != "REALTIME")
        cssCell += "slick-cell-delayed";

    //Stale warning indicator - has to be present and true
    if (dataContext.hasOwnProperty("staleWarning") && (dataContext.staleWarning === true || dataContext.staleWarning === "true")) {
        if (cssCell.length === 0)
            cssCell = "slick-cell-stale";
        else
            cssCell += " stale";
    }

    //If there is a class a div is needed
    if (cssCell.length > 0)
        return '<div class="' + cssCell + '">' + value + '</div>';
    else
        return value;
}

function dropDownFormatter(row, cell, value, columnDef, dataContext) {
    return '<div class="validationFields">' + value + '</div>';
}

function quantityFormatter(row, cell, value, columnDef, dataContext) {
    if (value == null || value == "") return "";
    return has(value) ? formatNumber(value, 0, 0, true) : '';
    //return has(value) ? text.numberFormat(value, 0, '.', ',') : '';
}

function accountFormatter(row, cell, value, columnDef, dataContext) {
    var text;

    if (value == null || value == "" || value.Account === "") {
        text = "";
    } else if (value.IsConnected) {
        text = value.traderName + ", " + value.strategyName;
    } else {
        text = value.traderName + ", " + value.strategyName + ' (disconnected)';
    }

    return text;
}

//Coverts a string containing K (thousands), M (millions) and commas as a qualifier to its numeric equivalent.
//Avoids the use of numeric multiplication due to floating point rounding errors that can be introduced.
function convertQualifiedNumber(numString) {

    if (numString == null)
        return numString;

    //Cleanup the string of commas
    var proposed = numString.toString().toLowerCase().replace(/,/gi, '').trim();

    //Look for thousands or millions - only only be one letter but just in case take the max
    var idx = Math.max(proposed.lastIndexOf('k', proposed.length - 1), proposed.lastIndexOf('m', proposed.length - 1));
    if (idx > -1) {

        //Determine the multiplication factor and remove the qualifier
        var numdec = proposed.substring(idx, idx + 1) === 'k' ? 3 : 6;
        proposed = proposed.substring(0, proposed.length - 1);

        //Convert to integer string and store the decimals
        idx = proposed.indexOf('.');
        if (idx > -1) {
            numdec -= proposed.length - 1 - idx;
            proposed = proposed.replace('.', '');
        }

        //Convert to number
        if (numdec > 0)
            proposed = proposed + new Array(numdec + 1).join('0');
        else if (numdec < 0)
            proposed = proposed.substring(0, proposed.length - 2 - numdec) + '.' + proposed.substring(proposed.length - 2 - numdec);
    };

    //Return the converted result
    return Number(proposed);
}

export {
    defaultFormatter,
    priceFormatter,
    timeFormatter,
    timeLocalFormatter,
    timeUTCFormatter,
    isBoolFormatter,
    isYesNoFormatter,
    moneyFormatter,
    moneyFormatterK,
    moneyFormatterMM,
    buySellFormatter,
    progressBarFormatter,
    mdQualityFormatter,
    dropDownFormatter,
    testFormatter,
    quantityFormatter,
    buySellMiniFormatter,
    accountFormatter,
    convertQualifiedNumber,
    algoFormatter
};

