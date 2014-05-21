// User configs

var path = require('path');

var configs = {
  buildAppCss: 'app.css',
  buildAppJs: 'app.js',
  buildVendorCss: 'vendor.css',
  buildVendorJs: 'vendor.js',

  buildAssets: 'build/public/assets/',
  buildAssetsVendor: 'build/public/assets/vendor/',
  buildHtml: 'build/public/',
  buildPublic: 'build/public/',
  buildSrc: 'build/public/src/',
  buildVendor: 'build/public/vendor/',

  compileMainCss: 'main.css',
  compileMainJs: 'main.js',

  compileAssets: 'bin/public/assets/',
  compileAssetsVendor: 'bin/public/assets/vendor/',
  compileHtml: 'bin/public/',
  compilePublic: 'bin/public/',
  compileSrc: 'bin/public/src/',

  appLess: 'src/less/app.less',
  vendorLess: 'src/less/vendor.less',

  mainScripts: ['app/main.js']
};

var appFiles = {
  assets: ['src/assets/**/*.*'],
  coffee: ['src/app/**/*.coffee', '!src/app/**/*.spec.coffee'],
  coffeeunit: ['src/app/**/*.spec.coffee'],
  html: ['src/app/index.html'],
  js: ['src/app/**/*.js', '!src/app/**/*.spec.js'],
  jsunit: ['src/app/**/*.spec.js'],
  jsx: ['src/app/**/*.jsx'],
  less: ['src/less/**/*.less', '!' + configs.vendorLess],
  tpl: ['src/app/**/*.tpl.html'],
  root: ['LICENSE', 'README.md', 'public/**/*.*']
};

var vendorFiles = {
  assets: [
    'vendor/bootstrap/fonts/*.*'
  ],
  js: [
    'vendor/mithril/mithril.js',
    'vendor/min-require/min-require.js',
  ],
};

var consts = {
  livereload_port: 35729,
};

var modes = [consts.development, consts.production];

/* -------------------------------------------------------------------------- */
// Implement tasks

var gulp = require('gulp');
var plugins = require('gulp-load-plugins')();
var runSequence = require('run-sequence');

var colors = plugins.util.colors;
var log = plugins.util.log;

function clean(filePath, cb) {
  log('Clean ' + colors.blue(filePath));
  gulp.src(filePath, {read: false})
    .pipe(plugins.clean({force: false}))
    .on('end', cb || function() {})
    .on('error', log);
}

function revName(filename) {
  var index = filename.search(/\.[^.]*$/);
  return filename.substr(0, index) + '-*' + filename.substr(index);
}

function mainScripts(basepath) {
  return configs.mainScripts.map(function(s) {
    return path.join(basepath, s);
  });
}

function buildStyles(src, options, cb) {
  gulp.src(src)
    .pipe(plugins.plumber())
    .pipe(plugins.less(options))
    .pipe(plugins.size({showFiles: true}))
    .pipe(gulp.dest(configs.buildAssets))
    .on('end', cb || function(){})
    .on('error', log);
}

// Generate build/public/assets/app-***.css
gulp.task('buildAppStyles',function(cb) {
  buildStyles(configs.appLess, {sourceMap:true}, cb);
});

// Generate build/public/assets/vendor-***.css
gulp.task('buildVendorStyles', function(cb) {
  buildStyles(configs.vendorLess, {sourceMap:false}, cb);
});

// Generate bin/public/assets/main-***.css
gulp.task('compileStyles', function(cb) {
  clean(path.join(configs.compileAssets, revName(configs.compileMainCss)), _compileStyles);

  function _compileStyles() {
    gulp.src([
      path.join(configs.buildAssets, configs.buildVendorCss),
      path.join(configs.buildAssets, configs.buildAppCss),
    ])
      .pipe(plugins.plumber())
      .pipe(plugins.concat(configs.compileMainCss))
      .pipe(plugins.minifyCss())
      .pipe(plugins.streamify(plugins.rev()))
      .pipe(plugins.size({showFiles: true}))
      .pipe(gulp.dest(configs.compileAssets))
      .on('end', cb || function(){})
      .on('error', log);
  }
});

// Combine *.jsx and store in build/src/app
gulp.task('buildAppScriptsInject', function(cb) {
  gulp.src(appFiles.jsx, {base: 'src/app'})
    .pipe(plugins.plumber())
    .pipe(plugins.includeJs({ext:'jsx'}))
    .pipe(plugins.size({showFiles: true}))
    .pipe(gulp.dest(path.join(configs.buildSrc, 'app')))
    .on('end', cb || function(){})
    .on('error', log);
});

