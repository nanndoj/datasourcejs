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