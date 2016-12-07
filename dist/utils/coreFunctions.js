'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getUniquesFromArrays = exports.printStackTrace = exports.getPostData = exports.getData = exports.getJSON = exports.cloneDeep = exports.clone = exports.merge = exports.has = exports.is = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _knockout = require('knockout');

var _knockout2 = _interopRequireDefault(_knockout);

var _deepClone = require('./deepClone');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function is(value) {
    // Function: is([...,]value[,type]): boolean
    // Check the type of a value, possibly nested in sub-properties.
    //
    // The method may be called with a single argument to check that the value
    // is neither null nor undefined.
    //
    // If more than two arguments are provided, the value is considered to be
    // nested within a chain of properties starting with the first argument:
    // | is(object,'parent','child','leaf','boolean')
    // will check whether the property object.parent.child.leaf exists and is
    // a boolean.
    //
    // The intent of this method is to replace unsafe guard conditions that
    // rely on type coercion:
    // | if (object && object.parent && object.parent.child) {
    // |   // Issue: all falsy values are treated like null and undefined:
    // |   // '', 0, false...
    // | }
    // with a safer check in a single call:
    // | if ( is(object,'parent','child','number') ) {
    // |   // only null and undefined values are rejected
    // |   // and the type expected (here 'number') is explicit
    // | }
    //  
    //   ...   - any, optional, a chain of parent properties for a nested value
    //   value - any, the value to check, which may be nested in a chain made
    //           of previous arguments (see above)
    //   type - string, optional, the type expected for the value.
    //          Alternatively, a constructor function may be provided to check
    //          whether the value is an instance of given constructor.
    //
    // Returns:
    //   * false, if no argument is provided
    //   * false, if a single argument is provided which is null or undefined
    //   * true, if a single argument is provided, which is not null/undefined
    //   * if the type argument is a non-empty string, it is compared with the
    //     internal class of the value, put in lower case
    //   * if the type argument is a function, the instanceof operator is used
    //     to check if the value is considered an instance of the function
    //   * otherwise, the value is compared with the provided type using the
    //     strict equality operator ===
    //
    // Type Reference:
    //   'undefined' - undefined
    //   'null'      - null
    //   'boolean'   - false, true
    //   'number'    - -1, 0, 1, 2, 3, Math.sqrt(2), Math.E, Math.PI...
    //   'string'    - '', 'abc', "Text!?"...
    //   'array'     - [], [1,2,3], ['a',{},3]...
    //   'object'    - {}, {question:'?',answer:42}, {a:{b:{c:3}}}...
    //   'regexp'    - /abc/g, /[0-9a-z]+/i...
    //   'function'  - function(){}, Date, setTimeout...
    //
    // Notes:
    // This method retrieves the internal class of the provided value using
    // | Object.prototype.toString.call(value).slice(8, -1)
    // The class is then converted to lower case.
    //
    // See "The Class of an Object" section in the JavaScript Garden for
    // more details on the internal class:
    // http://bonsaiden.github.com/JavaScript-Garden/#types.typeof
    //
    // The internal class is only guaranteed to be the same in all browsers for
    // Core JavaScript classes defined in ECMAScript. It differs for classes
    // part of the Browser Object Model (BOM) and Document Object Model (DOM):
    // window, document, DOM nodes:
    //
    //   window        - 'Object' (IE), 'Window' (Firefox,Opera),
    //                   'global' (Chrome), 'DOMWindow' (Safari)
    //   document      - 'Object' (IE),
    //                   'HTMLDocument' (Firefox,Chrome,Safari,Opera)
    //   document.body - 'Object' (IE),
    //                   'HTMLBodyElement' (Firefox,Chrome,Safari,Opera)
    //   document.createElement('div') - 'Object' (IE)
    //                   'HTMLDivElement' (Firefox,Chrome,Safari,Opera)
    //   document.createComment('') - 'Object' (IE),
    //                   'Comment' (Firefox,Chrome,Safari,Opera)
    //
    var undef,
        // do not trust global undefined, which may be overridden
    i,
        length = arguments.length,
        last = length - 1,
        type,
        typeOfType,
        internalClass,
        v = value;

    if (length === 0) {
        return false; // no argument
    }

    if (length === 1) {
        return value !== null && value !== undef;
    }

    if (length > 2) {
        for (i = 0; i < last - 1; i += 1) {
            if (!is(v)) {
                return false;
            }
            v = v[arguments[i + 1]];
        }
    }

    type = arguments[last];
    if (v === null) {
        return type === null || type === 'null';
    }
    if (v === undef) {
        return type === undef || type === 'undefined';
    }
    if (type === '') {
        return v === type;
    }

    typeOfType = typeof type === 'undefined' ? 'undefined' : _typeof(type);
    if (typeOfType === 'string') {
        internalClass = Object.prototype.toString.call(v).slice(8, -1).toLowerCase();
        return internalClass === type;
    }

    if (typeOfType === 'function') {
        return v instanceof type;
    }

    return v === type;
}

