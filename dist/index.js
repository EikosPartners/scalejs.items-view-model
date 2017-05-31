'use strict';

var _createViewFactory = require('./createViewFactory');

var _createViewFactory2 = _interopRequireDefault(_createViewFactory);

var _itemsViewModel = require('./itemsViewModel');

var _itemsViewModel2 = _interopRequireDefault(_itemsViewModel);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// exports.viewModelConstructor = function (containerId, columns, keyFields, selectionOptions, defaultSorting, serverParameters) {
//     let createServerConnection = createViewFactory(serverParameters);
//     let viewModel = itemsViewModel(containerId, columns, keyFields, createServerConnection, selectionOptions, defaultSorting);

//     return viewModel;
// };


exports.viewModelConstructor = function (config) {
    var createServerConnection = (0, _createViewFactory2.default)(config.serverParameters);
    var viewModel = (0, _itemsViewModel2.default)(config, createServerConnection);

    return viewModel;
};