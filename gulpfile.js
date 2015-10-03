'use strict';

var paths = {
  SOURCE : './src/',
  DIST : './dist/',
  TEST : './test/'
};

var browserify = require('browserify');
var gulp = require('gulp');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var rename = require('gulp-rename');
var gutil = require('gulp-util');
var mocha = require('gulp-mocha');

gulp.task('javascript', ['test'], function () {
  // set up the browserify instance on a task basis
  var b = browserify({
    entries: './src/datasource-angular.js',
    debug: true
  });

  return b.bundle()
    .pipe(source('datasource.js'))
    .pipe(buffer())
    .pipe(gulp.dest(paths.DIST))
    .pipe(sourcemaps.init({loadMaps: false, sourceRoot: paths.DIST}))
        // Add transformation tasks to the pipeline here.
        .pipe(uglify().on('error', gutil.log))
    .pipe(sourcemaps.write('./', {includeContent: false}))
    .pipe(rename(function (path) {
      if (path.extname === '.js')
        path.extname = '.min.js';
      return path;
    }))
    .pipe(gulp.dest(paths.DIST));
});

// Rerun the task when a file changes
gulp.task('watch', ['javascript'], function() {
  gulp.watch(paths.SOURCE + '**/*.js', ['javascript']);
});

gulp.task('watch-tests', function() {
  gulp.watch(paths.TEST + '**/*.spec.js', ['test']);
});
 
gulp.task('test', function () {
  return gulp.src('test/**/*.spec.js', {read: false})
      // gulp-mocha needs filepaths so you can't have any plugins before it 
      .pipe(mocha());
});

gulp.task('default', ['javascript', 'watch', 'watch-tests']);