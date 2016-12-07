'use strict';

import ko from 'knockout';
import rx from 'rxjs/Rx';
import { createConnection } from './utils/serverService';
import toQueryFilters from './utils/queryFilters';
import { merge } from './utils/coreFunctions';

//Base class for services that contain a slick-grid table
var // imports
    Subject = rx.Subject,
    observableArray = ko.observableArray,
    // vars
    views = {};

export default function (serverParameters) {
    var viewType = serverParameters.viewType;
    var //additionalHandlers = additional !== undefined && additional.handlers !== undefined ? additional.handlers : {},
        additionalProperties = serverParameters.additional !== undefined && serverParameters.additional.properties !== undefined ? serverParameters.additional.properties : {},
        additionalOnWindow = serverParameters.additional !== undefined ? serverParameters.additional.onWindow : undefined;
        
    return function createView(viewId) {
        // Create a new view object that is used to proxy messages to/from backend.
        if (views[viewId] !== undefined) { // Find if viewId already exists
            console.warn("View (ID:" + viewId + ") overwritten!");
            views[viewId].dispose();
        }

        function onList(message) {
            //console.debug("Message received... Num" + viewType.jsonList + ":", message.list.length, message);
            if (view.paused || view.requestId != message.requestId) return;
            additionalOnWindow && additionalOnWindow.call(view, message);
            //if (message.list != null) view.items(message.list);
            if (message.args[0].data != null) {
                message.list = message.args[0].data;  
                /*Disabled updating the items observable attached to the view object, it is confusing and unnecessary with updating the
                items observable in itemsViewModel*/
                //view.items(message.list);
            }
            view.windowBus.next(message); //sends message to itemsViewModel
        }

        function subscribeResponse(requestObj) {
            if (this.requestObj != null) this.requestObj.dispose();
            this.requestObj = requestObj;
            this.requestId = requestObj.id;
            this.currentQuery = requestObj._request;
            this.requestObj.subscribe(onList);
        }

        //viewQuery is called in itemsViewModel and passed the object currentQuery, which
        //is defined in the itemsViewModel
        function viewQuery(query) {
            if (query === undefined || query.sort === undefined) return;

            var sortField = Object.keys(query.sort)[0];
            let sortDirection = query.sort[sortField] === true ? "ASC" : "DESC";
            let filterObject = toQueryFilters(query.filters);
            this.currentQuery = {
                id: this.id,
                call: "getOrderView",
                args: [query.start, (query.start + query.count), sortDirection, sortField, filterObject]
            };

            if (this.userGroup && this.listName) {
                this.currentQuery = merge(this.currentQuery, { userGroup: this.userGroup, listName: this.listName });
            }

            // We check if the connection is logged in. If not, then we ignore sending this request as it will be sent in the login callback down below.
            if (this.connection.loggedIn) {
                var request = this.connection.sendRequestObj(this.jsonRequest, this.currentQuery);
                this.subscribeResponse(request);
                return request;
            }
        }

        function dispose() {
            delete views[this.id];
            if (this.requestObj != null) this.requestObj.dispose();
            this.messageBus.dispose();
            this.windowBus.dispose();
            this.connection.dispose();
            // NOTE: All connection subscriptions are disposed by connection.dispose
        }

        var view = merge({
            id: viewId,
            timestamp: new Date(),
            messageBus: new Subject(),
            windowBus: new Subject(),
            items: observableArray([]),
            connection: createConnection(undefined, viewType.endpoint, viewId), //null indicates the connection is equal to connectionObj (an object) defined in serverService.js
            jsonRequest: viewType.jsonRequest,
            jsonList: viewType.jsonList,
            currentQuery: undefined,
            paused: false,
            // view functions:
            query: viewQuery,
            subscribeResponse: subscribeResponse,
            dispose: dispose
        }, additionalProperties);

        // We use this login callback for reconnects:
        view.connection.registerLoginCallback(function () {
            if (view.currentQuery !== undefined) {
                // Send the latest request, since we requested it too earlier before we logged in:;
                delete view.currentQuery.requestId;
                view.subscribeResponse(view.connection.sendRequestObj(view.jsonRequest, view.currentQuery));
            }
        });

        // Register additionalHandlers to view:
        /*Object.keys(additionalHandlers).forEach(function (handlerType) {
            view.connection.registerHandler(handlerType, additionalHandlers[handlerType].bind(view)); //adds function to view, function is additionalHandlers[handlerType]
        });*/

        views[viewId] = view;
        return view;
    }
};

