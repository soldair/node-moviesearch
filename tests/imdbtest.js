
var imdb = require(__dirname+'/../imdb.js');

imdb.search('harry potter and the goblet of fire',function(err,data){

	console.log(data)
	if(err) console.log(err+" "+err.stack);

	id = data.popular.shift();
	
	imdb.details(id,function(err,data){
		console.log(data);
		if(err) console.log(err+" "+err.stack);
	});
	
	var media = data.titles[id].media;

	imdb.video(media[0].href,function(err,data){
		console.log(data);
	});
});