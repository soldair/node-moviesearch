
var netflix = require(__dirname+'/../netflix.js');

netflix.search('harry potter and the goblet of fire',function(err,data){
	console.log(data);
})