function has(object) {
    // Function: has(obj,property[,...]): boolean
    // Check whether an obj property is present and not null nor undefined.
    //
    // A chain of nested properties may be checked by providing more than two
    // arguments.
    //
    // The intent of this method is to replace unsafe tests relying on type
    // coercion for optional arguments or obj properties:
    // | function on(event,options){
    // |   options = options || {}; // type coercion
    // |   if (!event || !event.data || !event.data.value){
    // |     // unsafe due to type coercion: all falsy values '', false, 0
    // |     // are discarded, not just null and undefined
    // |     return;
    // |   }
    // |   // ...
    // | }
    // with a safer test without type coercion:
    // | function on(event,options){
    // |   options = has(options)? options : {}; // no type coercion
    // |   if (!has(event,'data','value'){
    // |     // safe check: only null/undefined values are rejected;
    // |     return;
    // |   }
    // |   // ...
    // | }
    //
    // Parameters:
    //   obj - any, an obj or any other value
    //   property - string, the name of the property to look up
    //   ...      - string, additional property names to check in turn
    //
    // Returns:
    //   * false if no argument is provided or if the obj is null or
    //     undefined, whatever the number of arguments
    //   * true if the full chain of nested properties is found in the obj
    //     and the corresponding value is neither null nor undefined
    //   * false otherwise
    var i,
        length,
        o = object,
        property;

    if (!is(o)) {
        return false;
    }

    for (i = 1, length = arguments.length; i < length; i += 1) {
        property = arguments[i];
        o = o[property];
        if (!is(o)) {
            return false;
        }
    }
    return true;
}

function mix(receiver, supplier) {
    var p;
    for (p in supplier) {
        if (supplier.hasOwnProperty(p)) {
            if (has(supplier, p) && supplier[p].constructor === Object && has(receiver, p) && receiver[p] !== supplier[p]) {
                receiver[p] = mix(receiver[p], supplier[p]);
            } else {
                receiver[p] = supplier[p];
            }
        }
    }

    return receiver;
}

//Appears to be a shallow clone - not deep
function merge() {
    var args = arguments,
        i,
        len = args.length,
        result = {};

    for (i = 0; i < len; i += 1) {
        mix(result, args[i]);
    }

    return result;
}

//Appears to be a shallow clone - not deep
function clone(o) {
    return merge({}, o);
}

//Provides a copy of the object via a deep clone via clone.js - note that functions will remain shallow
function cloneDeep(o) {
    return (0, _deepClone.deepClone)(o, true, Infinity);
}

//Web call to get the content of the url and returns it result as an object (via JSON.parse).  Anything other then a 200 response will call the errorCallback.
function getJSON(url, errorCallback) {
    var response = _knockout2.default.observable();

    var xhr = new XMLHttpRequest();
    xhr.open('get', url, true);
    xhr.responseType = 'json';
    xhr.withCredentials = true;
    xhr.onload = function () {
        try {
            if (xhr.status === 200) {
                if (xhr.response instanceof Object) {
                    response(xhr.response);
                } else {
                    response(JSON.parse(xhr.response));
                }
            } else {
                throw "URL " + url + " returned non-200 status: " + xhr.status + ":" + xhr.statusText;
            }
        } catch (e) {
            console.error(e);

            if (errorCallback != null) errorCallback();
        }
    };

    response.xhr = xhr;
    xhr.send();

    return response;
};

//Web call to get the content of the url passed without any interpretation.  Anything other then a 200 response will call the errorCallback.
function getData(url, errorCallback) {
    var response = _knockout2.default.observable();

    var xhr = new XMLHttpRequest();
    xhr.open('get', url, true);
    xhr.withCredentials = true;
    xhr.onload = function () {
        try {
            if (xhr.status === 200) {
                response(xhr.response);
            } else {
                throw "URL " + url + " returned non-200 status: " + xhr.status + ":" + xhr.statusText;
            }
        } catch (e) {
            console.error(e);

            if (errorCallback != null) errorCallback();
        }
    };

    response.xhr = xhr;
    xhr.send();

    return response;
};

