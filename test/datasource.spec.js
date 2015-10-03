var expect = require('chai').expect;
var DatasourceJS = require('../src/core/datasource.js');

global.XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;

var consts = {
  targetURL : 'http://jsonplaceholder.typicode.com/posts',
  pojo : {
    'userId' : 1,
    'id' : 1,
    'title': 'New item title',
    'body': 'New item body'
  }
};

describe('Datasource', function() {
  it('should have DatasourceJS defined', function() {
    expect(DatasourceJS).to.not.be.undefined;
  });

  it('should be able to make requests', function(done) {
    // Check if there's an XMLHTTPRequestObject
    expect(XMLHttpRequest).to.not.be.undefined;

    var request = new XMLHttpRequest();
    request.open('GET',consts.targetURL, true);
    request.send();

    request.onreadystatechange = function() {
      if(this.readyState === 4) {
        if(this.status === 200) {
          expect(this.responseText).to.not.be.undefined;
          expect(this.responseText).to.not.be.empty;
          done();
        }
      }
    };
  });

  it('should be able to fetch items', function(done) {
    var datasource = new DatasourceJS('Posts');
    datasource.entity = consts.targetURL;
    datasource.init();

    datasource.fetch({}, { success: function() {
      expect(datasource.data).to.not.be.empty;
      expect(datasource.data[0]).to.have.property('id');
      expect(datasource.getCursor()).to.be.equal(0);
      done();
    }});
  });

  it('should be able to save items', function(done) {
    var datasource = new DatasourceJS('Posts');
    datasource.entity = consts.targetURL;
    datasource.init();

    // Insert a new record
    datasource.insert(consts.pojo, function(response) {
      // Check if the post request returned an id
      expect(response).to.have.property('id');
      done();
    });
  });

  it('should be able to update items', function(done) {
    var datasource = new DatasourceJS('Posts');
    datasource.entity = consts.targetURL + '/1/';
    datasource.init();

    // Insert a new record
    datasource.update(consts.pojo, function(response) {
      // Check if the post request returned an id
      expect(response).to.have.property('id');
      done();
    });
  });
});