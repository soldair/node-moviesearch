ABOUT
=====

nodejs plain text movie title search via scrapers for movie info, images, and more.
this does not save anything or cache results. It just uses some reasonably fragile scrapers to gather some data.

this project was basically a test run for jsdom etc and is a little behind the latest apis

EXAMPLES
========
	var imdb = require('moviesearch').imdb;

	imdb.search('harry potter and the goblet of fire',function(err,data){
		id = data.popular.shift();

		//get the details for the highest matching result
		imdb.details(id,function(err,data){
			console.log(data);
			if(err) console.log(err+" "+err.stack);
		});
		
		var media = data.titles[id].media;

		//get the video for the highest matching result
		imdb.video(media[0].href,function(err,data){
			console.log(data);
		});
	});


	var netflix = require('moviesearch').netflix;

	netflix.search('harry potter and the goblet of fire',function(err,data){
		console.log(data);
	});