//Web call via POST to get the content of the url passed without any interpretation.  Anything other then a 200 response will call the errorCallback.
function getPostData(url, postData, errorCallback) {
    var response = _knockout2.default.observable();

    var xhr = new XMLHttpRequest();
    xhr.open('post', url, true);
    xhr.withCredentials = true;

    xhr.onload = function () {
        try {
            if (xhr.status === 200) {
                response(xhr.response);
            } else {
                throw "URL " + url + " returned non-200 status: " + xhr.status + ":" + xhr.statusText;
            }
        } catch (e) {
            console.error(e);

            if (errorCallback != null) errorCallback();
        }
    };

    //Include reference to the xhr and send the request
    response.xhr = xhr;
    xhr.send(postData);

    return response;
}

//Prints the current callstack (internally catches an error); 
//stackHeader is placed as the first line of the stack (optional)
//returnOnly suppresses dumping to console and only returns the call stack string array (optional)
function printStackTrace(stackHeader, returnOnly) {
    var callstack = [];
    var isCallstackPopulated = false;
    try {
        i.dont.exist += 0; //doesn't exist- that's the point
    } catch (e) {
        if (e.stack) {
            //Firefox
            var lines = e.stack.split('\n');
            for (var i = 0, len = lines.length; i < len; i++) {
                callstack.push(lines[i]);
            } //Remove call to printStackTrace()
            callstack.shift();
            isCallstackPopulated = true;
        } else if (window.opera && e.message) {
            //Opera
            var lines = e.message.split('\n');
            for (var i = 0, len = lines.length; i < len; i++) {
                var entry = lines[i];
                //Append next line also since it has the file info
                if (lines[i + 1]) {
                    entry += ' at ' + lines[i + 1];
                    i++;
                }
                callstack.push(entry);
            }
            //Remove call to printStackTrace()
            callstack.shift();
            isCallstackPopulated = true;
        }
    }
    if (!isCallstackPopulated) {
        //IE and Safari
        var currentFunction = arguments.callee.caller;
        while (currentFunction) {
            var fn = currentFunction.toString();
            var fname = fn.substring(fn.indexOf('function') + 8, fn.indexOf('')) || 'anonymous';
            callstack.push(fname);
            currentFunction = currentFunction.caller;
        }
    }

    //Options
    if (stackHeader != null) callstack.unshift(stackHeader);

    if (!returnOnly) console.warn(callstack.join('\n'));

    return callstack;
};

//The intention of this function is to return the unique elements of two arrays
//The arrays do not need to be the same length
//***NOTE The arrays MUST CONTAINT ONLY UNIQUE ELEMENTS IN THEIR RESPECTIVE ARRAYS**********
function getUniquesFromArrays(arrayA, arrayB) {
    var uniqueA = [],
        remainingB = arrayB.slice(0);

    for (var i = 0; i < arrayA.length; i++) {
        var isUnique = true;
        for (var j = 0; j < remainingB.length; j++) {
            if (arrayA[i] === remainingB[j]) {
                //if there's a match, remove the element from remaining so it's no longer searched
                remainingB.splice(j, 1);
                isUnique = false;
                //stop looking in remaining, start looking at next element in arrayA
                break;
            }
        }
        //if there is no match in remainingB, push element into uniqueA
        if (isUnique) {
            uniqueA.push(arrayA[i]);
        }
    }

    return uniqueA.concat(remainingB);
}

//KO extension method to allow knowledge of both old and new values to the callback
//This can sometimes result in the same value being sent especially with objects so test to make sure there is a change
//callback: closure with 'function(newValue, oldValue)' signature
//context: 'this' override (optional)
//ko.subscribable.fn.subscribeChanged = function (callback, context) {
//    var savedValue = this.peek();
//    return this.subscribe(function (latestValue) {
//        var oldValue = savedValue;
//        savedValue = latestValue;
//        callback.call(context, latestValue, oldValue);
//    });
//};

exports.is = is;
exports.has = has;
exports.merge = merge;
exports.clone = clone;
exports.cloneDeep = cloneDeep;
exports.getJSON = getJSON;
exports.getData = getData;
exports.getPostData = getPostData;
exports.printStackTrace = printStackTrace;
exports.getUniquesFromArrays = getUniquesFromArrays;