// Convert app scripts from .jsx to .js and wrap them in require style
gulp.task('buildAppScriptsMsx', function(cb) {
  var appPath = path.join(configs.buildSrc, 'app');
  gulp.src(appPath + '/**/*.jsx', {base: appPath})
    .pipe(plugins.plumber())
    .pipe(plugins.msx())
    // .pipe(plugins.sweetjs({modules: ['./res/template-compiler.sjs']}))
    .pipe(plugins.wrapRequire(appPath))
    .pipe(plugins.size({showFiles: true}))
    .pipe(gulp.dest(appPath))
    .on('end', cb || function(){})
    .on('error', log);
});

// Note: We only support *.jsx files and ignore all *.js files.
//
// gulp.task('buildAppScriptPlain', function(cb) {
//   gulp.src(appFiles.js, {base: 'src'})
//     .pipe(plugins.size({showFiles: true}))
//     .pipe(gulp.dest(configs.buildSrc))
//     .on('end', cb || function(){})
//     .on('error', log);
// });

// Combine and convert *.jsx
// We only support *.jsx
gulp.task('buildAppScripts', function(cb) {
  runSequence('buildAppScriptsInject', 'buildAppScriptsMsx', cb);
});

// Copy vendor scripts to build/public/vendor
gulp.task('buildVendorScripts', function(cb) {
  gulp.src(vendorFiles.js, {base: 'vendor'})
    .pipe(gulp.dest('build/public/vendor'))
    .on('end', cb || function(){})
    .on('error', log);
});

// Concat all scripts to bin/public/assets/main-***.js
gulp.task('compileScripts', function(cb) {
  clean(path.join(configs.compileAssets, revName(configs.compileMainJs)), _compileScripts);

  function _compileScripts() {
    var glob = [].concat(
      vendorFiles.js || [],
      [path.join(configs.buildSrc, 'app/**/*.js')]
    );
    gulp.src(glob)
      .pipe(plugins.plumber())
      .pipe(plugins.concat(configs.compileMainJs))
      .pipe(plugins.insert.append('\n\nrequire(\'main\');\n'))
      .pipe(plugins.streamify(plugins.uglify({mangle: true})))
      .pipe(plugins.streamify(plugins.rev()))
      .pipe(plugins.size({showFiles: true}))
      .pipe(gulp.dest(configs.compileAssets))
      .on('end', cb || function() {})
      .on('error', log);
  }
});

// Copy vendor and app assets to build/public/assets
gulp.task('buildAppAssets', function(cb) {
  gulp.src(appFiles.assets, {base: 'src/assets'})
    .pipe(gulp.dest(configs.buildAssets))
    .on('end', cb || function(){})
    .on('error', log);
});

gulp.task('buildVendorAssets', function(cb) {
  gulp.src(vendorFiles.assets)
    .pipe(gulp.dest(configs.buildAssetsVendor))
    .on('end', cb || function(){})
    .on('error', log);
});

// Copy assets from build/public/assets to bin/public/assets
gulp.task('compileAssets', function(cb) {
  gulp.src(path.join(configs.buildAssets, '**/*.*'), {base: configs.buildAssets})
    .pipe(gulp.dest(configs.compileAssets))
    .on('end', cb || function(){})
    .on('error', log);
});

function injectHtml(tag, path, glob) {
  return plugins.inject(
    gulp.src(glob, {read:false}), {
      starttag: '<!-- ' + tag + '.{{ext}} -->',
      endtag: '<!-- end -->',
      ignorePath: path,
      sort: function(a,b) {return a < b? -1 : a > b? 1 : 0;}
    }
  );
}

gulp.task('buildIndexHtml', function(cb) {
  gulp.src(appFiles.html)
    .pipe(plugins.plumber())
    .pipe(injectHtml('vendor', configs.buildPublic,
      [
        path.join(configs.buildAssets, configs.buildVendorCss),
        path.join(configs.buildVendor, '**/*.js')
      ]
    ))
    .pipe(injectHtml('app', configs.buildPublic,
      [
        path.join(configs.buildAssets, configs.buildAppCss),
        path.join(configs.buildSrc, 'app/**/*.js')
      ]
    ))
    .pipe(plugins.insert.append('<script>require(\'main\');</script>'))
    .pipe(plugins.size({showFiles:true}))
    .pipe(gulp.dest(configs.buildHtml))
    .on('end', cb || function(){})
    .on('error', log);
});

