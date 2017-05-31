'use strict';

import createViewFactory from './createViewFactory';
import itemsViewModel from './itemsViewModel';

// exports.viewModelConstructor = function (containerId, columns, keyFields, selectionOptions, defaultSorting, serverParameters) {
//     let createServerConnection = createViewFactory(serverParameters);
//     let viewModel = itemsViewModel(containerId, columns, keyFields, createServerConnection, selectionOptions, defaultSorting);

//     return viewModel;
// };


exports.viewModelConstructor = function (config) {
    let createServerConnection = createViewFactory(config.serverParameters);
    let viewModel = itemsViewModel(config, createServerConnection);

    return viewModel;
};
