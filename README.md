# grunt-usemin [![Build Status](https://secure.travis-ci.org/yeoman/grunt-usemin.png?branch=master)](http://travis-ci.org/yeoman/grunt-usemin)

> Replaces references to non-optimized scripts or stylesheets into a set of HTML files (or any templates/views).


## Getting Started
If you haven't used [grunt][] before, be sure to check out the [Getting Started][] guide, as it explains how to create a [gruntfile][Getting Started] as well as install and use grunt plugins. Once you're familiar with that process, install this plugin with this command:

```shell
npm install grunt-usemin --save-dev
```

[grunt]: http://gruntjs.com/
[Getting Started]: https://github.com/gruntjs/grunt/blob/devel/docs/getting_started.md

## Workflow

usemin is composed of 2 different tasks (`useminPrepare` and `usemin`) that are part of the same workflow:

- **useminPrepare**: detects special construction (blocks) in the HTML files and update the `grunt` config to run `concat`/`min`/`css`/`requirejs` on the files referenced in the block. It does not changes the HTML files it is working on.
- **usemin**: in the HTML and CSS files it treats, it replaces the blocks by a reference to a single file, as well as all references to images, scripts, CSS files, by their minified/revved/.. version if it is found on the disk. As such this target rewrites the HTML and CSS files it is working on.

Usually, `useminPrepare` is launched first, then the `concat`, `min`, `css` and `requirejs` tasks are launched (they will created the minified/revved version of the referenced files), and then, in the end `usemin` is launched.

## The useminPrepare task

A special task which uses the build block HTML comments in markup to get back the list of files to handle, and initialize the grunt configuration appropriately, and automatically.

Custom HTML "block" comments are provided as an API for interacting with the build script. These comments adhere to the following pattern:

```html
<!-- build:<type> <path> -->
... HTML Markup, list of script / link tags.
<!-- endbuild -->
```

- **type**: either `js`, `js-concat`, `css` or `css-concat`
- **path**: the file path of the optimized file, the target output

An example of this in completed form can be seen below:

```html
<!-- build:js js/app.js -->
<script src="js/app.js"></script>
<script src="js/controllers/thing-controller.js"></script>
<script src="js/models/thing-model.js"></script>
<script src="js/views/thing-view.js"></script>
<!-- endbuild -->
```

Internally, the task parses your HTML markup to find each of these blocks, and initializes for you the corresponding Grunt config for the concat / min tasks when `type=js`, the concat / css tasks when `type=css`.
When using `type=js-concat` or `type=css-concat` the config for the concat task is affected only.

The task also handles use of RequireJS, for the scenario where you specify the main entry point for your application using the "data-main" attribute as follows:

```html
<!-- build:js js/app.min.js -->
<script data-main="js/main" src="js/vendor/require.js"></script>
<!-- -->
```

One doesn't need to specify a concat/min/css or RequireJS configuration anymore.

It is using only one target: `html`, with a list of the concerned files. For example, in your `Gruntfile.js`:

```js
'useminPrepare': {
  html: 'index.html'
}
```


## The usemin task

This task is responsible for replacing in HTML and CSS files, references to non-minified files with reference to their minified/revved version if they are found on the disk.

```js
usemin: {
  html: ['**/*.html'],
  css: ['**/*.css']
}
```


## License

[BSD license](http://opensource.org/licenses/bsd-license.php) and copyright Google
