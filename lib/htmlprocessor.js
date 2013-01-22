'use strict';
var path = require('path');

//
// Returns an array object of all the directives for the given html.
// Each item of the array has the following form:
//
//
//     {
//       type: 'css',
//       dest: 'css/site.css',
//       src: [
//         'css/normalize.css',
//         'css/main.css'
//       ],
//       raw: [
//         '    <!-- build:css css/site.css -->',
//         '    <link rel="stylesheet" href="css/normalize.css">',
//         '    <link rel="stylesheet" href="css/main.css">',
//         '    <!-- endbuild -->'
//       ]
//     }
// Note that when treating an HTML file making usage of requireJS
// an additional information for the block is added, regarding RequireJS
// configuration. For example:
//
//       requirejs: {
//         name: 'scripts/main',
//         dest: 'scripts/foo.js'
//       }
//
// Note also that dest is expressed relatively from the root. I.e., if the block starts with:
//    <!-- build:css /foo/css/site.css -->
// then dest will equal foo/css/site.css (note missing trailing /)
//
var getBlocks = function (dir, content) {
  // start build pattern --> <!-- build:[target] output -->
  var regbuild = /<!--\s*build:([\w-]+)\s*([^\s]+)\s*-->/;
  // end build pattern -- <!-- endbuild -->
  var regend = /<!--\s*endbuild\s*-->/;

  var lines = content.replace(/\r\n/g, '\n').split(/\n/),
    block = false,
    sections = [],
    last;

  lines.forEach(function (l) {
    var indent = (l.match(/^\s*/) || [])[0];
    var build = l.match(regbuild);
    var endbuild = regend.test(l);
    var startFromRoot = false;

    // discard empty lines
    if (build) {
      block = true;
      // Handle absolute path (i.e. with respect to the server root)
      if (build[2][0] === '/') {
        startFromRoot = true;
        build[2] = build[2].substr(1);
      }
      last = {
        type: build[1],
        dest: path.join(dir, build[2]),
        startFromRoot: startFromRoot,
        indent: indent,
        src: [],
        raw: []
      };
    }

    // switch back block flag when endbuild
    if (block && endbuild) {
      last.raw.push(l);
      sections.push(last);
      block = false;
    }

    if (block && last) {
      var asset = l.match(/(href|src)=["']([^'"]+)["']/);
      if (asset && asset[2]) {
        last.src.push(path.join(dir, asset[2]));
        // RequireJS uses a data-main attribute on the script tag to tell it
        // to load up the main entry point of the amp app
        //
        // If we find one, we must record the name of the main entry point,
        // as well the name of the destination file, and treat
        // the furnished requirejs as an asset (src)
        var main = l.match(/data-main=['"]([^'"]+)['"]/);
        if (main) {
          last.requirejs = last.requirejs || {};
          last.requirejs.dest = last.dest;
          last.requirejs.baseUrl = path.join(dir, path.dirname(main[1]));
          last.requirejs.name = path.basename(main[1]);
          last.src.push(last.dest);
        }
      }
      last.raw.push(l);
    }
  });

  return sections;
};

//
// HTMLProcessor takes care, and processes HTML files.
// It is given:
//   - the filepath of the file to consider
//   - the content of the file to consider
//   - a file replacement locator
//   - an optional log callback that will be called as soon as there's something to log
//
var HTMLProcessor = module.exports = function (filepath, content, revvedfinder, logcb) {
  this.filepath = filepath;
  this.relativePath = path.relative(process.cwd(), path.dirname(filepath));
  this.content = content;
  this.revvedfinder = revvedfinder;
  this.linefeed = /\r\n/g.test(content) ? '\r\n' : '\n';
  this.blocks = getBlocks(this.relativePath, this.content);
  this.logcb = logcb || function () {};
};

//
// Calls the log callback function
//
HTMLProcessor.prototype.log = function log(msg) {
  this.logcb(msg);
};

//
// Return the string that will replace the furnished block
//
HTMLProcessor.prototype.replaceWith = function replaceWith(block) {
  var result;

  // Determine the relative path from the destination to the source
  // file
  var dest = path.relative(this.relativePath, block.dest);

  if (block.startFromRoot) {
    dest = '/' + dest;
  }

  // fix windows style paths. Dirty but works.
  dest = dest.replace('\\', '/');

  if (block.type === 'css' || block.type === 'css-concat') {
    result = block.indent + '<link rel="stylesheet" href="' + dest + '">';
  } else if (block.type === 'js' || block.type === 'js-concat') {
    result = block.indent + '<script src="' + dest + '"><\/script>';
  } else {
    result = '';
  }
  return result;
};

//
// Replace blocks by their target
//
HTMLProcessor.prototype.replaceBlocks = function replaceBlocks() {
  var result = this.content;

  this.blocks.forEach(function (block) {
    var blockLine = block.raw.join(this.linefeed);
    result = result.replace(blockLine, this.replaceWith(block));
  }, this);

  return result;
};

//
// Replace reference to scripts, css, images, .. in +lines+ with their revved version
// If +lines+ is not furnished used instead the cached version (i.e. stored at constructor time)
//
HTMLProcessor.prototype.replaceWithRevved = function replaceWithRevved(lines) {
    // Replace script sources
    var self = this;
    var content = lines || this.content;
    var regexps = [
      /*jshint regexp:false */
      [/<script.+src=['"]([^"']+)["'][\/>]?><[\\]?\/script>/gm,
      'Update the HTML to reference our concat/min/revved script files'
      ],
      [/<link[^\>]+href=['"]([^"']+)["']/gm,
      'Update the HTML with the new css filenames'
      ],
      [/<img[^\>]+src=['"]([^"']+)["']/gm,
      'Update the HTML with the new img filenames'
      ],
      [/data-[A-Za-z0-9]*=['"]([^"']+)["']/gm,
      'Update the HTML with the data tags'
      ],
      [/url\(\s*['"]([^"']+)["']\s*\)/gm,
      'Update the HTML with background imgs, case there is some inline style'
      ],
      [/<a[^\>]+href=['"]([^"']+)["']/gm,
      'Update the HTML with anchors images'
      ],
      [/<input[^\>]+src=['"]([^"']+)["']/gm,
      'Update the HTML with reference in input'
      ]
    ];

    // Replace reference to script with the actual name of the revved script
    regexps.forEach(function (rxl) {
      self.log(rxl[1]);
      content = content.replace(rxl[0], function (match, src) {
        // Consider reference from site root
        var file = self.revvedfinder.find(src, path.dirname(self.filepath));
        var res = match.replace(src, file);

        if (src !== file) {
          self.log(match + ' changed to ' + res);
        }
        return res;
      });
    });

    return content;
  };

// Process the HTML file, which is:
//  - replace any blocks by its "target"
//  - replace files (images, scripts, css) references by their revved version
//
HTMLProcessor.prototype.process = function process() {
  return this.replaceWithRevved(this.replaceBlocks());
};
