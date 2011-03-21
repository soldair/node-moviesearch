
var netflix = require(__dirname+'/../app.js').netflix;

netflix.search('harry potter and the goblet of fire',function(err,data){
	console.log(data);
})
