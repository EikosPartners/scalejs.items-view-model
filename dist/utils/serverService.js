'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.constants = exports.baseConnection = exports.createConnection = exports.version = exports.usernameEndpoint = exports.envToken = exports.marketEndpoint = exports.csvEndpoint = exports.endpoint = exports.userThemeJson = exports.profileJson = exports.username = undefined;

var _knockout = require('knockout');

var _knockout2 = _interopRequireDefault(_knockout);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//Creates a connection for inheriting class to server based on the endpoint in app.json
var // imports
observable = _knockout2.default.observable,
    observableArray = _knockout2.default.observableArray,
    computed = _knockout2.default.computed,


//constants
PROFILEJSONNAME = "machineProfileJson",
    wsENDPOINT = 'ws://' + location.hostname + ':4081',


// vars
baseConnection,
    profileJson = observable(undefined),
    userThemeJson = observable(undefined),


//Vars based on application manifest (app.json) sent to the server
endpoint = observable(wsENDPOINT),
    csvEndpoint = observable(undefined),
    marketEndpoint = observable(undefined),
    envToken = observable(undefined),
    usernameEndpoint = observable(undefined),
    version = observable(undefined),
    url,
    urlMarketData,


//Connection settings
reconnectDelay = 10 * 1000,
    // in ms
username = observable(undefined),
    password = "ems14";

