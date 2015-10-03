(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = function(name) {
  'use strict';

  // Public members
  this.data = [];
  this.name = name;
  this.keys = [];
  this.enabled = true;
  this.endpoint = null;
  this.active = {};
  this.inserting = false; 
  this.editing = false;
  this.fetchSize = 2;
  this.observers = [];
  this.rowsPerPage = null;
  this.append = true;
  this.headers = null;
  this._activeValues = null;
  this.errorMessage = '';

  // Private members
  var cursor = 0;
  var service = null;
  var _savedProps;
  var hasMoreResults = false;
  var busy = false;
  var _self = this;
    
  // Public methods
  /**
  * Initialize a single datasource
  */
  this.init = function() {

    // Get the service resource
    service = {
      save : function(object) {
        return this.call(_self.entity, 'POST', object, true);
      },
      update : function(url, object) {
        return this.call(url, 'PUT', object);
      },
      remove : function(url) {
        return this.call(url, 'DELETE', null, true);
      },
      call: function(url, verb, object) {
        var _callback;
        busy = true;

        // Get an ajax promise
        this.$promise = _self.request(verb, url, object, _callback)
        .then(
          // Success Handler
          function( response ) {
            busy = false;
            if(_callback) _callback(response.data);
          },
          // Error Handler
          function( response ) {
            busy = false;
            if(_callback) _callback(response.data);
          }
        );
        
        this.$promise.then = function(callback) {
          _callback = callback;
        };
        
        return this;
      }
    };
    
    /**
     * Check if the datasource is waiting for any request response
     */
    this.isBusy = function() {
      return busy;
    };
    
    /**
     *  Error Handler function
     */
    this.handleError = function(data) {
      var error = ''; 
        
      if(data && data.status === 401) { 
        error = 'Username or passoword invalid!';
      } else {
        if(data && Object.prototype.toString.call(data.responseText) === '[object String]') {
          var regex = /<h1>(.*)<\/h1>/gmi;
          var result = regex.exec(data.responseText);
              
          if(result && result.length >= 2) {
            error = result[1];
          } else {
            error = data.responseText;
          }
        }
      }
      this.errorMessage = error;
    };
  };

  //Public methods
  /**
  * Append a new value to the end of this dataset.
  */ 
  this.insert = function (obj, callback) {
    service.save(obj).$promise.then(callback);
  };

  /**
  * Uptade a value into this dataset by using the dataset key to compare
  * the objects
  */ 
  this.update = function (obj, callback) {
    // Get the keys values
    var keyObj = getKeyValues(obj);
    
    var url = this.entity;
    
    var suffixPath = '';
    for(var key in keyObj) {
      if(keyObj.hasOwnProperty(key)) {
        suffixPath += '/' + keyObj[key];
      }
    }
    
    url = url + suffixPath;
    
    service.update(url, obj).$promise.then(callback);        
  };

  /**
  * Insert or update based on the the datasource state
  */ 
  this.post = function () {
    if(this.inserting) {
      // Make a new request to persist the new item
      this.insert(this.active, function(obj) {
        // In case of success add the new inserted value at
        // the end of the array
        this.data.push(obj);
        // The new object is now the active
        this.active = obj;
      }.bind(this));
      
    } else if(this.editing) {
      // Make a new request to update the modified item
      this.update(this.active, function(obj) {
        // Get the list of keys
        var keyObj = getKeyValues(obj);
        
        // For each row data
        this.data.forEach(function(currentRow) {
          // Iterate all keys checking if the 
          // current object match with the
          // extracted key values
          var found;
          for(var key in keyObj) {
            if(currentRow[key] && currentRow[key] === keyObj[key]) {
              found = true;
            } else {
              found = false;
            }
          }
          if(found) {
            this.copy(obj,currentRow);
          }
        }.bind(this));
      }.bind(this));
    }
    
    // Set this datasource back to the normal state
    this.editing = false;
    this.inserting = false;
  };

/**
* Cancel the editing or inserting state
*/
  this.cancel = function() {
    if(this.inserting) {
      this.active = this.data[0];
    }
    this.inserting = false;
    this.editing = false;
  };
  
  /**
  * Put the datasource into the inserting state
  */
  this.startInserting = function () {
    this.inserting = true;
    this.active = {};
    if(this.onStartInserting){
      this.onStartInserting();
    }
  };
 
  /**
  * Put the datasource into the editing state
  */
  this.startEditing = function (item) {
    if(item) this.active = this.copy(item);
    this.editing = true;
  };

  /**
  * Remove an object from this dataset by using the given id.
  * the objects
  */
  this.remove = function (object, callback) {
    var _remove = function(object, callback) {
      if(!object) {
        object = this.active;
      }
        
      var keyObj = getKeyValues(object);
      
      var suffixPath = '';
      for(var key in keyObj) {
        if(keyObj.hasOwnProperty(key)) {
          suffixPath += '/' + keyObj[key];
        }
      }
        
      callback = callback || function() {
        // For each row data
        for(var i = 0; i < this.data.length; i++) {
          // Iterate all keys checking if the 
          // current object match with the same
          // vey values
          // Check all keys
          var found;
          for(var key in keyObj) {
            if(keyObj.hasOwnProperty(key)) {
              if(this.data[i][key] && this.data[i][key] === keyObj[key]) {
                found = true;
              } else {
                // There's a difference between the current object
                // and the key values extracted from the object
                // that we want to remove
                found = false;
              }
            }
          }
          if(found) {
            // If it's the object we're loking for
            // remove it from the array
            this.data.splice(i,1);
            this.active = (i > 0) ? this.data[i - 1] : null;
          }
        }
      }.bind(this);
        
      service.remove(this.entity + suffixPath).$promise.then(callback);

    }.bind(this);
    
    if(this.deleteMessage && this.deleteMessage.length > 0) {
      if(window.confirm(this.deleteMessage)) {
        _remove(object, callback); 
      }
    } else {
      _remove(object, callback);
    }
  };
  
  /**
   * Get the object keys values from the datasource keylist
   * PRIVATE FUNCTION
   */
  var getKeyValues = function(rowData) {
    var keyValues = {};
    for(var i = 0; i < this.keys.length; i++) {
      keyValues[this.keys[i]] = rowData[this.keys[i]];
    }

    return keyValues;
  }.bind(this);
  
  /**
  * Ajax request Helper
  * PRIVATE FUNCTION
  */
  this.request = function(verb, url, body) {
    var noop = function() {};

    var _onSuccess = noop;
    var _onError = noop;

    var promise = {
      then : function(successCallback, errorCallback) {
        _onSuccess = successCallback || _onSuccess;
        _onError = errorCallback || _onError;
        return promise;
      }
    };

    var handleRequest = function() {
      if(this.readyState === 4) {
        if(this.status >= 200 && this.status <= 299) {
          _onSuccess({ data : JSON.parse(this.responseText) });
          _onError = noop;
        } else {
          _onError({ data : this.responseText });
          _onSuccess = noop;
        }
      }
    };

    var request = new XMLHttpRequest();
    request.onreadystatechange = handleRequest;
    request.open(verb, url, true);

    for(var attribute in this.headers) {
      if(this.headers.hasOwnProperty(attribute)) {
        request.setRequestHeader(attribute, this.headers[attribute]);
      }
    }

    request.send((body) ? JSON.stringify(body) : null);

    return promise;
  };

  /**
  * Check if the object has more itens to iterate
  */
  this.hasNext = function () {
    return this.data && (cursor < this.data.length - 1);
  };

  /**
  * Check if the cursor is not at the beginning of the datasource
  */
  this.hasPrevious = function () {
    return this.data && (cursor > 0);
  };

  /**
  * Check if the object has more itens to iterate
  */
  this.order = function (order) {
    _savedProps.order = order;
  };

  /**
  * Get the values of the active row as an array.
  * This method will ignore any keys and only return the values
  */
  this.getActiveValues = function() {
    return this.getRowValues(this.active);
  };

  this.__defineGetter__('activeValues', function() { return _self.getActiveValues(); });

  /**
  * Get the values of the given row
  */
  this.getRowValues = function(rowData) {
    var arr = [];
    for( var i in rowData ) {
      if (rowData.hasOwnProperty(i)){
        arr.push(rowData[i]);
      }
    }
    return arr;
  };

  /**
  *  Get the current item moving the cursor to the next element
  */
  this.next = function () {
    if(!this.hasNext()) {
      this.nextPage();
    }
    this.active = this.copy(this.data[++cursor],{});
    return this.active;
  };
  
  /**
  *  Try to fetch the previous page
  */
  this.nextPage = function () {
    if(!this.hasNextPage()) {
      return;
    }
    this.offset = parseInt(this.offset) + parseInt(this.rowsPerPage); 
    this.fetch(_savedProps, { 
      success: function(data) {
        if(!data || data.length < parseInt(this.rowsPerPage)) {
          this.offset = parseInt(this.offset) - this.data.length; 
        }
      }
    });
  };
  
  /**
  *  Try to fetch the previous page
  */
  this.prevPage = function () {
    if(!this.append && !this.preppend) {
      this.offset = parseInt(this.offset) - this.data.length; 
      
      if(this.offset < 0) {
        this.offset = 0;
      } else if(this.offset >= 0) {
        this.fetch(_savedProps, {
          success: function(data) {
            if(!data || data.length === 0) {
              this.offset = 0; 
            }
          } 
        }); 
      }
    }
  };
  
  /**
  *  Check if has more pages
  */
  this.hasNextPage = function () {
    return hasMoreResults && (this.rowsPerPage != -1);
  };
  
  /**
  *  Check if has previews pages
  */
  this.hasPrevPage = function () {
    return this.offset > 0 && !this.append && !this.prepend;
  };      

  /**
  *  Get the previous item
  */
  this.previous = function () {
    if(!this.hasPrevious()) throw 'Dataset Overflor Error';
    this.active = this.copy(this.data[--cursor],{});
    return this.active;
  };

  /**
  *  Moves the cursor to the specified item
  */
  this.goTo = function (rowId) {
    for(var i = 0; i < this.data.length; i++) {
      if(this.data[i][this.key] === rowId) {
        cursor = i;
        this.active = this.copy(this.data[cursor],{});
        return this.active;
      }
    }
  };

  /**
  *  Get the current cursor index
  */
  this.getCursor = function () {
    return cursor;
  };
  
  /**
  *  filter dataset by URL
  */
  this.filter = function ( url ) {
    var oldoffset = this.offset;
    this.offset = 0;
    this.fetch({ path: url }, { beforeFill: function() {
      this.cleanup(); 
    }, error : function() {
      this.offset = oldoffset;  
    }});
  };
  
  /**
   * Cleanup datasource  
   */
  this.cleanup = function () {
    this.offset = 0;
    this.data = [];
    this.cursor = -1;
    this.active = null;
    hasMoreResults = false;
  };

  /**
  *  Get the current row data
  */
  this.current = function () {
    return this.active || this.data[0];
  };

  /**
  *  Fetch all data from the server
  */
  this.fetch = function (properties, callbacksObj) {
    
    // Ignore any call if the datasource is busy (fetching another request)
    if(this.busy) return;
    
    if(!this.enabled) {
      this.cleanup();
      return;
    }
    
    var props = properties || {};
    var callbacks = callbacksObj || {};

    // Adjust property parameters and the endpoint url
    props.params = props.params || {};
    var resourceURL = this.entity + (props.path || '');
    
    // Set Limit and offset
    if(this.rowsPerPage > 0) {
      props.params.limit = this.rowsPerPage;
      props.params.offset = this.offset;
    }
           
    // Store the last configuration for late use
    _savedProps = props;
    
    // Make the datasource busy
    busy = true;
    
    // Get an ajax promise
    this.$promise = this.request('GET', resourceURL, props.params)
    .then(
      // Success Handler
      function(response) {
        busy = false;
        sucessHandler(response.data);
      }.bind(this),
      // Error Handler
      function(response){
        busy = false;
        this.handleError(response.data);
        if(callbacks.error) callbacks.error.call(this, response.data);
      }.bind(this)
    );
    
    // Success Handler
    var sucessHandler = function (data) {
      if(data) {
        if(Object.prototype.toString.call( data ) !== '[object Array]' ) {
          data = [data];
        }
        
        // Call the before fill callback
        if(callbacks.beforeFill) callbacks.beforeFill.apply(this, this.data);

        // If prepend property was set. 
        // Add the new data before the old one
        if(this.prepend) this.data = data.concat(this.data);  

        // If append property was set. 
        // Add the new data after the old one
        if(this.append) this.data = this.data.concat(data);

        // When neither  nor preppend was set
        // Just replace the current data
        if(!this.prepend && !this.append) {
          this.data = data;
          this.active = data[0];
          cursor = 0;
        }
        if(callbacks.success) callbacks.success.call(this, data);
        
        hasMoreResults = (data.length >= this.rowsPerPage);
      } 
    }.bind(this);
  };


  /**
  * Clone a JSON Object
  */
  this.copy = function (from,to) {
    if(from === null || Object.prototype.toString.call(from) !== '[object Object]')
      return from;

    to = to || {}; 

    for(var key in from) {
      if(from.hasOwnProperty(key) && key.indexOf('$')==-1) {
        to[key] = this.copy(from[key]);
      }
    }
    return to;
  };
};
},{}],2:[function(require,module,exports){
var Datasource = require('./core/datasource.js');

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
  };

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
},{"./core/datasource.js":1}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29yZS9kYXRhc291cmNlLmpzIiwic3JjL2RhdGFzb3VyY2UtYW5ndWxhci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9rQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24obmFtZSkge1xyXG4gICd1c2Ugc3RyaWN0JztcclxuXHJcbiAgLy8gUHVibGljIG1lbWJlcnNcclxuICB0aGlzLmRhdGEgPSBbXTtcclxuICB0aGlzLm5hbWUgPSBuYW1lO1xyXG4gIHRoaXMua2V5cyA9IFtdO1xyXG4gIHRoaXMuZW5hYmxlZCA9IHRydWU7XHJcbiAgdGhpcy5lbmRwb2ludCA9IG51bGw7XHJcbiAgdGhpcy5hY3RpdmUgPSB7fTtcclxuICB0aGlzLmluc2VydGluZyA9IGZhbHNlOyBcclxuICB0aGlzLmVkaXRpbmcgPSBmYWxzZTtcclxuICB0aGlzLmZldGNoU2l6ZSA9IDI7XHJcbiAgdGhpcy5vYnNlcnZlcnMgPSBbXTtcclxuICB0aGlzLnJvd3NQZXJQYWdlID0gbnVsbDtcclxuICB0aGlzLmFwcGVuZCA9IHRydWU7XHJcbiAgdGhpcy5oZWFkZXJzID0gbnVsbDtcclxuICB0aGlzLl9hY3RpdmVWYWx1ZXMgPSBudWxsO1xyXG4gIHRoaXMuZXJyb3JNZXNzYWdlID0gJyc7XHJcblxyXG4gIC8vIFByaXZhdGUgbWVtYmVyc1xyXG4gIHZhciBjdXJzb3IgPSAwO1xyXG4gIHZhciBzZXJ2aWNlID0gbnVsbDtcclxuICB2YXIgX3NhdmVkUHJvcHM7XHJcbiAgdmFyIGhhc01vcmVSZXN1bHRzID0gZmFsc2U7XHJcbiAgdmFyIGJ1c3kgPSBmYWxzZTtcclxuICB2YXIgX3NlbGYgPSB0aGlzO1xyXG4gICAgXHJcbiAgLy8gUHVibGljIG1ldGhvZHNcclxuICAvKipcclxuICAqIEluaXRpYWxpemUgYSBzaW5nbGUgZGF0YXNvdXJjZVxyXG4gICovXHJcbiAgdGhpcy5pbml0ID0gZnVuY3Rpb24oKSB7XHJcblxyXG4gICAgLy8gR2V0IHRoZSBzZXJ2aWNlIHJlc291cmNlXHJcbiAgICBzZXJ2aWNlID0ge1xyXG4gICAgICBzYXZlIDogZnVuY3Rpb24ob2JqZWN0KSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuY2FsbChfc2VsZi5lbnRpdHksICdQT1NUJywgb2JqZWN0LCB0cnVlKTtcclxuICAgICAgfSxcclxuICAgICAgdXBkYXRlIDogZnVuY3Rpb24odXJsLCBvYmplY3QpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5jYWxsKHVybCwgJ1BVVCcsIG9iamVjdCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIHJlbW92ZSA6IGZ1bmN0aW9uKHVybCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmNhbGwodXJsLCAnREVMRVRFJywgbnVsbCwgdHJ1ZSk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGNhbGw6IGZ1bmN0aW9uKHVybCwgdmVyYiwgb2JqZWN0KSB7XHJcbiAgICAgICAgdmFyIF9jYWxsYmFjaztcclxuICAgICAgICBidXN5ID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgLy8gR2V0IGFuIGFqYXggcHJvbWlzZVxyXG4gICAgICAgIHRoaXMuJHByb21pc2UgPSBfc2VsZi5yZXF1ZXN0KHZlcmIsIHVybCwgb2JqZWN0LCBfY2FsbGJhY2spXHJcbiAgICAgICAgLnRoZW4oXHJcbiAgICAgICAgICAvLyBTdWNjZXNzIEhhbmRsZXJcclxuICAgICAgICAgIGZ1bmN0aW9uKCByZXNwb25zZSApIHtcclxuICAgICAgICAgICAgYnVzeSA9IGZhbHNlO1xyXG4gICAgICAgICAgICBpZihfY2FsbGJhY2spIF9jYWxsYmFjayhyZXNwb25zZS5kYXRhKTtcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICAvLyBFcnJvciBIYW5kbGVyXHJcbiAgICAgICAgICBmdW5jdGlvbiggcmVzcG9uc2UgKSB7XHJcbiAgICAgICAgICAgIGJ1c3kgPSBmYWxzZTtcclxuICAgICAgICAgICAgaWYoX2NhbGxiYWNrKSBfY2FsbGJhY2socmVzcG9uc2UuZGF0YSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLiRwcm9taXNlLnRoZW4gPSBmdW5jdGlvbihjYWxsYmFjaykge1xyXG4gICAgICAgICAgX2NhbGxiYWNrID0gY2FsbGJhY2s7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgfVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBDaGVjayBpZiB0aGUgZGF0YXNvdXJjZSBpcyB3YWl0aW5nIGZvciBhbnkgcmVxdWVzdCByZXNwb25zZVxyXG4gICAgICovXHJcbiAgICB0aGlzLmlzQnVzeSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICByZXR1cm4gYnVzeTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogIEVycm9yIEhhbmRsZXIgZnVuY3Rpb25cclxuICAgICAqL1xyXG4gICAgdGhpcy5oYW5kbGVFcnJvciA9IGZ1bmN0aW9uKGRhdGEpIHtcclxuICAgICAgdmFyIGVycm9yID0gJyc7IFxyXG4gICAgICAgIFxyXG4gICAgICBpZihkYXRhICYmIGRhdGEuc3RhdHVzID09PSA0MDEpIHsgXHJcbiAgICAgICAgZXJyb3IgPSAnVXNlcm5hbWUgb3IgcGFzc293b3JkIGludmFsaWQhJztcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBpZihkYXRhICYmIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChkYXRhLnJlc3BvbnNlVGV4dCkgPT09ICdbb2JqZWN0IFN0cmluZ10nKSB7XHJcbiAgICAgICAgICB2YXIgcmVnZXggPSAvPGgxPiguKik8XFwvaDE+L2dtaTtcclxuICAgICAgICAgIHZhciByZXN1bHQgPSByZWdleC5leGVjKGRhdGEucmVzcG9uc2VUZXh0KTtcclxuICAgICAgICAgICAgICBcclxuICAgICAgICAgIGlmKHJlc3VsdCAmJiByZXN1bHQubGVuZ3RoID49IDIpIHtcclxuICAgICAgICAgICAgZXJyb3IgPSByZXN1bHRbMV07XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBlcnJvciA9IGRhdGEucmVzcG9uc2VUZXh0O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICB0aGlzLmVycm9yTWVzc2FnZSA9IGVycm9yO1xyXG4gICAgfTtcclxuICB9O1xyXG5cclxuICAvL1B1YmxpYyBtZXRob2RzXHJcbiAgLyoqXHJcbiAgKiBBcHBlbmQgYSBuZXcgdmFsdWUgdG8gdGhlIGVuZCBvZiB0aGlzIGRhdGFzZXQuXHJcbiAgKi8gXHJcbiAgdGhpcy5pbnNlcnQgPSBmdW5jdGlvbiAob2JqLCBjYWxsYmFjaykge1xyXG4gICAgc2VydmljZS5zYXZlKG9iaikuJHByb21pc2UudGhlbihjYWxsYmFjayk7XHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgKiBVcHRhZGUgYSB2YWx1ZSBpbnRvIHRoaXMgZGF0YXNldCBieSB1c2luZyB0aGUgZGF0YXNldCBrZXkgdG8gY29tcGFyZVxyXG4gICogdGhlIG9iamVjdHNcclxuICAqLyBcclxuICB0aGlzLnVwZGF0ZSA9IGZ1bmN0aW9uIChvYmosIGNhbGxiYWNrKSB7XHJcbiAgICAvLyBHZXQgdGhlIGtleXMgdmFsdWVzXHJcbiAgICB2YXIga2V5T2JqID0gZ2V0S2V5VmFsdWVzKG9iaik7XHJcbiAgICBcclxuICAgIHZhciB1cmwgPSB0aGlzLmVudGl0eTtcclxuICAgIFxyXG4gICAgdmFyIHN1ZmZpeFBhdGggPSAnJztcclxuICAgIGZvcih2YXIga2V5IGluIGtleU9iaikge1xyXG4gICAgICBpZihrZXlPYmouaGFzT3duUHJvcGVydHkoa2V5KSkge1xyXG4gICAgICAgIHN1ZmZpeFBhdGggKz0gJy8nICsga2V5T2JqW2tleV07XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgdXJsID0gdXJsICsgc3VmZml4UGF0aDtcclxuICAgIFxyXG4gICAgc2VydmljZS51cGRhdGUodXJsLCBvYmopLiRwcm9taXNlLnRoZW4oY2FsbGJhY2spOyAgICAgICAgXHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgKiBJbnNlcnQgb3IgdXBkYXRlIGJhc2VkIG9uIHRoZSB0aGUgZGF0YXNvdXJjZSBzdGF0ZVxyXG4gICovIFxyXG4gIHRoaXMucG9zdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGlmKHRoaXMuaW5zZXJ0aW5nKSB7XHJcbiAgICAgIC8vIE1ha2UgYSBuZXcgcmVxdWVzdCB0byBwZXJzaXN0IHRoZSBuZXcgaXRlbVxyXG4gICAgICB0aGlzLmluc2VydCh0aGlzLmFjdGl2ZSwgZnVuY3Rpb24ob2JqKSB7XHJcbiAgICAgICAgLy8gSW4gY2FzZSBvZiBzdWNjZXNzIGFkZCB0aGUgbmV3IGluc2VydGVkIHZhbHVlIGF0XHJcbiAgICAgICAgLy8gdGhlIGVuZCBvZiB0aGUgYXJyYXlcclxuICAgICAgICB0aGlzLmRhdGEucHVzaChvYmopO1xyXG4gICAgICAgIC8vIFRoZSBuZXcgb2JqZWN0IGlzIG5vdyB0aGUgYWN0aXZlXHJcbiAgICAgICAgdGhpcy5hY3RpdmUgPSBvYmo7XHJcbiAgICAgIH0uYmluZCh0aGlzKSk7XHJcbiAgICAgIFxyXG4gICAgfSBlbHNlIGlmKHRoaXMuZWRpdGluZykge1xyXG4gICAgICAvLyBNYWtlIGEgbmV3IHJlcXVlc3QgdG8gdXBkYXRlIHRoZSBtb2RpZmllZCBpdGVtXHJcbiAgICAgIHRoaXMudXBkYXRlKHRoaXMuYWN0aXZlLCBmdW5jdGlvbihvYmopIHtcclxuICAgICAgICAvLyBHZXQgdGhlIGxpc3Qgb2Yga2V5c1xyXG4gICAgICAgIHZhciBrZXlPYmogPSBnZXRLZXlWYWx1ZXMob2JqKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBGb3IgZWFjaCByb3cgZGF0YVxyXG4gICAgICAgIHRoaXMuZGF0YS5mb3JFYWNoKGZ1bmN0aW9uKGN1cnJlbnRSb3cpIHtcclxuICAgICAgICAgIC8vIEl0ZXJhdGUgYWxsIGtleXMgY2hlY2tpbmcgaWYgdGhlIFxyXG4gICAgICAgICAgLy8gY3VycmVudCBvYmplY3QgbWF0Y2ggd2l0aCB0aGVcclxuICAgICAgICAgIC8vIGV4dHJhY3RlZCBrZXkgdmFsdWVzXHJcbiAgICAgICAgICB2YXIgZm91bmQ7XHJcbiAgICAgICAgICBmb3IodmFyIGtleSBpbiBrZXlPYmopIHtcclxuICAgICAgICAgICAgaWYoY3VycmVudFJvd1trZXldICYmIGN1cnJlbnRSb3dba2V5XSA9PT0ga2V5T2JqW2tleV0pIHtcclxuICAgICAgICAgICAgICBmb3VuZCA9IHRydWU7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgZm91bmQgPSBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYoZm91bmQpIHtcclxuICAgICAgICAgICAgdGhpcy5jb3B5KG9iaixjdXJyZW50Um93KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LmJpbmQodGhpcykpO1xyXG4gICAgICB9LmJpbmQodGhpcykpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBTZXQgdGhpcyBkYXRhc291cmNlIGJhY2sgdG8gdGhlIG5vcm1hbCBzdGF0ZVxyXG4gICAgdGhpcy5lZGl0aW5nID0gZmFsc2U7XHJcbiAgICB0aGlzLmluc2VydGluZyA9IGZhbHNlO1xyXG4gIH07XHJcblxyXG4vKipcclxuKiBDYW5jZWwgdGhlIGVkaXRpbmcgb3IgaW5zZXJ0aW5nIHN0YXRlXHJcbiovXHJcbiAgdGhpcy5jYW5jZWwgPSBmdW5jdGlvbigpIHtcclxuICAgIGlmKHRoaXMuaW5zZXJ0aW5nKSB7XHJcbiAgICAgIHRoaXMuYWN0aXZlID0gdGhpcy5kYXRhWzBdO1xyXG4gICAgfVxyXG4gICAgdGhpcy5pbnNlcnRpbmcgPSBmYWxzZTtcclxuICAgIHRoaXMuZWRpdGluZyA9IGZhbHNlO1xyXG4gIH07XHJcbiAgXHJcbiAgLyoqXHJcbiAgKiBQdXQgdGhlIGRhdGFzb3VyY2UgaW50byB0aGUgaW5zZXJ0aW5nIHN0YXRlXHJcbiAgKi9cclxuICB0aGlzLnN0YXJ0SW5zZXJ0aW5nID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5pbnNlcnRpbmcgPSB0cnVlO1xyXG4gICAgdGhpcy5hY3RpdmUgPSB7fTtcclxuICAgIGlmKHRoaXMub25TdGFydEluc2VydGluZyl7XHJcbiAgICAgIHRoaXMub25TdGFydEluc2VydGluZygpO1xyXG4gICAgfVxyXG4gIH07XHJcbiBcclxuICAvKipcclxuICAqIFB1dCB0aGUgZGF0YXNvdXJjZSBpbnRvIHRoZSBlZGl0aW5nIHN0YXRlXHJcbiAgKi9cclxuICB0aGlzLnN0YXJ0RWRpdGluZyA9IGZ1bmN0aW9uIChpdGVtKSB7XHJcbiAgICBpZihpdGVtKSB0aGlzLmFjdGl2ZSA9IHRoaXMuY29weShpdGVtKTtcclxuICAgIHRoaXMuZWRpdGluZyA9IHRydWU7XHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgKiBSZW1vdmUgYW4gb2JqZWN0IGZyb20gdGhpcyBkYXRhc2V0IGJ5IHVzaW5nIHRoZSBnaXZlbiBpZC5cclxuICAqIHRoZSBvYmplY3RzXHJcbiAgKi9cclxuICB0aGlzLnJlbW92ZSA9IGZ1bmN0aW9uIChvYmplY3QsIGNhbGxiYWNrKSB7XHJcbiAgICB2YXIgX3JlbW92ZSA9IGZ1bmN0aW9uKG9iamVjdCwgY2FsbGJhY2spIHtcclxuICAgICAgaWYoIW9iamVjdCkge1xyXG4gICAgICAgIG9iamVjdCA9IHRoaXMuYWN0aXZlO1xyXG4gICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgIHZhciBrZXlPYmogPSBnZXRLZXlWYWx1ZXMob2JqZWN0KTtcclxuICAgICAgXHJcbiAgICAgIHZhciBzdWZmaXhQYXRoID0gJyc7XHJcbiAgICAgIGZvcih2YXIga2V5IGluIGtleU9iaikge1xyXG4gICAgICAgIGlmKGtleU9iai5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XHJcbiAgICAgICAgICBzdWZmaXhQYXRoICs9ICcvJyArIGtleU9ialtrZXldO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIC8vIEZvciBlYWNoIHJvdyBkYXRhXHJcbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgLy8gSXRlcmF0ZSBhbGwga2V5cyBjaGVja2luZyBpZiB0aGUgXHJcbiAgICAgICAgICAvLyBjdXJyZW50IG9iamVjdCBtYXRjaCB3aXRoIHRoZSBzYW1lXHJcbiAgICAgICAgICAvLyB2ZXkgdmFsdWVzXHJcbiAgICAgICAgICAvLyBDaGVjayBhbGwga2V5c1xyXG4gICAgICAgICAgdmFyIGZvdW5kO1xyXG4gICAgICAgICAgZm9yKHZhciBrZXkgaW4ga2V5T2JqKSB7XHJcbiAgICAgICAgICAgIGlmKGtleU9iai5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XHJcbiAgICAgICAgICAgICAgaWYodGhpcy5kYXRhW2ldW2tleV0gJiYgdGhpcy5kYXRhW2ldW2tleV0gPT09IGtleU9ialtrZXldKSB7XHJcbiAgICAgICAgICAgICAgICBmb3VuZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIFRoZXJlJ3MgYSBkaWZmZXJlbmNlIGJldHdlZW4gdGhlIGN1cnJlbnQgb2JqZWN0XHJcbiAgICAgICAgICAgICAgICAvLyBhbmQgdGhlIGtleSB2YWx1ZXMgZXh0cmFjdGVkIGZyb20gdGhlIG9iamVjdFxyXG4gICAgICAgICAgICAgICAgLy8gdGhhdCB3ZSB3YW50IHRvIHJlbW92ZVxyXG4gICAgICAgICAgICAgICAgZm91bmQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmKGZvdW5kKSB7XHJcbiAgICAgICAgICAgIC8vIElmIGl0J3MgdGhlIG9iamVjdCB3ZSdyZSBsb2tpbmcgZm9yXHJcbiAgICAgICAgICAgIC8vIHJlbW92ZSBpdCBmcm9tIHRoZSBhcnJheVxyXG4gICAgICAgICAgICB0aGlzLmRhdGEuc3BsaWNlKGksMSk7XHJcbiAgICAgICAgICAgIHRoaXMuYWN0aXZlID0gKGkgPiAwKSA/IHRoaXMuZGF0YVtpIC0gMV0gOiBudWxsO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfS5iaW5kKHRoaXMpO1xyXG4gICAgICAgIFxyXG4gICAgICBzZXJ2aWNlLnJlbW92ZSh0aGlzLmVudGl0eSArIHN1ZmZpeFBhdGgpLiRwcm9taXNlLnRoZW4oY2FsbGJhY2spO1xyXG5cclxuICAgIH0uYmluZCh0aGlzKTtcclxuICAgIFxyXG4gICAgaWYodGhpcy5kZWxldGVNZXNzYWdlICYmIHRoaXMuZGVsZXRlTWVzc2FnZS5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGlmKHdpbmRvdy5jb25maXJtKHRoaXMuZGVsZXRlTWVzc2FnZSkpIHtcclxuICAgICAgICBfcmVtb3ZlKG9iamVjdCwgY2FsbGJhY2spOyBcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgX3JlbW92ZShvYmplY3QsIGNhbGxiYWNrKTtcclxuICAgIH1cclxuICB9O1xyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgb2JqZWN0IGtleXMgdmFsdWVzIGZyb20gdGhlIGRhdGFzb3VyY2Uga2V5bGlzdFxyXG4gICAqIFBSSVZBVEUgRlVOQ1RJT05cclxuICAgKi9cclxuICB2YXIgZ2V0S2V5VmFsdWVzID0gZnVuY3Rpb24ocm93RGF0YSkge1xyXG4gICAgdmFyIGtleVZhbHVlcyA9IHt9O1xyXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IHRoaXMua2V5cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICBrZXlWYWx1ZXNbdGhpcy5rZXlzW2ldXSA9IHJvd0RhdGFbdGhpcy5rZXlzW2ldXTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ga2V5VmFsdWVzO1xyXG4gIH0uYmluZCh0aGlzKTtcclxuICBcclxuICAvKipcclxuICAqIEFqYXggcmVxdWVzdCBIZWxwZXJcclxuICAqIFBSSVZBVEUgRlVOQ1RJT05cclxuICAqL1xyXG4gIHRoaXMucmVxdWVzdCA9IGZ1bmN0aW9uKHZlcmIsIHVybCwgYm9keSkge1xyXG4gICAgdmFyIG5vb3AgPSBmdW5jdGlvbigpIHt9O1xyXG5cclxuICAgIHZhciBfb25TdWNjZXNzID0gbm9vcDtcclxuICAgIHZhciBfb25FcnJvciA9IG5vb3A7XHJcblxyXG4gICAgdmFyIHByb21pc2UgPSB7XHJcbiAgICAgIHRoZW4gOiBmdW5jdGlvbihzdWNjZXNzQ2FsbGJhY2ssIGVycm9yQ2FsbGJhY2spIHtcclxuICAgICAgICBfb25TdWNjZXNzID0gc3VjY2Vzc0NhbGxiYWNrIHx8IF9vblN1Y2Nlc3M7XHJcbiAgICAgICAgX29uRXJyb3IgPSBlcnJvckNhbGxiYWNrIHx8IF9vbkVycm9yO1xyXG4gICAgICAgIHJldHVybiBwcm9taXNlO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBoYW5kbGVSZXF1ZXN0ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgIGlmKHRoaXMucmVhZHlTdGF0ZSA9PT0gNCkge1xyXG4gICAgICAgIGlmKHRoaXMuc3RhdHVzID49IDIwMCAmJiB0aGlzLnN0YXR1cyA8PSAyOTkpIHtcclxuICAgICAgICAgIF9vblN1Y2Nlc3MoeyBkYXRhIDogSlNPTi5wYXJzZSh0aGlzLnJlc3BvbnNlVGV4dCkgfSk7XHJcbiAgICAgICAgICBfb25FcnJvciA9IG5vb3A7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIF9vbkVycm9yKHsgZGF0YSA6IHRoaXMucmVzcG9uc2VUZXh0IH0pO1xyXG4gICAgICAgICAgX29uU3VjY2VzcyA9IG5vb3A7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcbiAgICByZXF1ZXN0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGhhbmRsZVJlcXVlc3Q7XHJcbiAgICByZXF1ZXN0Lm9wZW4odmVyYiwgdXJsLCB0cnVlKTtcclxuXHJcbiAgICBmb3IodmFyIGF0dHJpYnV0ZSBpbiB0aGlzLmhlYWRlcnMpIHtcclxuICAgICAgaWYodGhpcy5oZWFkZXJzLmhhc093blByb3BlcnR5KGF0dHJpYnV0ZSkpIHtcclxuICAgICAgICByZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoYXR0cmlidXRlLCB0aGlzLmhlYWRlcnNbYXR0cmlidXRlXSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXF1ZXN0LnNlbmQoKGJvZHkpID8gSlNPTi5zdHJpbmdpZnkoYm9keSkgOiBudWxsKTtcclxuXHJcbiAgICByZXR1cm4gcHJvbWlzZTtcclxuICB9O1xyXG5cclxuICAvKipcclxuICAqIENoZWNrIGlmIHRoZSBvYmplY3QgaGFzIG1vcmUgaXRlbnMgdG8gaXRlcmF0ZVxyXG4gICovXHJcbiAgdGhpcy5oYXNOZXh0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZGF0YSAmJiAoY3Vyc29yIDwgdGhpcy5kYXRhLmxlbmd0aCAtIDEpO1xyXG4gIH07XHJcblxyXG4gIC8qKlxyXG4gICogQ2hlY2sgaWYgdGhlIGN1cnNvciBpcyBub3QgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgZGF0YXNvdXJjZVxyXG4gICovXHJcbiAgdGhpcy5oYXNQcmV2aW91cyA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiB0aGlzLmRhdGEgJiYgKGN1cnNvciA+IDApO1xyXG4gIH07XHJcblxyXG4gIC8qKlxyXG4gICogQ2hlY2sgaWYgdGhlIG9iamVjdCBoYXMgbW9yZSBpdGVucyB0byBpdGVyYXRlXHJcbiAgKi9cclxuICB0aGlzLm9yZGVyID0gZnVuY3Rpb24gKG9yZGVyKSB7XHJcbiAgICBfc2F2ZWRQcm9wcy5vcmRlciA9IG9yZGVyO1xyXG4gIH07XHJcblxyXG4gIC8qKlxyXG4gICogR2V0IHRoZSB2YWx1ZXMgb2YgdGhlIGFjdGl2ZSByb3cgYXMgYW4gYXJyYXkuXHJcbiAgKiBUaGlzIG1ldGhvZCB3aWxsIGlnbm9yZSBhbnkga2V5cyBhbmQgb25seSByZXR1cm4gdGhlIHZhbHVlc1xyXG4gICovXHJcbiAgdGhpcy5nZXRBY3RpdmVWYWx1ZXMgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLmdldFJvd1ZhbHVlcyh0aGlzLmFjdGl2ZSk7XHJcbiAgfTtcclxuXHJcbiAgdGhpcy5fX2RlZmluZUdldHRlcl9fKCdhY3RpdmVWYWx1ZXMnLCBmdW5jdGlvbigpIHsgcmV0dXJuIF9zZWxmLmdldEFjdGl2ZVZhbHVlcygpOyB9KTtcclxuXHJcbiAgLyoqXHJcbiAgKiBHZXQgdGhlIHZhbHVlcyBvZiB0aGUgZ2l2ZW4gcm93XHJcbiAgKi9cclxuICB0aGlzLmdldFJvd1ZhbHVlcyA9IGZ1bmN0aW9uKHJvd0RhdGEpIHtcclxuICAgIHZhciBhcnIgPSBbXTtcclxuICAgIGZvciggdmFyIGkgaW4gcm93RGF0YSApIHtcclxuICAgICAgaWYgKHJvd0RhdGEuaGFzT3duUHJvcGVydHkoaSkpe1xyXG4gICAgICAgIGFyci5wdXNoKHJvd0RhdGFbaV0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYXJyO1xyXG4gIH07XHJcblxyXG4gIC8qKlxyXG4gICogIEdldCB0aGUgY3VycmVudCBpdGVtIG1vdmluZyB0aGUgY3Vyc29yIHRvIHRoZSBuZXh0IGVsZW1lbnRcclxuICAqL1xyXG4gIHRoaXMubmV4dCA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGlmKCF0aGlzLmhhc05leHQoKSkge1xyXG4gICAgICB0aGlzLm5leHRQYWdlKCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLmFjdGl2ZSA9IHRoaXMuY29weSh0aGlzLmRhdGFbKytjdXJzb3JdLHt9KTtcclxuICAgIHJldHVybiB0aGlzLmFjdGl2ZTtcclxuICB9O1xyXG4gIFxyXG4gIC8qKlxyXG4gICogIFRyeSB0byBmZXRjaCB0aGUgcHJldmlvdXMgcGFnZVxyXG4gICovXHJcbiAgdGhpcy5uZXh0UGFnZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGlmKCF0aGlzLmhhc05leHRQYWdlKCkpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5vZmZzZXQgPSBwYXJzZUludCh0aGlzLm9mZnNldCkgKyBwYXJzZUludCh0aGlzLnJvd3NQZXJQYWdlKTsgXHJcbiAgICB0aGlzLmZldGNoKF9zYXZlZFByb3BzLCB7IFxyXG4gICAgICBzdWNjZXNzOiBmdW5jdGlvbihkYXRhKSB7XHJcbiAgICAgICAgaWYoIWRhdGEgfHwgZGF0YS5sZW5ndGggPCBwYXJzZUludCh0aGlzLnJvd3NQZXJQYWdlKSkge1xyXG4gICAgICAgICAgdGhpcy5vZmZzZXQgPSBwYXJzZUludCh0aGlzLm9mZnNldCkgLSB0aGlzLmRhdGEubGVuZ3RoOyBcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH07XHJcbiAgXHJcbiAgLyoqXHJcbiAgKiAgVHJ5IHRvIGZldGNoIHRoZSBwcmV2aW91cyBwYWdlXHJcbiAgKi9cclxuICB0aGlzLnByZXZQYWdlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgaWYoIXRoaXMuYXBwZW5kICYmICF0aGlzLnByZXBwZW5kKSB7XHJcbiAgICAgIHRoaXMub2Zmc2V0ID0gcGFyc2VJbnQodGhpcy5vZmZzZXQpIC0gdGhpcy5kYXRhLmxlbmd0aDsgXHJcbiAgICAgIFxyXG4gICAgICBpZih0aGlzLm9mZnNldCA8IDApIHtcclxuICAgICAgICB0aGlzLm9mZnNldCA9IDA7XHJcbiAgICAgIH0gZWxzZSBpZih0aGlzLm9mZnNldCA+PSAwKSB7XHJcbiAgICAgICAgdGhpcy5mZXRjaChfc2F2ZWRQcm9wcywge1xyXG4gICAgICAgICAgc3VjY2VzczogZnVuY3Rpb24oZGF0YSkge1xyXG4gICAgICAgICAgICBpZighZGF0YSB8fCBkYXRhLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgIHRoaXMub2Zmc2V0ID0gMDsgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0gXHJcbiAgICAgICAgfSk7IFxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfTtcclxuICBcclxuICAvKipcclxuICAqICBDaGVjayBpZiBoYXMgbW9yZSBwYWdlc1xyXG4gICovXHJcbiAgdGhpcy5oYXNOZXh0UGFnZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiBoYXNNb3JlUmVzdWx0cyAmJiAodGhpcy5yb3dzUGVyUGFnZSAhPSAtMSk7XHJcbiAgfTtcclxuICBcclxuICAvKipcclxuICAqICBDaGVjayBpZiBoYXMgcHJldmlld3MgcGFnZXNcclxuICAqL1xyXG4gIHRoaXMuaGFzUHJldlBhZ2UgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vZmZzZXQgPiAwICYmICF0aGlzLmFwcGVuZCAmJiAhdGhpcy5wcmVwZW5kO1xyXG4gIH07ICAgICAgXHJcblxyXG4gIC8qKlxyXG4gICogIEdldCB0aGUgcHJldmlvdXMgaXRlbVxyXG4gICovXHJcbiAgdGhpcy5wcmV2aW91cyA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGlmKCF0aGlzLmhhc1ByZXZpb3VzKCkpIHRocm93ICdEYXRhc2V0IE92ZXJmbG9yIEVycm9yJztcclxuICAgIHRoaXMuYWN0aXZlID0gdGhpcy5jb3B5KHRoaXMuZGF0YVstLWN1cnNvcl0se30pO1xyXG4gICAgcmV0dXJuIHRoaXMuYWN0aXZlO1xyXG4gIH07XHJcblxyXG4gIC8qKlxyXG4gICogIE1vdmVzIHRoZSBjdXJzb3IgdG8gdGhlIHNwZWNpZmllZCBpdGVtXHJcbiAgKi9cclxuICB0aGlzLmdvVG8gPSBmdW5jdGlvbiAocm93SWQpIHtcclxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcclxuICAgICAgaWYodGhpcy5kYXRhW2ldW3RoaXMua2V5XSA9PT0gcm93SWQpIHtcclxuICAgICAgICBjdXJzb3IgPSBpO1xyXG4gICAgICAgIHRoaXMuYWN0aXZlID0gdGhpcy5jb3B5KHRoaXMuZGF0YVtjdXJzb3JdLHt9KTtcclxuICAgICAgICByZXR1cm4gdGhpcy5hY3RpdmU7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9O1xyXG5cclxuICAvKipcclxuICAqICBHZXQgdGhlIGN1cnJlbnQgY3Vyc29yIGluZGV4XHJcbiAgKi9cclxuICB0aGlzLmdldEN1cnNvciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiBjdXJzb3I7XHJcbiAgfTtcclxuICBcclxuICAvKipcclxuICAqICBmaWx0ZXIgZGF0YXNldCBieSBVUkxcclxuICAqL1xyXG4gIHRoaXMuZmlsdGVyID0gZnVuY3Rpb24gKCB1cmwgKSB7XHJcbiAgICB2YXIgb2xkb2Zmc2V0ID0gdGhpcy5vZmZzZXQ7XHJcbiAgICB0aGlzLm9mZnNldCA9IDA7XHJcbiAgICB0aGlzLmZldGNoKHsgcGF0aDogdXJsIH0sIHsgYmVmb3JlRmlsbDogZnVuY3Rpb24oKSB7XHJcbiAgICAgIHRoaXMuY2xlYW51cCgpOyBcclxuICAgIH0sIGVycm9yIDogZnVuY3Rpb24oKSB7XHJcbiAgICAgIHRoaXMub2Zmc2V0ID0gb2xkb2Zmc2V0OyAgXHJcbiAgICB9fSk7XHJcbiAgfTtcclxuICBcclxuICAvKipcclxuICAgKiBDbGVhbnVwIGRhdGFzb3VyY2UgIFxyXG4gICAqL1xyXG4gIHRoaXMuY2xlYW51cCA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMub2Zmc2V0ID0gMDtcclxuICAgIHRoaXMuZGF0YSA9IFtdO1xyXG4gICAgdGhpcy5jdXJzb3IgPSAtMTtcclxuICAgIHRoaXMuYWN0aXZlID0gbnVsbDtcclxuICAgIGhhc01vcmVSZXN1bHRzID0gZmFsc2U7XHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgKiAgR2V0IHRoZSBjdXJyZW50IHJvdyBkYXRhXHJcbiAgKi9cclxuICB0aGlzLmN1cnJlbnQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4gdGhpcy5hY3RpdmUgfHwgdGhpcy5kYXRhWzBdO1xyXG4gIH07XHJcblxyXG4gIC8qKlxyXG4gICogIEZldGNoIGFsbCBkYXRhIGZyb20gdGhlIHNlcnZlclxyXG4gICovXHJcbiAgdGhpcy5mZXRjaCA9IGZ1bmN0aW9uIChwcm9wZXJ0aWVzLCBjYWxsYmFja3NPYmopIHtcclxuICAgIFxyXG4gICAgLy8gSWdub3JlIGFueSBjYWxsIGlmIHRoZSBkYXRhc291cmNlIGlzIGJ1c3kgKGZldGNoaW5nIGFub3RoZXIgcmVxdWVzdClcclxuICAgIGlmKHRoaXMuYnVzeSkgcmV0dXJuO1xyXG4gICAgXHJcbiAgICBpZighdGhpcy5lbmFibGVkKSB7XHJcbiAgICAgIHRoaXMuY2xlYW51cCgpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHZhciBwcm9wcyA9IHByb3BlcnRpZXMgfHwge307XHJcbiAgICB2YXIgY2FsbGJhY2tzID0gY2FsbGJhY2tzT2JqIHx8IHt9O1xyXG5cclxuICAgIC8vIEFkanVzdCBwcm9wZXJ0eSBwYXJhbWV0ZXJzIGFuZCB0aGUgZW5kcG9pbnQgdXJsXHJcbiAgICBwcm9wcy5wYXJhbXMgPSBwcm9wcy5wYXJhbXMgfHwge307XHJcbiAgICB2YXIgcmVzb3VyY2VVUkwgPSB0aGlzLmVudGl0eSArIChwcm9wcy5wYXRoIHx8ICcnKTtcclxuICAgIFxyXG4gICAgLy8gU2V0IExpbWl0IGFuZCBvZmZzZXRcclxuICAgIGlmKHRoaXMucm93c1BlclBhZ2UgPiAwKSB7XHJcbiAgICAgIHByb3BzLnBhcmFtcy5saW1pdCA9IHRoaXMucm93c1BlclBhZ2U7XHJcbiAgICAgIHByb3BzLnBhcmFtcy5vZmZzZXQgPSB0aGlzLm9mZnNldDtcclxuICAgIH1cclxuICAgICAgICAgICBcclxuICAgIC8vIFN0b3JlIHRoZSBsYXN0IGNvbmZpZ3VyYXRpb24gZm9yIGxhdGUgdXNlXHJcbiAgICBfc2F2ZWRQcm9wcyA9IHByb3BzO1xyXG4gICAgXHJcbiAgICAvLyBNYWtlIHRoZSBkYXRhc291cmNlIGJ1c3lcclxuICAgIGJ1c3kgPSB0cnVlO1xyXG4gICAgXHJcbiAgICAvLyBHZXQgYW4gYWpheCBwcm9taXNlXHJcbiAgICB0aGlzLiRwcm9taXNlID0gdGhpcy5yZXF1ZXN0KCdHRVQnLCByZXNvdXJjZVVSTCwgcHJvcHMucGFyYW1zKVxyXG4gICAgLnRoZW4oXHJcbiAgICAgIC8vIFN1Y2Nlc3MgSGFuZGxlclxyXG4gICAgICBmdW5jdGlvbihyZXNwb25zZSkge1xyXG4gICAgICAgIGJ1c3kgPSBmYWxzZTtcclxuICAgICAgICBzdWNlc3NIYW5kbGVyKHJlc3BvbnNlLmRhdGEpO1xyXG4gICAgICB9LmJpbmQodGhpcyksXHJcbiAgICAgIC8vIEVycm9yIEhhbmRsZXJcclxuICAgICAgZnVuY3Rpb24ocmVzcG9uc2Upe1xyXG4gICAgICAgIGJ1c3kgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLmhhbmRsZUVycm9yKHJlc3BvbnNlLmRhdGEpO1xyXG4gICAgICAgIGlmKGNhbGxiYWNrcy5lcnJvcikgY2FsbGJhY2tzLmVycm9yLmNhbGwodGhpcywgcmVzcG9uc2UuZGF0YSk7XHJcbiAgICAgIH0uYmluZCh0aGlzKVxyXG4gICAgKTtcclxuICAgIFxyXG4gICAgLy8gU3VjY2VzcyBIYW5kbGVyXHJcbiAgICB2YXIgc3VjZXNzSGFuZGxlciA9IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgIGlmKGRhdGEpIHtcclxuICAgICAgICBpZihPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoIGRhdGEgKSAhPT0gJ1tvYmplY3QgQXJyYXldJyApIHtcclxuICAgICAgICAgIGRhdGEgPSBbZGF0YV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIENhbGwgdGhlIGJlZm9yZSBmaWxsIGNhbGxiYWNrXHJcbiAgICAgICAgaWYoY2FsbGJhY2tzLmJlZm9yZUZpbGwpIGNhbGxiYWNrcy5iZWZvcmVGaWxsLmFwcGx5KHRoaXMsIHRoaXMuZGF0YSk7XHJcblxyXG4gICAgICAgIC8vIElmIHByZXBlbmQgcHJvcGVydHkgd2FzIHNldC4gXHJcbiAgICAgICAgLy8gQWRkIHRoZSBuZXcgZGF0YSBiZWZvcmUgdGhlIG9sZCBvbmVcclxuICAgICAgICBpZih0aGlzLnByZXBlbmQpIHRoaXMuZGF0YSA9IGRhdGEuY29uY2F0KHRoaXMuZGF0YSk7ICBcclxuXHJcbiAgICAgICAgLy8gSWYgYXBwZW5kIHByb3BlcnR5IHdhcyBzZXQuIFxyXG4gICAgICAgIC8vIEFkZCB0aGUgbmV3IGRhdGEgYWZ0ZXIgdGhlIG9sZCBvbmVcclxuICAgICAgICBpZih0aGlzLmFwcGVuZCkgdGhpcy5kYXRhID0gdGhpcy5kYXRhLmNvbmNhdChkYXRhKTtcclxuXHJcbiAgICAgICAgLy8gV2hlbiBuZWl0aGVyICBub3IgcHJlcHBlbmQgd2FzIHNldFxyXG4gICAgICAgIC8vIEp1c3QgcmVwbGFjZSB0aGUgY3VycmVudCBkYXRhXHJcbiAgICAgICAgaWYoIXRoaXMucHJlcGVuZCAmJiAhdGhpcy5hcHBlbmQpIHtcclxuICAgICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XHJcbiAgICAgICAgICB0aGlzLmFjdGl2ZSA9IGRhdGFbMF07XHJcbiAgICAgICAgICBjdXJzb3IgPSAwO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZihjYWxsYmFja3Muc3VjY2VzcykgY2FsbGJhY2tzLnN1Y2Nlc3MuY2FsbCh0aGlzLCBkYXRhKTtcclxuICAgICAgICBcclxuICAgICAgICBoYXNNb3JlUmVzdWx0cyA9IChkYXRhLmxlbmd0aCA+PSB0aGlzLnJvd3NQZXJQYWdlKTtcclxuICAgICAgfSBcclxuICAgIH0uYmluZCh0aGlzKTtcclxuICB9O1xyXG5cclxuXHJcbiAgLyoqXHJcbiAgKiBDbG9uZSBhIEpTT04gT2JqZWN0XHJcbiAgKi9cclxuICB0aGlzLmNvcHkgPSBmdW5jdGlvbiAoZnJvbSx0bykge1xyXG4gICAgaWYoZnJvbSA9PT0gbnVsbCB8fCBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoZnJvbSkgIT09ICdbb2JqZWN0IE9iamVjdF0nKVxyXG4gICAgICByZXR1cm4gZnJvbTtcclxuXHJcbiAgICB0byA9IHRvIHx8IHt9OyBcclxuXHJcbiAgICBmb3IodmFyIGtleSBpbiBmcm9tKSB7XHJcbiAgICAgIGlmKGZyb20uaGFzT3duUHJvcGVydHkoa2V5KSAmJiBrZXkuaW5kZXhPZignJCcpPT0tMSkge1xyXG4gICAgICAgIHRvW2tleV0gPSB0aGlzLmNvcHkoZnJvbVtrZXldKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRvO1xyXG4gIH07XHJcbn07IiwidmFyIERhdGFzb3VyY2UgPSByZXF1aXJlKCcuL2NvcmUvZGF0YXNvdXJjZS5qcycpO1xyXG5cclxuYW5ndWxhci5tb2R1bGUoJ2RhdGFzb3VyY2VqcycsW10pXHJcblxyXG4uZmFjdG9yeSgnRGF0YXNvdXJjZU1hbmFnZXInLCBbJyRodHRwJywnJHEnLCAnJHRpbWVvdXQnLCckcm9vdFNjb3BlJywgZnVuY3Rpb24oJGh0dHAsICRxLCAkdGltZW91dCwgJHJvb3RTY29wZSkge1xyXG4gICd1c2Ugc3RyaWN0JztcclxuXHJcbiAgLy8gR2xvYmFsIGRhdGFzb3VyY2UgTGlzdFxyXG4gIHRoaXMuZGF0YXNvdXJjZXMgPSB7fTtcclxuXHJcbiAgLyoqXHJcbiAgICAqIERhdGFzb3VyY2UgTWFuYWdlciBNZXRob2RzXHJcbiAgICAqL1xyXG4gIHRoaXMuc3RvcmVEYXRhc291cmNlID0gZnVuY3Rpb24gKGRhdGFzb3VyY2UpIHtcclxuICAgIHRoaXMuZGF0YXNvdXJjZXNbZGF0YXNvdXJjZS5uYW1lXSA9IGRhdGFzb3VyY2U7XHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgKiBJbml0aWFsaXplIGEgbmV3IGRhdGFzb3VyY2VcclxuICAqL1xyXG4gIHRoaXMuaW5pdERhdGFzb3VyY2UgPSBmdW5jdGlvbiAocHJvcHMpIHtcclxuICAgIHZhciBkdHMgPSBuZXcgRGF0YXNvdXJjZShwcm9wcy5uYW1lKTtcclxuICAgIFxyXG4gICAgLy8gT3ZlcnJpZGUgZGF0YXNvdXJjZSByZXF1ZXN0IG1ldGhvZC5cclxuICAgIC8vIFdlIHdhbnQgdG8gbGV0IEFuZ3VsYXIgJGh0dHAgbW9kdWxlIGhhbmRsZSBcclxuICAgIC8vIHJlcXVlc3RzIGluc3RlYWQgb2YgdGhlIGRlZmF1bHQgWE1MSHR0cFJlcXVlc3RcclxuICAgIGR0cy5yZXF1ZXN0ID0gZnVuY3Rpb24odmVyYiwgdXJsLCBvYmplY3QpIHtcclxuICAgICAgcmV0dXJuICRodHRwKHtcclxuICAgICAgICBtZXRob2Q6IHZlcmIsXHJcbiAgICAgICAgdXJsOiB1cmwsXHJcbiAgICAgICAgZGF0YSA6IChvYmplY3QpID8gSlNPTi5zdHJpbmdpZnkob2JqZWN0KSA6IG51bGwsXHJcbiAgICAgICAgaGVhZGVyczogdGhpcy5oZWFkZXJzXHJcbiAgICAgIH0pO1xyXG4gICAgfTtcclxuXHJcbiAgICBkdHMuZW50aXR5ID0gcHJvcHMuZW50aXR5O1xyXG4gICAgZHRzLmtleXMgPSAocHJvcHMua2V5cyAmJiBwcm9wcy5rZXlzLmxlbmd0aCA+IDApID8gcHJvcHMua2V5cy5zcGxpdCgnLCcpIDogW107XHJcbiAgICBkdHMucm93c1BlclBhZ2UgPSBwcm9wcy5yb3dzUGVyUGFnZSA/IHByb3BzLnJvd3NQZXJQYWdlIDogMTAwOyAvLyBEZWZhdWx0IDEwMCByb3dzIHBlciBwYWdlXHJcbiAgICBkdHMuYXBwZW5kID0gcHJvcHMuYXBwZW5kO1xyXG4gICAgZHRzLnByZXBlbmQgPSBwcm9wcy5wcmVwZW5kO1xyXG4gICAgZHRzLmVuZHBvaW50ID0gcHJvcHMuZW5kcG9pbnQ7XHJcbiAgICBkdHMuZmlsdGVyVVJMID0gcHJvcHMuZmlsdGVyVVJMO1xyXG4gICAgZHRzLmF1dG9Qb3N0ID0gcHJvcHMuYXV0b1Bvc3Q7XHJcbiAgICBkdHMuZGVsZXRlTWVzc2FnZSA9IHByb3BzLmRlbGV0ZU1lc3NhZ2U7XHJcbiAgICBkdHMuZW5hYmxlZCA9IHByb3BzLmVuYWJsZWQ7XHJcbiAgICBkdHMub2Zmc2V0ID0gKHByb3BzLm9mZnNldCkgPyBwcm9wcy5vZmZzZXQgOiAwOyAvLyBEZWZhdWx0IG9mZnNldCBpcyAwXHJcblxyXG4gICAgXHJcbiAgICAvLyBDaGVjayBmb3IgaGVhZGVyc1xyXG4gICAgaWYocHJvcHMuaGVhZGVycyAmJiBwcm9wcy5oZWFkZXJzLmxlbmd0aCA+IDApIHtcclxuICAgICAgZHRzLmhlYWRlcnMgPSB7fTtcclxuICAgICAgdmFyIGhlYWRlcnMgPSBwcm9wcy5oZWFkZXJzLnRyaW0oKS5zcGxpdCgnOycpO1xyXG4gICAgICB2YXIgaGVhZGVyO1xyXG4gICAgICBmb3IodmFyIGkgPSAwOyBpIDwgaGVhZGVycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGhlYWRlciA9IGhlYWRlcnNbaV0uc3BsaXQoJzonKTtcclxuICAgICAgICBpZihoZWFkZXIubGVuZ3RoID09PSAyKSB7XHJcbiAgICAgICAgICBkdHMuaGVhZGVyc1toZWFkZXJbMF1dID0gaGVhZGVyWzFdOyAgXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEluaXRcclxuICAgIGR0cy5pbml0KCk7XHJcbiAgICB0aGlzLnN0b3JlRGF0YXNvdXJjZShkdHMpO1xyXG5cclxuICAgIGlmKCFwcm9wcy5sYXp5ICYmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwocHJvcHMud2F0Y2gpICE9PSAnW29iamVjdCBTdHJpbmddJykgJiYgIXByb3BzLmZpbHRlclVSTCkge1xyXG4gICAgICAvLyBRdWVyeSBzdHJpbmcgb2JqZWN0XHJcbiAgICAgIHZhciBxdWVyeU9iaiA9IHt9O1xyXG5cclxuICAgICAgLy8gRmlsbCB0aGUgZGF0YXNvdXJjZVxyXG4gICAgICBkdHMuZmV0Y2goe3BhcmFtczogcXVlcnlPYmp9LCB7c3VjY2VzczogZnVuY3Rpb24oZGF0YSkge1xyXG4gICAgICAgIGlmIChkYXRhICYmIGRhdGEubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgdGhpcy5hY3RpdmUgPSBkYXRhWzBdO1xyXG4gICAgICAgICAgdGhpcy5jdXJzb3IgPSAwO1xyXG4gICAgICAgIH1cclxuICAgICAgfX0pO1xyXG4gICAgfVxyXG4gICAgICBcclxuICAgIGlmKHByb3BzLmxhenkgJiYgcHJvcHMuYXV0b1Bvc3QpIHtcclxuICAgICAgZHRzLnN0YXJ0QXV0b1Bvc3QoKTtcclxuICAgIH1cclxuXHJcbiAgICBpZihwcm9wcy53YXRjaCAmJiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwocHJvcHMud2F0Y2gpID09PSAnW29iamVjdCBTdHJpbmddJykge1xyXG4gICAgICB0aGlzLnJlZ2lzdGVyT2JzZXJ2ZXIocHJvcHMud2F0Y2gsIGR0cyk7XHJcbiAgICAgIGR0cy53YXRjaEZpbHRlciA9IHByb3BzLndhdGNoRmlsdGVyO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBGaWx0ZXIgdGhlIGRhdGFzZXQgaWYgdGhlIGZpbHRlciBwcm9wZXJ0eSB3YXMgc2V0XHJcbiAgICBpZihwcm9wcy5maWx0ZXJVUkwgJiYgcHJvcHMuZmlsdGVyVVJMLmxlbmd0aCA+IDApIHsgXHJcbiAgICAgIGR0cy5maWx0ZXIocHJvcHMuZmlsdGVyVVJMKTtcclxuICAgIH1cclxuXHJcbiAgICAkcm9vdFNjb3BlLiR3YXRjaChmdW5jdGlvbigpIHsgXHJcbiAgICAgIHJldHVybiBkdHMuYWN0aXZlOyBcclxuICAgIH0sXHJcbiAgICBmdW5jdGlvbigpIHtcclxuICAgICAgZHRzLl9hY3RpdmVWYWx1ZXMgPSBkdHMuZ2V0Um93VmFsdWVzKHRoaXMuYWN0aXZlKTtcclxuICAgIH0sIHRydWUpO1xyXG5cclxuICAgIC8vIEFkZCB0aGlzIGluc3RhbmNlIGludG8gdGhlIHJvb3Qgc2NvcGVcclxuICAgIC8vIFRoaXMgd2lsbCBleHBvc2UgdGhlIGRhdGFzZXQgbmFtZSBhcyBhXHJcbiAgICAvLyBnbG9iYWwgdmFyaWFibGVcclxuICAgIGlmKHByb3BzLmdsb2JhbCAhPT0gJ2ZhbHNlJykge1xyXG4gICAgICAkcm9vdFNjb3BlW2R0cy5uYW1lXSA9IGR0cztcclxuICAgICAgd2luZG93W2R0cy5uYW1lXSA9IGR0cztcclxuICAgIH1cclxuXHJcbiAgICBcclxuICAgIHJldHVybiBkdHM7XHJcbiAgfTtcclxuXHJcbiAgcmV0dXJuIHRoaXM7XHJcbn1dKVxyXG5cclxuLyoqXHJcbiogQ3JvbnVzIERhdGFzZXQgRGlyZWN0aXZlXHJcbiovXHJcbi5kaXJlY3RpdmUoJ2RhdGFzb3VyY2UnLFsnRGF0YXNvdXJjZU1hbmFnZXInLCckdGltZW91dCcsIGZ1bmN0aW9uIChEYXRhc291cmNlTWFuYWdlciwkdGltZW91dCkge1xyXG4gIHJldHVybiB7XHJcbiAgICByZXN0cmljdDogJ0UnLFxyXG4gICAgc2NvcGU6IHRydWUsXHJcbiAgICB0ZW1wbGF0ZTogJycsXHJcbiAgICBsaW5rOiBmdW5jdGlvbiggc2NvcGUsIGVsZW1lbnQsIGF0dHJzICkge1xyXG4gICAgICB2YXIgaW5pdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgcHJvcHMgPSB7XHJcbiAgICAgICAgICBuYW1lOiBhdHRycy5uYW1lLFxyXG4gICAgICAgICAgZW50aXR5OiBhdHRycy5lbnRpdHksXHJcbiAgICAgICAgICBlbmFibGVkOiAoYXR0cnMuaGFzT3duUHJvcGVydHkoJ2VuYWJsZWQnKSkgPyAoYXR0cnMuZW5hYmxlZCA9PT0gJ3RydWUnKSA6IHRydWUsXHJcbiAgICAgICAgICBrZXlzOiBhdHRycy5rZXlzLFxyXG4gICAgICAgICAgZW5kcG9pbnQ6IGF0dHJzLmVuZHBvaW50LFxyXG4gICAgICAgICAgbGF6eTogKGF0dHJzLmhhc093blByb3BlcnR5KCdsYXp5JykgJiYgYXR0cnMubGF6eSA9PT0gJycpIHx8IGF0dHJzLmxhenkgPT09ICd0cnVlJyxcclxuICAgICAgICAgIGFwcGVuZDogIWF0dHJzLmhhc093blByb3BlcnR5KCdhcHBlbmQnKSB8fCBhdHRycy5hcHBlbmQgPT09ICd0cnVlJyxcclxuICAgICAgICAgIHByZXBlbmQ6IChhdHRycy5oYXNPd25Qcm9wZXJ0eSgncHJlcGVuZCcpICYmIGF0dHJzLnByZXBlbmQgPT09ICcnKSB8fCBhdHRycy5wcmVwZW5kID09PSAndHJ1ZScsXHJcbiAgICAgICAgICB3YXRjaDogYXR0cnMud2F0Y2gsXHJcbiAgICAgICAgICByb3dzUGVyUGFnZTogYXR0cnMucm93c1BlclBhZ2UsXHJcbiAgICAgICAgICBvZmZzZXQ6IGF0dHJzLm9mZnNldCxcclxuICAgICAgICAgIGZpbHRlclVSTCA6IGF0dHJzLmZpbHRlcixcclxuICAgICAgICAgIHdhdGNoRmlsdGVyOiBhdHRycy53YXRjaEZpbHRlcixcclxuICAgICAgICAgIGRlbGV0ZU1lc3NhZ2U6IGF0dHJzLmRlbGV0ZU1lc3NhZ2UsXHJcbiAgICAgICAgICBoZWFkZXJzIDogYXR0cnMuaGVhZGVycyxcclxuICAgICAgICAgIGF1dG9Qb3N0IDogKGF0dHJzLmhhc093blByb3BlcnR5KCdhdXRvUG9zdCcpICYmIGF0dHJzLmF1dG9Qb3N0ID09PSAnJykgfHwgYXR0cnMuYXV0b1Bvc3QgPT09ICd0cnVlJ1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGZpcnN0TG9hZCA9IHtcclxuICAgICAgICAgIGZpbHRlcjogdHJ1ZSxcclxuICAgICAgICAgIGVudGl0eTogdHJ1ZSxcclxuICAgICAgICAgIGVuYWJsZWQ6IHRydWVcclxuICAgICAgICB9O1xyXG4gICAgICAgIHZhciBkYXRhc291cmNlID0gRGF0YXNvdXJjZU1hbmFnZXIuaW5pdERhdGFzb3VyY2UocHJvcHMpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aW1lb3V0UHJvbWlzZTtcclxuICAgICAgICBhdHRycy4kb2JzZXJ2ZSgnZmlsdGVyJywgZnVuY3Rpb24oIHZhbHVlICl7XHJcbiAgICAgICAgICBpZiAoIWZpcnN0TG9hZC5maWx0ZXIpIHtcclxuICAgICAgICAgICAgLy8gU3RvcCB0aGUgcGVuZGluZyB0aW1lb3V0XHJcbiAgICAgICAgICAgICR0aW1lb3V0LmNhbmNlbCh0aW1lb3V0UHJvbWlzZSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBTdGFydCBhIHRpbWVvdXRcclxuICAgICAgICAgICAgdGltZW91dFByb21pc2UgPSAkdGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICBkYXRhc291cmNlLmZpbHRlcih2YWx1ZSk7XHJcbiAgICAgICAgICAgIH0sIDIwMCk7XHJcbiAgICAgICAgICB9IGVsc2UgeyAgICBcclxuICAgICAgICAgICAgJHRpbWVvdXQoZnVuY3Rpb24oKSB7IGZpcnN0TG9hZC5maWx0ZXIgPSBmYWxzZTsgfSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgYXR0cnMuJG9ic2VydmUoJ2VuYWJsZWQnLCBmdW5jdGlvbiggdmFsdWUgKXtcclxuICAgICAgICAgIGlmICghZmlyc3RMb2FkLmVuYWJsZWQpIHtcclxuICAgICAgICAgICAgZGF0YXNvdXJjZS5lbmFibGVkID0gKHZhbHVlID09PSAndHJ1ZScpO1xyXG4gICAgICAgICAgICBkYXRhc291cmNlLmZldGNoKHtwYXJhbXM6e319KTtcclxuICAgICAgICAgIH0gZWxzZSB7ICAgIFxyXG4gICAgICAgICAgICAkdGltZW91dChmdW5jdGlvbigpIHsgZmlyc3RMb2FkLmVuYWJsZWQgPSBmYWxzZTsgfSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgYXR0cnMuJG9ic2VydmUoJ2VudGl0eScsIGZ1bmN0aW9uKCB2YWx1ZSApe1xyXG4gICAgICAgICAgZGF0YXNvdXJjZS5lbnRpdHkgPSB2YWx1ZTtcclxuICAgICAgICAgIGlmICghZmlyc3RMb2FkLmVudGl0eSkge1xyXG4gICAgICAgICAgICAvLyBPbmx5IGZldGNoIGlmIGl0J3Mgbm90IHRoZSBmaXJzdCBsb2FkXHJcbiAgICAgICAgICAgIGRhdGFzb3VyY2UuZmV0Y2goe3BhcmFtczp7fX0pO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgJHRpbWVvdXQoZnVuY3Rpb24oKSB7IGZpcnN0TG9hZC5lbnRpdHkgPSBmYWxzZTsgfSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH07XHJcbiAgICAgIGluaXQoKTtcclxuICAgIH1cclxuICB9O1xyXG59XSlcclxuXHJcbi5kaXJlY3RpdmUoJ2RhdGFzb3VyY2VOYW1lJyxbJ0RhdGFzb3VyY2VNYW5hZ2VyJywnJHBhcnNlJywgZnVuY3Rpb24oRGF0YXNvdXJjZU1hbmFnZXIsJHBhcnNlKSB7XHJcbiAgcmV0dXJuIHtcclxuICAgIHJlc3RyaWN0OiAnQScsXHJcbiAgICBzY29wZTogdHJ1ZSxcclxuICAgIGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRycykge1xyXG4gICAgICBzY29wZS5kYXRhID0gRGF0YXNvdXJjZU1hbmFnZXIuZGF0YXNvdXJjZXM7XHJcbiAgICAgIGlmKHNjb3BlLmRhdGFbYXR0cnMuZGF0YXNvdXJjZU5hbWVdKSB7XHJcbiAgICAgICAgc2NvcGUuZGF0YXNvdXJjZSA9IHNjb3BlLmRhdGFbYXR0cnMuZGF0YXNvdXJjZU5hbWVdO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHNjb3BlLmRhdGFzb3VyY2UgPSB7fTtcclxuICAgICAgICBzY29wZS5kYXRhc291cmNlLmRhdGEgPSAkcGFyc2UoYXR0cnMuZGF0YXNvdXJjZU5hbWUpKHNjb3BlKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH07XHJcbn1dKTsiXX0=
