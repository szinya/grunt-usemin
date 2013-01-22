'use strict';
var assert = require('assert');
var grunt = require('grunt');
var HTMLProcessor = require('../lib/htmlprocessor');

describe('htmlprocessor', function () {
  var filemapping = {
    'foo.js': '1234.foo.js',
    '/foo.js': '/1234.foo.js',
    'bar.css': '5678.bar.css',
    'image.png': '1234.image.png'
  };

  var revvedfinder = {
    find: function (s) {
      return filemapping[s] || s;
    }
  };

  it('should initialize correctly', function () {
    var hp = new HTMLProcessor('myfile.html', '', 3);
    assert(hp !== null);
    assert.equal(3, hp.revvedfinder);
    assert.equal('\n', hp.linefeed);
    assert.equal(0, hp.blocks.length);
  });

  it('should *not* skip blank lines', function () {
    var htmlcontent = '  <!-- build:css foo.css -->\n  <link rel="stylesheet" href="bar.css">\n\n  <link rel="stylesheet" href="foo.css">\n  <!-- endbuild -->\n';
    var hp = new HTMLProcessor('myfile.html', htmlcontent, 3);
    assert.equal(1, hp.blocks.length);
    assert.equal('foo.css', hp.blocks[0].dest);
    assert.equal(5, hp.blocks[0].raw.length);
    assert.equal(2, hp.blocks[0].src.length);
    assert.equal('  ', hp.blocks[0].indent);
  });

  it('should return the right number of blocks with the right number of lines', function () {
    var filename = __dirname + '/fixtures/usemin.html';
    var htmlcontent =  grunt.file.read(filename);
    var hp = new HTMLProcessor(filename, htmlcontent, 3);
    assert.equal(5, hp.blocks.length);
    var b1 = hp.blocks[0];
    var b2 = hp.blocks[1];
    var b3 = hp.blocks[2];
    var b4 = hp.blocks[3];
    var b5 = hp.blocks[4];
    assert.equal(3, b1.raw.length);
    assert.equal('css', b1.type);
    assert.equal(1, b1.src.length);
    assert.equal(4, b2.raw.length);
    assert.equal('css-concat', b2.type);
    assert.equal(2, b2.src.length);
    assert.equal(16, b3.raw.length);
    assert.equal('js', b3.type);
    assert.equal(13, b3.src.length);
    assert.equal(4, b4.raw.length);
    assert.equal('js-concat', b4.type);
    assert.equal(2, b4.src.length);
    assert.equal(3, b5.raw.length);
    assert.equal('js', b5.type);
    assert.equal(2, b5.src.length); // requirejs has been added also
  });

  it('should detect and handle the usage on RequireJS in blocks', function () {
    var htmlcontent = '<!-- build:js scripts/amd-app.js -->\n' +
    '<script data-main="scripts/main" src="scripts/vendor/require.js"></script>\n' +
    '<script src="foo.js"></script>\n' +
    '<!-- endbuild -->';
    var hp = new HTMLProcessor('myfile.html', htmlcontent, 3);
    assert.equal(1, hp.blocks.length);
    assert.ok(hp.blocks[0].requirejs);
    assert.equal(hp.blocks[0].requirejs.dest, 'scripts/amd-app.js');
    assert.equal(hp.blocks[0].requirejs.baseUrl, 'scripts');
    assert.equal(hp.blocks[0].requirejs.name, 'main');
  });

  it('should take into consideration path of the source file', function () {
    var htmlcontent = '<!-- build:css bar/foo.css -->\n' +
    '<link rel="stylesheet" href="bar.css">\n' +
    '<!-- endbuild -->';
    var hp = new HTMLProcessor('build/myfile.html', htmlcontent, 3);
    assert.equal(1, hp.blocks.length);
    assert.equal('build/bar/foo.css', hp.blocks[0].dest);
    assert.equal(1, hp.blocks[0].src.length);
    assert.equal('build/bar.css', hp.blocks[0].src[0]);
  });

  it('should take into consideration path of the source file (RequireJS)', function () {
    var htmlcontent = '<!-- build:js scripts/amd-app.js -->\n' +
    '<script data-main="scripts/main" src="scripts/vendor/require.js"></script>\n' +
    '<script src="foo.js"></script>\n' +
    '<!-- endbuild -->';
    var hp = new HTMLProcessor('build/myfile.html', htmlcontent, 3);
    assert.equal(1, hp.blocks.length);
    assert.equal('build/scripts/amd-app.js', hp.blocks[0].dest);
    assert.ok(hp.blocks[0].requirejs);
    assert.equal(hp.blocks[0].requirejs.dest, 'build/scripts/amd-app.js');
    assert.equal(hp.blocks[0].requirejs.baseUrl, 'build/scripts');
    assert.equal(hp.blocks[0].requirejs.name, 'main');
  });

  it('should take into consideration source files referenced from root', function () {
    var htmlcontent = '<!-- build:css /bar/foo.css -->\n' +
    '<link rel="stylesheet" href="bar.css">\n' +
    '<!-- endbuild -->';
    var hp = new HTMLProcessor('myfile.html', htmlcontent, 3);
    assert.equal(1, hp.blocks.length);
    assert.equal('bar/foo.css', hp.blocks[0].dest);
  });

  describe('replaceWith', function () {
    it('should return a string that will replace the furnished block (JS)', function () {
      var htmlcontent = '  <!-- build:js foo.js -->   <script src="scripts/bar.js"></script>\n  <script src="baz.js"></script>\n  <!-- endbuild -->\n';
      var hp = new HTMLProcessor('myfile.txt', htmlcontent, 3);
      var replacestring = hp.replaceWith(hp.blocks[0]);
      assert.equal(replacestring, '  <script src="foo.js"></script>');
    });

    it('should return a string that will replace the furnished block (CSS)', function () {
      var htmlcontent = '  <!-- build:css foo.css -->\n<link rel="stylesheet" href="bar.css">\n\n<link rel="stylesheet" href="baz.css">\n<!-- endbuild -->\n';
      var hp = new HTMLProcessor('myfile.txt', htmlcontent, 3);
      var replacestring = hp.replaceWith(hp.blocks[0]);
      assert.equal(replacestring, '  <link rel="stylesheet" href="foo.css">');
    });

    it('should replace with a path relative to the file', function () {
      var htmlcontent = '  <!-- build:js foo.js -->   <script src="scripts/bar.js"></script>\n  <script src="baz.js"></script>\n  <!-- endbuild -->\n';
      var hp = new HTMLProcessor('build/myfile.txt', htmlcontent, 3);
      var replacestring = hp.replaceWith(hp.blocks[0]);
      assert.equal(replacestring, '  <script src="foo.js"></script>');
    });
  });

  describe('replaceBlocks', function () {
    it('should replace blocks based on their types', function () {
      var jsblock = '  <!-- build:js foo.js -->\n   <script src="scripts/bar.js"></script>\n  <script src="baz.js"></script>\n  <!-- endbuild -->\n';
      var cssblock = '  <!-- build:css foo.css -->\n<link rel="stylesheet" href="bar.css">\n\n<link rel="stylesheet" href="baz.css">\n<!-- endbuild -->\n';
      var jsconcatblock = '  <!-- build:js-concat foo.js -->\n   <script src="scripts/bar.js"></script>\n  <script src="baz.js"></script>\n  <!-- endbuild -->\n';
      var cssconcatblock = '  <!-- build:css-concat foo.css -->\n<link rel="stylesheet" href="bar.css">\n\n<link rel="stylesheet" href="baz.css">\n<!-- endbuild -->\n';
      var htmlcontent = jsblock + '\n\n' + cssblock + '\n\n' + jsconcatblock + '\n\n' + cssconcatblock;
      var awaited = '  <script src="foo.js"></script>\n\n\n  <link rel="stylesheet" href="foo.css">\n\n\n  <script src="foo.js"></script>\n\n\n  <link rel="stylesheet" href="foo.css">\n';
      var hp = new HTMLProcessor('myfile.txt', htmlcontent, 3);
      var replaced = hp.replaceBlocks();
      assert.equal(replaced, awaited);
    });
  });

  describe('replaceWithRevved', function () {
    it('should replace file referenced from root', function () {
      var content = '<script src="/foo.js"></script>';
      var hp = new HTMLProcessor('myfile.txt', content, revvedfinder);
      var replaced = hp.replaceWithRevved();
      assert.equal(replaced, '<script src="/1234.foo.js"></script>');
    });

    it('should not replace file if no revved version is found', function () {
      var content = '<script src="bar.js"></script>';
      var hp = new HTMLProcessor('myfile.txt', content, revvedfinder);
      var replaced = hp.replaceWithRevved();
      assert.equal(replaced, '<script src="bar.js"></script>');
    });

    it('should not treat file reference that are coming from templating', function () {
      var content = '<script src="<% my_func() %>"></script>';
      var hp = new HTMLProcessor('myfile.txt', content, revvedfinder);
      var replaced = hp.replaceWithRevved();
      assert.equal(replaced, '<script src="<% my_func() %>"></script>');
    });

    it('should not replace the root (i.e /)', function () {
      var content = '<script src="/"></script>';
      var hp = new HTMLProcessor('myfile.txt', content, revvedfinder);
      var replaced = hp.replaceWithRevved();
      assert.equal(replaced, '<script src="/"></script>');
    });

    it('should not replace external references', function () {
      var content = '<script src="http://bar/foo.js"></script>';
      var hp = new HTMLProcessor('myfile.txt', content, revvedfinder);
      var replaced = hp.replaceWithRevved();
      assert.equal(replaced, '<script src="http://bar/foo.js"></script>');
    });

    it('should replace script source with revved version', function () {
      var content = '<script src="foo.js"></script>';
      var hp = new HTMLProcessor('myfile.txt', content, revvedfinder);
      var replaced = hp.replaceWithRevved();
      assert.equal(replaced, '<script src="' + filemapping['foo.js'] + '"></script>');
    });

    it('should replace CSS reference with revved version', function () {
      var content = '<link rel="stylesheet" href="bar.css">';
      var hp = new HTMLProcessor('myfile.txt', content, revvedfinder);
      var replaced = hp.replaceWithRevved();
      assert.equal(replaced, '<link rel="stylesheet" href="' + filemapping['bar.css'] + '">');
    });

    it('should replace img reference with revved version', function () {
      var content = '<img src="image.png">';
      var hp = new HTMLProcessor('myfile.txt', content, revvedfinder);
      var replaced = hp.replaceWithRevved();
      assert.equal(replaced, '<img src="' + filemapping['image.png'] + '">');
    });

    it('should replace data reference with revved version', function () {
      var content = '<li data-lang="fr" data-src="image.png"></li>';
      var hp = new HTMLProcessor('myfile.txt', content, revvedfinder);
      var replaced = hp.replaceWithRevved();
      assert.equal(replaced, '<li data-lang="fr" data-src="' + filemapping['image.png'] + '"></li>');
    });

    it('should replace image reference in inlined style', function () {
      var content = '<li style="background: url("image.png");"></li>';
      var hp = new HTMLProcessor('myfile.txt', content, revvedfinder);
      var replaced = hp.replaceWithRevved();
      assert.equal(replaced, '<li style="background: url("' + filemapping['image.png'] + '");"></li>');
    });

    it('should replace image reference in anchors', function () {
      var content = '<a href="image.png"></a>';
      var hp = new HTMLProcessor('myfile.txt', content, revvedfinder);
      var replaced = hp.replaceWithRevved();
      assert.equal(replaced, '<a href="' + filemapping['image.png'] + '"></a>');
    });

    it('should replace image reference in input', function () {
      var content = '<input type="image" src="image.png" />';
      var hp = new HTMLProcessor('myfile.txt', content, revvedfinder);
      var replaced = hp.replaceWithRevved();
      assert.equal(replaced, '<input type="image" src="' + filemapping['image.png'] + '" />');
    });

  });

  describe('process', function () {
    it('should replace blocks by targets and references by revved versions', function () {
      var content = '  <!-- build:js foo.js -->\n'  +
      '   <script src="scripts/bar.js"></script>\n' +
      '  <script src="baz.js"></script>\n' +
      '  <!-- endbuild -->\n' +
      '  <img src="image.png">';
      var awaited = '  <script src="' + filemapping['foo.js'] + '"></script>\n' +
      '  <img src="' + filemapping['image.png'] + '">';
      var hp = new HTMLProcessor('myfile.txt', content, revvedfinder);
      var replaced = hp.process();
      assert.equal(replaced, awaited);
    });
  });
});