// Open a web socket
function createConnection(connectionObj, connectionEndpoint, viewId) {
    var lastTimeId,
        lastTimeIdCount = 0;
    // This function opens a new websocket, extends the websocket with certain functions, and returns the enhanced websocket connection.
    var isMarketData = connectionEndpoint === "market",
        URL = isMarketData ? urlMarketData() : url();

    if (connectionObj == null) {
        console.debug("[" + viewId + "] opening new connection!");

        connectionObj = {
            handlers: {},
            requests: {},
            buffer: [],
            loginCallbacks: [],
            loggedIn: false,
            hasConnected: observable(false),
            role: observable(-1),
            connectionEndpoint: URL,
            _reconnectTime: new Date(),
            recentlyDeletedRequests: {}
        };

        connectionObj.Request = function (jsonType, json) {
            this._request = connectionObj.addRequestHeaders(jsonType, json);
            if (connectionObj.loggedIn) {
                connectionObj.sendJSON(this._request);
            } else {
                var thisRequest = this;
                connectionObj.registerLoginCallback(function () {
                    thisRequest._request = connectionObj.addRequestHeaders(jsonType, thisRequest._request);
                    connectionObj.sendJSON(thisRequest._request);
                });
            }
            this.id = this._request.requestId;
            this._subscriptions = {};
            this._nextSubscriptionId = 0;
            this._startTime = new Date();
            this.logFirstResponse = true;

            connectionObj.requests[this.id] = this;
        };

        connectionObj.Request.prototype = {
            subscribe: function subscribe(callback) {
                if (!(callback instanceof Function)) return;

                try {
                    callback = callback.bind(this);
                } catch (e) {
                    console.error("serverSerice.connectionObj.Request.subscribe: Error during calling callback: ");
                    console.error(callback);
                    console.error("had the following error: ");
                    console.error(e);
                }

                var request = this,
                    subscriptionId = this._nextSubscriptionId;

                this._subscriptions[subscriptionId] = callback;
                this._nextSubscriptionId += 1;

                return {
                    dispose: function dispose() {
                        delete request._subscriptions[subscriptionId];
                    }
                };
            },
            subscribeOnce: function subscribeOnce(callback) {
                if (!(callback instanceof Function)) return;

                try {
                    callback = callback.bind(this);
                } catch (e) {
                    console.error("serverSerice.connectionObj.Request.subscribeOnce: Error binding callback: ");
                    console.error(callback);
                    console.error("had the following error: ");
                    console.error(e);
                }

                var request = this,
                    subscriptionId = this._nextSubscriptionId,
                    subscription = {
                    dispose: function dispose() {
                        delete request._subscriptions[subscriptionId];
                    }
                };

                function _callback(response) {
                    subscription.dispose();
                    try {
                        callback(response);
                    } catch (e) {
                        console.error("serverSerice.connectionObj.Request._callback: Error during calling callback: ");
                        console.error(callback);
                        console.error("had the following error: ");
                        console.error(e);
                    }
                }

                this._subscriptions[subscriptionId] = _callback;
                this._nextSubscriptionId += 1;

                return subscription;
            },
            dispose: function dispose() {
                this._subscriptions = undefined;
                delete connectionObj.requests[this.id];
                //once a request is disposed of, we temporarily store it in recentlyDeletedRequests
                //so when a message comes back that doesn't with a requestID that has been destroyed, 
                //we only trigger the warning message if it also isn't stored as a recently deleted request
                //this prevents showing the warning message when we are resizing the window and rapidly sending requests to the server
                connectionObj.recentlyDeletedRequests[this.id] = true;
                setTimeout(function (id) {
                    delete connectionObj.recentlyDeletedRequests[id];
                }, 5000, this.id);
            },
            _notifySubscriptions: function _notifySubscriptions(response) {
                var millisec = new Date() - this._startTime;
                if (this.logFirstResponse) {
                    console.log("RESPONSE:");
                    console.log(response);
                    this.logFirstResponse = false;
                }
                for (var index in this._subscriptions) {
                    try {
                        this._subscriptions[index](response, this._request, millisec);
                    } catch (e) {
                        console.error('serverSerice.connectionObj.Request._notifySubscriptions: Error calling item ' + index + ' in _subscriptions: ');
                        console.error(this._subscriptions);
                        console.error("with response: ");
                        console.error(response);
                        console.error("had the following error: ");
                        console.error(e);
                    }
                }
            }
        };

        connectionObj.sendJSON = function (json) {
            function logJSON(json) {
                var password = "";
                if (json.emsPassword != null) {
                    password = json.emsPassword;
                    json.emsPassword = "***";
                }
                var message = "";
                if (json.jsonType === "LoginReq") {
                    message = "Login request sent to server:";
                } else {
                    message = json.query != undefined ? "New query sent to server:" : "Message sent to server:";
                }
                console.debug("[" + viewId + "] " + message);
                console.log(json.args);
                if (password != "") {
                    json.emsPassword = password;
                }
            }

            // Need to check if connected?
            if (this.ws.readyState === WebSocket.OPEN) {
                try {
                    if (json === undefined) json = {};
                    this.lastMessageObj = json;
                    this.lastMessageJSON = JSON.stringify(json);
                    logJSON(json);
                    this.ws.send(this.lastMessageJSON);
                    return true;
                } catch (e) {
                    console.error("serverSerice.connectionObj.sendJSON: Error sending json: ");
                    console.error(json);
                    console.error("had the following error: ");
                    console.error(e);
                }
            }

            return false; // Failed
        };

        connectionObj.addRequestHeaders = function (jsonType, json) {
            if (json == null) json = {};
            json.jsonType = jsonType;
            json.username = username();
            json.cookie = this.cookie;
            if (json.requestId == null) {
                var timeId = new Date().getTime().toString();
                // Check if last requestId is the same as timeId:
                if (timeId === lastTimeId) {
                    // If so, generate a new one based on the number of requests during this millisecond:
                    json.requestId = timeId + "." + lastTimeIdCount;
                    lastTimeIdCount += 1;
                } else {
                    json.requestId = timeId;
                    lastTimeIdCount = 0;
                    lastTimeId = timeId;
                }
            }
            return json;
        };

        connectionObj.sendRequest = function (jsonType, json) {
            json = this.addRequestHeaders(jsonType, json);
            if (this.loggedIn) {
                //console.debug("Sending new request:", jsonType, json);
                this.sendJSON(json);
            } else {
                this.buffer.push(json);
            }

            return json.requestId;
        };

        connectionObj.sendRequestObj = function (jsonType, json) {
            return new connectionObj.Request(jsonType, json);
        };

        connectionObj.registerHandler = function (jsonType, handler) {
            this.handlers[jsonType] = this.handlers[jsonType] || [];
            this.handlers[jsonType].push(handler);
            //console.log("the handler being added is " + jsonType);
            //console.log("The handler object is now " + Object.keys(this.handlers));
        };

        connectionObj.registerLoginCallback = function (callback) {
            // If already logged in, then call callback:
            if (this.loggedIn) try {
                callback();
            } catch (e) {
                console.error("serverSerice.connectionObj.registerLoginCallback: Error during calling callback: ");
                console.error(callback);
                console.error("had the following error: ");
                console.error(e);
            }

            this.loginCallbacks.push(callback);
        };

        connectionObj.dispose = function () {
            try {
                this.loggedIn = false;
                this.ws.onclose = function () {}; // Prevent reconnect
                this.ws.close();
                for (var id in this.requests) {
                    this.requests[id].dispose();
                }
                this.requests = {};
            } catch (e) {
                console.error("serverSerice.connectionObj.dispose: Error during calling dispose: ");
                console.error(e);
            }
        };

        connectionObj.registerHandler("LoginResponse", function (message) {
            if (message.cookie != null && message.response.toLocaleUpperCase() === "SUCCESS") {
                console.debug("[" + viewId + "] Successfully logged into:", message.username + " (RoleID: " + message.role + ")");
                this.cookie = message.cookie;
                this.loggedIn = true;
                this.role(message.role);

                //Store the profile - watch for errors which can halt the loading of the app if uncaught 
                try {
                    if (profileJson() == null && message.profile != null && message.profile[PROFILEJSONNAME]) profileJson(message.profile[PROFILEJSONNAME]);
                } catch (e) {
                    console.error("serverSerice.machineProfileJson: Error during the storage of a profile from server: ");
                    console.error(e);
                }

                //Store the them - watch for errors which can halt the loading of the app if uncaught 
                try {
                    if (userThemeJson() == null && message.theme != null) userThemeJson(message.theme);
                } catch (e) {
                    console.error("serverSerice.userThemeJson: Error during the storage of a profile from server: ");
                    console.error(e);
                }

                // Notify services that we have successfully connected and logged in - prevent any errors from halting the app load
                this.loginCallbacks.forEach(function (callback) {
                    try {
                        callback.call(this, message);
                    } catch (e) {
                        console.error("serverSerice.registerHandler loginCallbacks: Error during Login callback: ");
                        console.error(callback);
                        console.error("had the following error: ");
                        console.error(e);
                    }
                });

                this.buffer.forEach(function (json) {
                    connectionObj.sendJSON(json);
                });
                this.buffer = [];
            } else {
                console.debug("[" + viewId + "] Failed to logged into " + message.username + "!", "Message:", message);
            }
        });

        connectionObj.triggerEvent = function (eventName, evt) {
            if (this.handlers[eventName] !== undefined) {
                this.handlers[eventName].forEach(function (handler) {
                    try {
                        handler.call(connectionObj, evt); //calls handler (callback function) and passes it evt (message), "this" is the connectionObj
                    } catch (e) {
                        console.error("serverSerice.connectionObj.triggerEvent: Error during calling handler: ");
                        console.error(handler);
                        console.error("using evt object: ");
                        console.error(evt);
                        console.error("had the following error: ");
                        console.error(e);
                    }
                });
            }
        };

        connectionObj.getTimeToReconnect = function () {
            // Returns ms to reconnect
            return this._reconnectTime - new Date().getTime();
        };
    }

    //creates connection at urls defined below
    if (connectionObj.connectionEndpoint != null) {
        connectionObj.ws = new WebSocket(connectionObj.connectionEndpoint); //opens a web socket

        connectionObj.ws.onerror = function (evt) {
            if (connectionObj.hasConnected()) {
                console.error("[ERROR] Error occured on websocket: ", evt);
            }
        };

        connectionObj.ws.onclose = function () {
            // websocket is closed.
            connectionObj.loggedIn = false;
            connectionObj.cookie = undefined;
            if (connectionObj.loginComputed !== undefined) connectionObj.loginComputed.dispose();
            if (connectionObj.hasConnected()) {
                // Avoid spamming the console when reconnecting to an unreachable host:
                console.warn("[WARN] Connection closed at:", new Date().toString());
                console.warn("[WARN] | Last message sent (Obj):", connectionObj.lastMessageObj);
                console.warn("[WARN] | Last message sent (JSON):", connectionObj.lastMessageJSON);
                console.warn("[WARN] | Reconnecting...");
                connectionObj.hasConnected(false);
            }
            connectionObj.lastMessageObj = undefined;
            connectionObj.lastMessageJSON = undefined;
            // Reconnect after 1s, and pass the current connectionObj to keep handlers intact:
            connectionObj._reconnectTime = new Date().getTime() + reconnectDelay;
            setTimeout(createConnection, reconnectDelay, connectionObj);
        };

        connectionObj.ws.onopen = function () {
            console.debug("[" + viewId + "] Connected at:", new Date().toString());
            connectionObj.hasConnected(true);
            connectionObj.loggedIn = true;
            // Notify services that we have successfully connected and logged in - prevent any errors from halting the app load
            connectionObj.loginCallbacks.forEach(function (callback) {
                try {
                    callback.call(this);
                } catch (e) {
                    console.error("serverSerice.registerHandler loginCallbacks: Error during Login callback: ");
                    console.error(callback);
                    console.error("had the following error: ");
                    console.error(e);
                }
            });

            // connectionObj.loginComputed = computed(function () {
            //     // Only send login request if user is authenticated with IIS:
            //     if (username() !== undefined) {
            //         // Authenticate:
            //         connectionObj.sendJSON({
            //             jsonType: "LoginReq",
            //             envToken: envToken(),
            //             username: username(),
            //             emsPassword: password,
            //             version: version.peek(),
            //             viewId: viewId
            //         });
            //     }
            //});
        };

        //receives message from back-end
        connectionObj.ws.onmessage = function (evt) {
            var message;
            try {
                var message = JSON.parse(evt.data);
            } catch (e) {
                message = { error: e, message: evt.data };
                console.error("[ERROR] Error when parsing message:", evt.data);
                console.error("[ERROR] | Parsing error:", e.message);
            }
            //console.log("THE JSON TYPE FOR ALL MESSAGES IS " + message.jsonType);
            //checks if there is a handler on the json type
            if (message == null || connectionObj.handlers[message.jsonType] === undefined && connectionObj.requests[message.requestId] == null && connectionObj.recentlyDeletedRequests[message.requestId] == null) {
                console.warn("[WARN] Unknown message received:", message);
                console.warn("[WARN] | Last message sent (Obj):", connectionObj.lastMessageObj);
                console.warn("[WARN] | Last message sent (JSON):", connectionObj.lastMessageJSON);
                //console.log(connectionObj.handlers);
                //console.log("ERROR - HERE IS THE JSONTYPE " + message.jsonType);
            } else {
                //console.log("JSON TYPE IS" + message.jsonType);
                connectionObj.triggerEvent(message.jsonType, message);

                if (connectionObj.requests[message.requestId] != null) {
                    var request = connectionObj.requests[message.requestId];
                    request._notifySubscriptions(message);
                }
            }
        };
    } else {
        // This subscription is used to monitor the endpoint and url, and disposes immediately when the endpoint is returned from the backend and the url is built from it:
        connectionObj.urlSub = isMarketData ? urlMarketData.subscribe(function (urlValue) {
            if (urlValue !== undefined) {
                //Subscription isn't needed anymore when we get a url so drop and reconnect
                connectionObj.urlSub.dispose();
                connectionObj.connectionEndpoint = urlValue;
                createConnection(connectionObj, null, viewId);
            }
        }) : url.subscribe(function (urlValue) {
            if (urlValue !== undefined) {
                //Subscription isn't needed anymore when we get a url so drop and reconnect
                connectionObj.urlSub.dispose();
                connectionObj.connectionEndpoint = urlValue;
                createConnection(connectionObj, null, viewId);
            }
        });
    }

    return connectionObj;
}

url = computed(function () {
    if (endpoint() === undefined) return undefined;
    return endpoint();
});

urlMarketData = computed(function () {
    if (marketEndpoint() === undefined) return undefined;
    return marketEndpoint();
});

exports.baseConnection = baseConnection = createConnection(null, null, "base connection"); //since no argument is passed in, baseConnection is equal to the object called connectionObj defined above
//baseConnection.registerLoginCallback(core.startupScreen.processFinished);
var constants = {
    PROFILEJSONNAME: PROFILEJSONNAME
};

exports.username = username;
exports.profileJson = profileJson;
exports.userThemeJson = userThemeJson;
exports.endpoint = endpoint;
exports.csvEndpoint = csvEndpoint;
exports.marketEndpoint = marketEndpoint;
exports.envToken = envToken;
exports.usernameEndpoint = usernameEndpoint;
exports.version = version;
exports.createConnection = createConnection;
exports.baseConnection = baseConnection;
exports.constants = constants;