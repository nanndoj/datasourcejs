var Datasource = require('./datasource.js');

angular.module('datasourcejs',[])

.factory('DatasourceManager', ['$http','$q', '$timeout','$rootScope', function($http, $q, $timeout, $rootScope) {
  'use strict';

  // Global datasource List
  this.datasources = {};

  /**
    * Datasource Manager Methods
    */
  this.storeDatasource = function (datasource) {
    this.datasources[datasource.name] = datasource;
  },

  /**
  * Initialize a new datasource
  */
  this.initDatasource = function (props) {
    var dts = new Datasource(props.name);
    
    // Override datasource request method.
    // We want to let Angular $http module handle 
    // requests instead of the default XMLHttpRequest
    dts.request = function(verb, url, object) {
      return $http({
        method: verb,
        url: url,
        data : (object) ? JSON.stringify(object) : null,
        headers: this.headers
      });
    };

    dts.entity = props.entity;
    dts.keys = (props.keys && props.keys.length > 0) ? props.keys.split(',') : [];
    dts.rowsPerPage = props.rowsPerPage ? props.rowsPerPage : 100; // Default 100 rows per page
    dts.append = props.append;
    dts.prepend = props.prepend;
    dts.endpoint = props.endpoint;
    dts.filterURL = props.filterURL;
    dts.autoPost = props.autoPost;
    dts.deleteMessage = props.deleteMessage;
    dts.enabled = props.enabled;
    dts.offset = (props.offset) ? props.offset : 0; // Default offset is 0

    
    // Check for headers
    if(props.headers && props.headers.length > 0) {
      dts.headers = {};
      var headers = props.headers.trim().split(';');
      var header;
      for(var i = 0; i < headers.length; i++) {
        header = headers[i].split(':');
        if(header.length === 2) {
          dts.headers[header[0]] = header[1];  
        }
      }
    }
    
    // Init
    dts.init();
    this.storeDatasource(dts);

    if(!props.lazy && (Object.prototype.toString.call(props.watch) !== '[object String]') && !props.filterURL) {
      // Query string object
      var queryObj = {};

      // Fill the datasource
      dts.fetch({params: queryObj}, {success: function(data) {
        if (data && data.length > 0) {
          this.active = data[0];
          this.cursor = 0;
        }
      }});
    }
      
    if(props.lazy && props.autoPost) {
      dts.startAutoPost();
    }

    if(props.watch && Object.prototype.toString.call(props.watch) === '[object String]') {
      this.registerObserver(props.watch, dts);
      dts.watchFilter = props.watchFilter;
    }
    
    // Filter the dataset if the filter property was set
    if(props.filterURL && props.filterURL.length > 0) { 
      dts.filter(props.filterURL);
    }

    $rootScope.$watch(function() { 
      return dts.active; 
    },
    function() {
      dts._activeValues = dts.getRowValues(this.active);
    }, true);

    // Add this instance into the root scope
    // This will expose the dataset name as a
    // global variable
    if(props.global !== 'false') {
      $rootScope[dts.name] = dts;
      window[dts.name] = dts;
    }

    
    return dts;
  };

  return this;
}])

/**
* Cronus Dataset Directive
*/
.directive('datasource',['DatasourceManager','$timeout', function (DatasourceManager,$timeout) {
  return {
    restrict: 'E',
    scope: true,
    template: '',
    link: function( scope, element, attrs ) {
      var init = function () {
        var props = {
          name: attrs.name,
          entity: attrs.entity,
          enabled: (attrs.hasOwnProperty('enabled')) ? (attrs.enabled === 'true') : true,
          keys: attrs.keys,
          endpoint: attrs.endpoint,
          lazy: (attrs.hasOwnProperty('lazy') && attrs.lazy === '') || attrs.lazy === 'true',
          append: !attrs.hasOwnProperty('append') || attrs.append === 'true',
          prepend: (attrs.hasOwnProperty('prepend') && attrs.prepend === '') || attrs.prepend === 'true',
          watch: attrs.watch,
          rowsPerPage: attrs.rowsPerPage,
          offset: attrs.offset,
          filterURL : attrs.filter,
          watchFilter: attrs.watchFilter,
          deleteMessage: attrs.deleteMessage,
          headers : attrs.headers,
          autoPost : (attrs.hasOwnProperty('autoPost') && attrs.autoPost === '') || attrs.autoPost === 'true'
        };
        
        var firstLoad = {
          filter: true,
          entity: true,
          enabled: true
        };
        var datasource = DatasourceManager.initDatasource(props);
        
        var timeoutPromise;
        attrs.$observe('filter', function( value ){
          if (!firstLoad.filter) {
            // Stop the pending timeout
            $timeout.cancel(timeoutPromise);
            
            // Start a timeout
            timeoutPromise = $timeout(function() {
              datasource.filter(value);
            }, 200);
          } else {    
            $timeout(function() { firstLoad.filter = false; });
          }
        });
        
        attrs.$observe('enabled', function( value ){
          if (!firstLoad.enabled) {
            datasource.enabled = (value === 'true');
            datasource.fetch({params:{}});
          } else {    
            $timeout(function() { firstLoad.enabled = false; });
          }
        });
        
        attrs.$observe('entity', function( value ){
          datasource.entity = value;
          if (!firstLoad.entity) {
            // Only fetch if it's not the first load
            datasource.fetch({params:{}});
          } else {
            $timeout(function() { firstLoad.entity = false; });
          }
        });
      };
      init();
    }
  };
}])

.directive('datasourceName',['DatasourceManager','$parse', function(DatasourceManager,$parse) {
  return {
    restrict: 'A',
    scope: true,
    link: function(scope, element, attrs) {
      scope.data = DatasourceManager.datasources;
      if(scope.data[attrs.datasourceName]) {
        scope.datasource = scope.data[attrs.datasourceName];
      } else {
        scope.datasource = {};
        scope.datasource.data = $parse(attrs.datasourceName)(scope);
      }
    }
  };
}]);