gulp.task('compileIndexHtml', function(cb) {
  gulp.src(appFiles.html)
    .pipe(plugins.plumber())
    .pipe(injectHtml('app', configs.compilePublic,
    [
      path.join(configs.compileAssets, revName(configs.compileMainCss)),
      path.join(configs.compileAssets, revName(configs.compileMainJs))
    ]))
    .pipe(plugins.minifyHtml())
    .pipe(plugins.size({showFiles:true}))
    .pipe(gulp.dest(configs.compileHtml))
    .on('end', cb || function(){})
    .on('error', log);
});

gulp.task('buildRootFiles', function(cb) {
  gulp.src(appFiles.root, {base:'.'})
    .pipe(gulp.dest('build'))
    .on('end', cb || function(){})
    .on('error', log);
});

gulp.task('compileRootFiles', function(cb) {
  gulp.src(appFiles.root, {base:'.'})
    .pipe(gulp.dest('bin'))
    .on('end', cb || function(){})
    .on('error', log);
});

gulp.task('testAppScripts', function(cb) {
  // TODO
});

/* -------------------------------------------------------------------------- */
// Major tasks

gulp.task('clean', function(cb) {
  clean(['build', 'bin'], cb);
});

gulp.task('build', function(cb) {
  runSequence('clean',[
      'buildAppStyles', 'buildVendorStyles',
      'buildAppScripts', 'buildVendorScripts',
      'buildAppAssets', 'buildVendorAssets',
      'buildRootFiles'
    ],
    'buildIndexHtml',
    cb);
});

gulp.task('compile', function(cb) {
  runSequence('build',
    ['compileStyles', 'compileScripts', 'compileAssets', 'compileRootFiles'],
    'compileIndexHtml',
    cb);
});

gulp.task('default', ['compile']);

// Tasks to run whenever a source file changes
gulp.task('watch', function(cb) {

  function _indexHtml(e) {
    // TODO: removed files
    // gulp.start('buildIndexHtml');
    console.log(e);
  }

  function _watch(e) {
    console.log('all', e);
  }

  var eventColors = {
    added: colors.green,
    changed: colors.magenta,
    deleted: colors.red
  };
  var eventBgColors = {
    added: colors.bgGreen,
    changed: colors.bgMagenta,
    deleted: colors.bgRed
  };

  gulp.watch(appFiles.assets, ['buildAppAssets']);
  gulp.watch(appFiles.less, ['buildAppStyles']);
  gulp.watch(configs.vendorLess, ['buildVendorStyles']);
  gulp.watch(appFiles.html, ['buildIndexHtml']);
  gulp.watch(appFiles.root, ['buildRootFiles']);
  gulp.watch(appFiles.jsunit, ['testAppScripts']);
  gulp.watch(appFiles.jsx, function(e) {
    // log(colors.());
    // console.log('w', e);
    var c = eventColors[e.type] || colors.white;
    // log('[' + c(e.type) + '] ' + colors.gray(e.path));
    var bc = eventBgColors[e.type] || colors.white;
    log(bc(' ' + colors.black(e.type) + ' ') + ' ' + c(e.path));

    // case changed: buildAppScripts
    // case added: build added scripts
    // case deleted: build related scripts
    //   delete script file
    // case renamed: delete script file, build new file
    // compare src files to dest files, if a file is missing in source, delete it
    if (e.type === 'deleted') {
      var fileToDelete = path.join(configs.buildSrc, path.relative('src', e.path));
      if (path.extname(fileToDelete) === '.jsx') {
        clean(fileToDelete.slice(0, fileToDelete.length-4) + '.js');
      }
      clean(fileToDelete);
      return;
    }

    if (e.type === 'changed') {
      gulp.start('buildAppScripts');

    } else {
      runSequence('buildAppScripts', 'buildIndexHtml', function(){});
    }
  });

  // var events = {added:true, deleted:true, renamed: true};

  // function isAddDeleteRename(file) {
  //   console.log(file.path, file.event);
  //   return events[file.event];
  // }

  // // Run whole tasks, which use gulp-changed or gulp-newer to catch file
  // // or run tasks on specific files
  // plugins.watch({glob: appFiles.jsx}, function(files, cb) {
  //   gulp.start('buildAppScripts', function() {
  //     files.pipe(plugins.filter(isAddDeleteRename))
  //       .pipe();
  //   });
  //   return files;
  //   // console.log('x', cb);
  //   // files.pipe(plugins.filter(isAddDeleteRename))
  //   //   .on('end', cb || function(){});
  // });
});
